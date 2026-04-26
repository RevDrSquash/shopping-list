from fastapi.testclient import TestClient
from sqlalchemy import func, select
from typing import Type

from app.db.models import Household, Membership, User
from app.db.session import get_sessionmaker


def count_rows(model: Type[object]) -> int:
    with get_sessionmaker()() as session:
        return session.scalar(select(func.count()).select_from(model)) or 0


def test_dev_login_provisions_user_household_and_membership(client: TestClient) -> None:
    response = client.get("/dev/login", params={"email": "Person@Example.com"})

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "person@example.com"
    assert count_rows(User) == 1
    assert count_rows(Household) == 1
    assert count_rows(Membership) == 1


def test_repeated_dev_login_reuses_existing_user_and_household(client: TestClient) -> None:
    first_response = client.get("/dev/login", params={"email": "person@example.com"})
    second_response = client.get("/dev/login", params={"email": "PERSON@example.com"})

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.json()["user"]["id"] == second_response.json()["user"]["id"]
    assert count_rows(User) == 1
    assert count_rows(Household) == 1
    assert count_rows(Membership) == 1


def test_me_returns_logged_in_user_and_household(client: TestClient) -> None:
    login_response = client.get("/dev/login", params={"email": "person@example.com"})
    me_response = client.get("/me")

    assert login_response.status_code == 200
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "person@example.com"
    assert me_response.json()["id"] == login_response.json()["user"]["id"]
    assert me_response.json()["household_id"]
