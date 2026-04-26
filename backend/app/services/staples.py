from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Staple


def calculate_eligible_at(
    interval_days: int,
    base_time: Optional[datetime] = None,
) -> datetime:
    base = base_time or datetime.now(timezone.utc)
    return base + timedelta(days=interval_days * 2 / 3)


def list_staples(db: Session, household_id: UUID) -> list[Staple]:
    return list(
        db.scalars(
            select(Staple)
            .where(Staple.household_id == household_id)
            .order_by(Staple.created_at, Staple.name)
        )
    )


def get_staple(db: Session, household_id: UUID, staple_id: UUID) -> Optional[Staple]:
    return db.scalar(
        select(Staple).where(
            Staple.id == staple_id,
            Staple.household_id == household_id,
        )
    )


def create_staple(
    db: Session,
    household_id: UUID,
    name: str,
    quantity: str,
    interval_days: int,
    now: Optional[datetime] = None,
) -> Staple:
    created_at = now or datetime.now(timezone.utc)
    staple = Staple(
        household_id=household_id,
        name=name,
        quantity=quantity,
        interval_days=interval_days,
        created_at=created_at,
        updated_at=created_at,
    )
    db.add(staple)
    db.flush()
    return staple
