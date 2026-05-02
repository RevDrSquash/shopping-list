from typing import Any, Optional, Type

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from starlette.responses import RedirectResponse

from app.core.config import get_settings
from app.db.models import Household, Membership, User
from app.db.session import get_sessionmaker, reset_database_caches
from app.main import create_app
from app.services.google_oauth import oauth


def count_rows(model: Type[object]) -> int:
    with get_sessionmaker()() as session:
        return session.scalar(select(func.count()).select_from(model)) or 0


def get_user_by_email(email: str) -> Optional[User]:
    with get_sessionmaker()() as session:
        return session.scalar(select(User).where(User.email == email))


@pytest.fixture
def oauth_client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "test-client-secret")
    get_settings.cache_clear()
    reset_database_caches()

    app = create_app()
    with TestClient(app) as test_client:
        yield test_client

    get_settings.cache_clear()
    reset_database_caches()


def mock_google_token(monkeypatch: pytest.MonkeyPatch, userinfo: dict[str, Any]) -> None:
    async def authorize_access_token(_request) -> dict[str, Any]:
        return {"userinfo": userinfo}

    monkeypatch.setattr(oauth.google, "authorize_access_token", authorize_access_token)


def test_google_callback_creates_user_household_membership_and_session(
    oauth_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_google_token(
        monkeypatch,
        {
            "email": "Person@Example.com",
            "email_verified": True,
            "sub": "google-sub-1",
        },
    )

    response = oauth_client.get("/auth/google/callback", follow_redirects=False)

    assert response.status_code == 302
    assert response.headers["location"] == "/"
    assert count_rows(User) == 1
    assert count_rows(Household) == 1
    assert count_rows(Membership) == 1

    me_response = oauth_client.get("/me")
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "person@example.com"

    user = get_user_by_email("person@example.com")
    assert user is not None
    assert user.google_oauth_subject == "google-sub-1"


def test_google_callback_attaches_subject_to_existing_email_user(
    oauth_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dev_login_response = oauth_client.get("/dev/login", params={"email": "person@example.com"})
    assert dev_login_response.status_code == 200

    mock_google_token(
        monkeypatch,
        {
            "email": "PERSON@example.com",
            "email_verified": True,
            "sub": "google-sub-2",
        },
    )

    response = oauth_client.get("/auth/google/callback", follow_redirects=False)

    assert response.status_code == 302
    assert count_rows(User) == 1
    assert count_rows(Household) == 1
    assert count_rows(Membership) == 1

    user = get_user_by_email("person@example.com")
    assert user is not None
    assert str(user.id) == dev_login_response.json()["user"]["id"]
    assert user.google_oauth_subject == "google-sub-2"


def test_google_callback_rejects_unverified_email(
    oauth_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_google_token(
        monkeypatch,
        {
            "email": "person@example.com",
            "email_verified": False,
            "sub": "google-sub-3",
        },
    )

    response = oauth_client.get("/auth/google/callback", follow_redirects=False)

    assert response.status_code == 403
    assert count_rows(User) == 0
    assert count_rows(Household) == 0
    assert count_rows(Membership) == 0


def test_google_routes_return_503_when_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
    get_settings.cache_clear()
    reset_database_caches()

    with TestClient(create_app()) as client:
        login_response = client.get("/auth/google/login", follow_redirects=False)
        callback_response = client.get("/auth/google/callback", follow_redirects=False)

    assert login_response.status_code == 503
    assert callback_response.status_code == 503


def test_logout_clears_session(oauth_client: TestClient) -> None:
    login_response = oauth_client.get("/dev/login", params={"email": "person@example.com"})
    assert login_response.status_code == 200
    assert oauth_client.get("/me").status_code == 200

    logout_response = oauth_client.post("/auth/logout")

    assert logout_response.status_code == 204
    assert oauth_client.get("/me").status_code == 401


def test_config_reflects_auth_flags(
    oauth_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = oauth_client.get("/config")

    assert response.status_code == 200
    assert response.json() == {
        "dev_login_enabled": True,
        "google_oauth_enabled": True,
    }

    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
    get_settings.cache_clear()
    reset_database_caches()

    with TestClient(create_app()) as client:
        unconfigured_response = client.get("/config")

    assert unconfigured_response.status_code == 200
    assert unconfigured_response.json() == {
        "dev_login_enabled": True,
        "google_oauth_enabled": False,
    }


def test_google_login_redirects_to_provider(
    oauth_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def authorize_redirect(_request, redirect_uri: str) -> RedirectResponse:
        assert redirect_uri == "http://localhost:8080/api/auth/google/callback"
        return RedirectResponse("https://accounts.google.com/fake", status_code=302)

    monkeypatch.setattr(oauth.google, "authorize_redirect", authorize_redirect)

    response = oauth_client.get("/auth/google/login", follow_redirects=False)

    assert response.status_code == 302
    assert response.headers["location"] == "https://accounts.google.com/fake"
