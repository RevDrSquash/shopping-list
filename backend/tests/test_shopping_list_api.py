from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import ShoppingListItem, ShoppingListItemStatus, Staple
from app.db.session import get_sessionmaker
from app.services.auth import provision_user_for_email
from app.services.promotion import promote_due_staples
from app.services.staples import create_staple


def login(client: TestClient, email: str = "person@example.com") -> str:
    response = client.get("/dev/login", params={"email": email})
    assert response.status_code == 200
    me_response = client.get("/me")
    assert me_response.status_code == 200
    return me_response.json()["household_id"]


def promote_staple_for_household(client: TestClient) -> tuple[str, str]:
    household_id = login(client)
    now = datetime.now(timezone.utc)

    with get_sessionmaker()() as db:
        staple = create_staple(db, household_id, "Milk", "2L", 7, now=now - timedelta(days=10))
        promote_due_staples(db, now=now)
        item = db.scalar(select(ShoppingListItem).where(ShoppingListItem.staple_id == staple.id))
        assert item is not None
        item_id = str(item.id)
        staple_id = str(staple.id)
        db.commit()

    return item_id, staple_id


def test_shopping_list_returns_only_current_household_active_items(client: TestClient) -> None:
    household_id = login(client)

    with get_sessionmaker()() as db:
        other_user = provision_user_for_email(db, "other@example.com")
        other_household_id = other_user.memberships[0].household_id
        db.add_all(
            [
                ShoppingListItem(
                    household_id=household_id,
                    name="Review milk",
                    quantity="2L",
                    status=ShoppingListItemStatus.needs_review,
                ),
                ShoppingListItem(
                    household_id=household_id,
                    name="Confirmed bread",
                    quantity="1 loaf",
                    status=ShoppingListItemStatus.confirmed,
                ),
                ShoppingListItem(
                    household_id=household_id,
                    name="In-cart eggs",
                    quantity="12",
                    status=ShoppingListItemStatus.in_cart,
                ),
                ShoppingListItem(
                    household_id=household_id,
                    name="Already purchased",
                    quantity="",
                    status=ShoppingListItemStatus.purchased,
                ),
                ShoppingListItem(
                    household_id=other_household_id,
                    name="Other household eggs",
                    quantity="12",
                    status=ShoppingListItemStatus.confirmed,
                ),
            ]
        )
        db.commit()

    response = client.get("/shopping-list")

    assert response.status_code == 200
    items = response.json()
    assert {item["name"] for item in items} == {"Review milk", "Confirmed bread", "In-cart eggs"}
    assert {item["status"] for item in items} == {"needs_review", "confirmed", "in_cart"}


def test_add_one_off_item_creates_confirmed_item_without_staple(client: TestClient) -> None:
    login(client)

    response = client.post(
        "/shopping-list/items",
        json={"name": "  Bananas  ", "quantity": "  6  "},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Bananas"
    assert body["quantity"] == "6"
    assert body["status"] == "confirmed"
    assert body["staple_id"] is None

    with get_sessionmaker()() as db:
        item = db.get(ShoppingListItem, UUID(body["id"]))

    assert item is not None
    assert item.staple_id is None
    assert item.status == ShoppingListItemStatus.confirmed


def test_confirm_promoted_item_changes_status_to_confirmed(client: TestClient) -> None:
    item_id, _ = promote_staple_for_household(client)

    response = client.post(f"/shopping-list/items/{item_id}/confirm")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == item_id
    assert body["status"] == "confirmed"

    list_response = client.get("/shopping-list")
    assert list_response.status_code == 200
    assert list_response.json()[0]["status"] == "confirmed"


def test_skip_staple_linked_item_deletes_item_and_resolves_staple(client: TestClient) -> None:
    item_id, staple_id = promote_staple_for_household(client)
    before_skip = datetime.now(timezone.utc)

    response = client.post(f"/shopping-list/items/{item_id}/skip")

    assert response.status_code == 204
    with get_sessionmaker()() as db:
        item = db.get(ShoppingListItem, UUID(item_id))
        staple = db.get(Staple, UUID(staple_id))

    assert item is None
    assert staple is not None
    assert staple.last_resolved_at is not None
    assert staple.last_resolved_at >= before_skip


def test_cart_staple_linked_item_marks_in_cart_without_resolving_staple(client: TestClient) -> None:
    item_id, staple_id = promote_staple_for_household(client)

    response = client.post(f"/shopping-list/items/{item_id}/cart")

    assert response.status_code == 200
    assert response.json()["status"] == "in_cart"
    with get_sessionmaker()() as db:
        item = db.get(ShoppingListItem, UUID(item_id))
        staple = db.get(Staple, UUID(staple_id))

    assert item is not None
    assert item.status == ShoppingListItemStatus.in_cart
    assert staple is not None
    assert staple.last_resolved_at is None


def test_uncart_item_returns_it_to_confirmed(client: TestClient) -> None:
    login(client)
    create_response = client.post(
        "/shopping-list/items",
        json={"name": "Chocolate", "quantity": "1 bar"},
    )
    item_id = create_response.json()["id"]
    cart_response = client.post(f"/shopping-list/items/{item_id}/cart")
    assert cart_response.status_code == 200

    response = client.post(f"/shopping-list/items/{item_id}/uncart")

    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"
    with get_sessionmaker()() as db:
        item = db.get(ShoppingListItem, UUID(item_id))

    assert item is not None
    assert item.status == ShoppingListItemStatus.confirmed


def test_in_cart_items_sort_after_other_active_items(client: TestClient) -> None:
    household_id = login(client)
    now = datetime.now(timezone.utc)

    with get_sessionmaker()() as db:
        db.add_all(
            [
                ShoppingListItem(
                    household_id=household_id,
                    name="Old in cart",
                    quantity="",
                    status=ShoppingListItemStatus.in_cart,
                    created_at=now - timedelta(minutes=3),
                ),
                ShoppingListItem(
                    household_id=household_id,
                    name="New confirmed",
                    quantity="",
                    status=ShoppingListItemStatus.confirmed,
                    created_at=now - timedelta(minutes=1),
                ),
                ShoppingListItem(
                    household_id=household_id,
                    name="Review",
                    quantity="",
                    status=ShoppingListItemStatus.needs_review,
                    created_at=now - timedelta(minutes=2),
                ),
            ]
        )
        db.commit()

    response = client.get("/shopping-list")

    assert response.status_code == 200
    assert [item["name"] for item in response.json()] == ["Review", "New confirmed", "Old in cart"]


def test_complete_shopping_purchases_in_cart_items_and_resolves_linked_staples(client: TestClient) -> None:
    item_id, staple_id = promote_staple_for_household(client)
    cart_response = client.post(f"/shopping-list/items/{item_id}/cart")
    assert cart_response.status_code == 200
    before_complete = datetime.now(timezone.utc)

    response = client.post("/shopping-list/complete")

    assert response.status_code == 200
    assert response.json() == {"completed_count": 1}
    list_response = client.get("/shopping-list")
    assert list_response.status_code == 200
    assert list_response.json() == []
    with get_sessionmaker()() as db:
        item = db.get(ShoppingListItem, UUID(item_id))
        staple = db.get(Staple, UUID(staple_id))

    assert item is not None
    assert item.status == ShoppingListItemStatus.purchased
    assert staple is not None
    assert staple.last_resolved_at is not None
    assert staple.last_resolved_at >= before_complete
