from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.db.session import reset_database_caches
from app.main import create_app


def test_dev_login_is_rejected_outside_development_or_test(monkeypatch) -> None:
    monkeypatch.setenv("ENV", "production")
    get_settings.cache_clear()
    reset_database_caches()

    with TestClient(create_app()) as client:
        response = client.get("/dev/login", params={"email": "person@example.com"})

    assert response.status_code == 403


def test_dev_login_is_rejected_when_env_is_unset(monkeypatch) -> None:
    monkeypatch.delenv("ENV", raising=False)
    get_settings.cache_clear()
    reset_database_caches()

    settings = Settings(_env_file=None)
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings

    with TestClient(app) as client:
        response = client.get("/dev/login", params={"email": "person@example.com"})

    assert response.status_code == 403
