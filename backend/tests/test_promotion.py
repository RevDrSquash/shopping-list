from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.models import ShoppingListItem, ShoppingListItemStatus, Staple
from app.db.session import get_sessionmaker
from app.services.promotion import promote_due_staples
from app.services.staples import create_staple


def create_logged_in_household(client) -> str:
    login_response = client.get("/dev/login", params={"email": "person@example.com"})
    assert login_response.status_code == 200
    me_response = client.get("/me")
    assert me_response.status_code == 200
    return me_response.json()["household_id"]


def test_promotion_creates_copied_item_for_due_staple(client) -> None:
    household_id = create_logged_in_household(client)
    now = datetime.now(timezone.utc)

    with get_sessionmaker()() as db:
        staple = create_staple(db, household_id, "Milk", "2L", 7, now=now - timedelta(days=10))
        db.commit()

        promoted_count = promote_due_staples(db, now=now)
        db.commit()

        item = db.scalar(select(ShoppingListItem).where(ShoppingListItem.staple_id == staple.id))

    assert promoted_count == 1
    assert item is not None
    assert item.name == "Milk"
    assert item.quantity == "2L"
    assert item.status == ShoppingListItemStatus.needs_review


def test_editing_staple_after_promotion_does_not_mutate_promoted_copy(client) -> None:
    household_id = create_logged_in_household(client)
    now = datetime.now(timezone.utc)

    with get_sessionmaker()() as db:
        staple = create_staple(db, household_id, "Milk", "2L", 7, now=now - timedelta(days=10))
        promote_due_staples(db, now=now)
        db.flush()

        staple.name = "Oat milk"
        staple.quantity = "1 carton"
        db.commit()

        item = db.scalar(select(ShoppingListItem).where(ShoppingListItem.staple_id == staple.id))

    assert item is not None
    assert item.name == "Milk"
    assert item.quantity == "2L"


def test_promotion_skips_staple_with_active_item(client) -> None:
    household_id = create_logged_in_household(client)
    now = datetime.now(timezone.utc)

    with get_sessionmaker()() as db:
        create_staple(db, household_id, "Milk", "2L", 7, now=now - timedelta(days=10))
        first_count = promote_due_staples(db, now=now)
        second_count = promote_due_staples(db, now=now)
        item_count = len(list(db.scalars(select(ShoppingListItem))))
        db.commit()

    assert first_count == 1
    assert second_count == 0
    assert item_count == 1


def test_promotion_skips_staple_with_in_cart_item(client) -> None:
    household_id = create_logged_in_household(client)
    now = datetime.now(timezone.utc)

    with get_sessionmaker()() as db:
        staple = create_staple(db, household_id, "Milk", "2L", 7, now=now - timedelta(days=10))
        db.add(
            ShoppingListItem(
                household_id=household_id,
                staple_id=staple.id,
                name="Milk",
                quantity="2L",
                status=ShoppingListItemStatus.in_cart,
            )
        )
        promoted_count = promote_due_staples(db, now=now)
        item_count = len(list(db.scalars(select(ShoppingListItem))))
        db.commit()

    assert promoted_count == 0
    assert item_count == 1


def test_promotion_purges_purchased_items_before_promoting(client) -> None:
    household_id = create_logged_in_household(client)
    now = datetime.now(timezone.utc)

    with get_sessionmaker()() as db:
        staple = create_staple(db, household_id, "Milk", "2L", 7, now=now - timedelta(days=10))
        purchased_item = ShoppingListItem(
            household_id=household_id,
            staple_id=staple.id,
            name="Milk",
            quantity="2L",
            status=ShoppingListItemStatus.purchased,
        )
        db.add(purchased_item)
        db.flush()
        purchased_item_id = purchased_item.id

        promoted_count = promote_due_staples(db, now=now)
        items = list(db.scalars(select(ShoppingListItem)))
        db.commit()

    assert promoted_count == 1
    assert len(items) == 1
    assert items[0].id != purchased_item_id
    assert items[0].status == ShoppingListItemStatus.needs_review


def test_deleting_staple_leaves_promoted_item_with_null_staple_id(client) -> None:
    household_id = create_logged_in_household(client)
    now = datetime.now(timezone.utc)

    with get_sessionmaker()() as db:
        staple = create_staple(db, household_id, "Milk", "2L", 7, now=now - timedelta(days=10))
        promote_due_staples(db, now=now)
        db.flush()
        db.delete(staple)
        db.commit()

        item = db.scalar(select(ShoppingListItem))

    assert item is not None
    assert item.name == "Milk"
    assert item.staple_id is None
