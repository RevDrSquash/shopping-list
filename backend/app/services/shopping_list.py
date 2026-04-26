from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ShoppingListItem, ShoppingListItemStatus


ACTIVE_ITEM_STATUSES = (
    ShoppingListItemStatus.needs_review,
    ShoppingListItemStatus.confirmed,
)


def list_active_items(db: Session, household_id: UUID) -> list[ShoppingListItem]:
    return list(
        db.scalars(
            select(ShoppingListItem)
            .where(
                ShoppingListItem.household_id == household_id,
                ShoppingListItem.status.in_(ACTIVE_ITEM_STATUSES),
            )
            .order_by(ShoppingListItem.created_at, ShoppingListItem.name)
        )
    )


def get_active_item(
    db: Session,
    household_id: UUID,
    item_id: UUID,
) -> Optional[ShoppingListItem]:
    return db.scalar(
        select(ShoppingListItem).where(
            ShoppingListItem.id == item_id,
            ShoppingListItem.household_id == household_id,
            ShoppingListItem.status.in_(ACTIVE_ITEM_STATUSES),
        )
    )


def add_one_off_item(
    db: Session,
    household_id: UUID,
    name: str,
    quantity: str,
) -> ShoppingListItem:
    item = ShoppingListItem(
        household_id=household_id,
        staple_id=None,
        name=name,
        quantity=quantity,
        status=ShoppingListItemStatus.confirmed,
    )
    db.add(item)
    db.flush()
    return item


def confirm_item(
    db: Session,
    household_id: UUID,
    item_id: UUID,
) -> Optional[ShoppingListItem]:
    item = get_active_item(db, household_id, item_id)
    if item is None:
        return None

    item.status = ShoppingListItemStatus.confirmed
    db.flush()
    return item


def resolve_item(
    db: Session,
    household_id: UUID,
    item_id: UUID,
    now: Optional[datetime] = None,
) -> bool:
    item = get_active_item(db, household_id, item_id)
    if item is None:
        return False

    resolution_time = now or datetime.now(timezone.utc)
    if item.staple is not None:
        item.staple.last_resolved_at = resolution_time

    db.delete(item)
    db.flush()
    return True
