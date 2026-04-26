from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.db.models import ShoppingListItem, ShoppingListItemStatus, Staple


ACTIVE_PROMOTION_STATUSES = (
    ShoppingListItemStatus.needs_review,
    ShoppingListItemStatus.confirmed,
)


def promote_due_staples(db: Session, now: Optional[datetime] = None) -> int:
    promotion_time = now or datetime.now(timezone.utc)
    return _promote_staples(db, promotion_time=promotion_time)


def promote_all_inactive_staples(db: Session, household_id: UUID) -> int:
    return _promote_staples(db, household_id=household_id)


def _promote_staples(
    db: Session,
    promotion_time: Optional[datetime] = None,
    household_id: Optional[UUID] = None,
) -> int:
    promoted_count = 0
    query = select(Staple).order_by(Staple.created_at)
    if household_id is not None:
        query = query.where(Staple.household_id == household_id)

    for staple in db.scalars(query):
        if promotion_time is not None and staple.eligible_at > promotion_time:
            continue

        active_item_exists = db.scalar(
            select(
                exists().where(
                    ShoppingListItem.staple_id == staple.id,
                    ShoppingListItem.status.in_(ACTIVE_PROMOTION_STATUSES),
                )
            )
        )
        if active_item_exists:
            continue

        db.add(
            ShoppingListItem(
                household_id=staple.household_id,
                staple_id=staple.id,
                name=staple.name,
                quantity=staple.quantity,
                status=ShoppingListItemStatus.needs_review,
            )
        )
        promoted_count += 1

    db.flush()
    return promoted_count
