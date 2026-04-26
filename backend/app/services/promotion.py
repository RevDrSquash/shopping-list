from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.db.models import ShoppingListItem, ShoppingListItemStatus, Staple


ACTIVE_PROMOTION_STATUSES = (
    ShoppingListItemStatus.needs_review,
    ShoppingListItemStatus.confirmed,
)


def promote_due_staples(db: Session, now: Optional[datetime] = None) -> int:
    promotion_time = now or datetime.now(timezone.utc)
    promoted_count = 0
    due_staples = db.scalars(
        select(Staple)
        .where(Staple.next_add_at <= promotion_time)
        .order_by(Staple.next_add_at, Staple.created_at)
    )

    for staple in due_staples:
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
