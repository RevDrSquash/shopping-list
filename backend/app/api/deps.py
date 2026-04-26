from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Household, Membership, MembershipStatus, User
from app.db.session import get_db


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    user_id = request.session.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    try:
        user_uuid = UUID(user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        ) from exc

    user = db.get(User, user_uuid)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )

    return user


def get_current_household(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Household:
    household = db.scalar(
        select(Household)
        .join(Membership)
        .where(
            Membership.user_id == current_user.id,
            Membership.status == MembershipStatus.member,
        )
    )
    if household is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Household membership not found",
        )

    return household
