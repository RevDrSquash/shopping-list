from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import ShoppingListItem, ShoppingListItemStatus
from app.db.session import get_sessionmaker
from app.services.auth import provision_user_for_email
from app.services.staples import create_staple


def login(client: TestClient, email: str = "person@example.com") -> str:
    response = client.get("/dev/login", params={"email": email})
    assert response.status_code == 200
    me_response = client.get("/me")
    assert me_response.status_code == 200
    return me_response.json()["household_id"]


def test_authenticated_user_can_create_list_update_and_delete_staples(client: TestClient) -> None:
    login(client)

    create_response = client.post(
        "/staples",
        json={"name": "Milk", "quantity": "2L", "interval_days": 7},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "Milk"
    assert created["quantity"] == "2L"
    assert created["interval_days"] == 7

    list_response = client.get("/staples")
    assert list_response.status_code == 200
    assert [staple["id"] for staple in list_response.json()] == [created["id"]]

    update_response = client.patch(
        f"/staples/{created['id']}",
        json={"name": "Oat milk", "quantity": "1 carton", "interval_days": 10},
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["name"] == "Oat milk"
    assert updated["quantity"] == "1 carton"
    assert updated["interval_days"] == 10

    delete_response = client.delete(f"/staples/{created['id']}")
    assert delete_response.status_code == 204
    assert client.get("/staples").json() == []


def test_staple_create_validates_name_and_interval_but_accepts_free_text_quantity(
    client: TestClient,
) -> None:
    login(client)

    blank_name_response = client.post(
        "/staples",
        json={"name": "   ", "quantity": "anything", "interval_days": 7},
    )
    bad_interval_response = client.post(
        "/staples",
        json={"name": "Rice", "quantity": "large bag", "interval_days": 0},
    )
    free_text_response = client.post(
        "/staples",
        json={"name": "Rice", "quantity": "big bag; brand doesn't matter", "interval_days": 30},
    )

    assert blank_name_response.status_code == 422
    assert bad_interval_response.status_code == 422
    assert free_text_response.status_code == 201
    assert free_text_response.json()["quantity"] == "big bag; brand doesn't matter"


def test_staple_create_derives_eligible_at_from_two_thirds_interval(
    client: TestClient,
) -> None:
    login(client)

    response = client.post(
        "/staples",
        json={"name": "Coffee", "quantity": "1 bag", "interval_days": 9},
    )

    assert response.status_code == 201
    body = response.json()
    created_at = body["created_at"]
    eligible_at = body["eligible_at"]
    created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    eligible = datetime.fromisoformat(eligible_at.replace("Z", "+00:00"))
    assert body["last_resolved_at"] is None
    assert eligible - created == timedelta(days=6)


def test_staple_interval_update_changes_derived_eligible_at(client: TestClient) -> None:
    login(client)
    create_response = client.post(
        "/staples",
        json={"name": "Coffee", "quantity": "1 bag", "interval_days": 9},
    )
    created = create_response.json()

    update_response = client.patch(
        f"/staples/{created['id']}",
        json={"interval_days": 3},
    )

    assert update_response.status_code == 200
    updated = update_response.json()
    created_at = datetime.fromisoformat(updated["created_at"].replace("Z", "+00:00"))
    eligible_at = datetime.fromisoformat(updated["eligible_at"].replace("Z", "+00:00"))
    assert updated["interval_days"] == 3
    assert eligible_at - created_at == timedelta(days=2)


def test_promote_all_staples_promotes_not_yet_eligible_staples(client: TestClient) -> None:
    household_id = login(client)
    now = datetime.now(timezone.utc)

    with get_sessionmaker()() as db:
        staple = create_staple(db, household_id, "Coffee", "1 bag", 30, now=now)
        db.commit()

    response = client.post("/staples/promote-all")

    assert response.status_code == 200
    assert response.json() == {"promoted_count": 1}
    with get_sessionmaker()() as db:
        item = db.scalar(select(ShoppingListItem).where(ShoppingListItem.staple_id == staple.id))

    assert item is not None
    assert item.name == "Coffee"
    assert item.quantity == "1 bag"
    assert item.status == ShoppingListItemStatus.needs_review


def test_promote_all_staples_is_idempotent_for_active_items(client: TestClient) -> None:
    household_id = login(client)
    now = datetime.now(timezone.utc)

    with get_sessionmaker()() as db:
        create_staple(db, household_id, "Coffee", "1 bag", 30, now=now)
        db.commit()

    first_response = client.post("/staples/promote-all")
    second_response = client.post("/staples/promote-all")

    assert first_response.status_code == 200
    assert first_response.json() == {"promoted_count": 1}
    assert second_response.status_code == 200
    assert second_response.json() == {"promoted_count": 0}
    with get_sessionmaker()() as db:
        item_count = len(list(db.scalars(select(ShoppingListItem))))

    assert item_count == 1


def test_promote_all_staples_is_scoped_to_current_household(client: TestClient) -> None:
    household_id = login(client)
    now = datetime.now(timezone.utc)

    with get_sessionmaker()() as db:
        other_user = provision_user_for_email(db, "other@example.com")
        other_household_id = other_user.memberships[0].household_id
        create_staple(db, household_id, "Coffee", "1 bag", 30, now=now)
        create_staple(db, other_household_id, "Other milk", "2L", 7, now=now)
        db.commit()

    response = client.post("/staples/promote-all")

    assert response.status_code == 200
    assert response.json() == {"promoted_count": 1}
    with get_sessionmaker()() as db:
        items = list(db.scalars(select(ShoppingListItem).order_by(ShoppingListItem.name)))

    assert [item.name for item in items] == ["Coffee"]
