from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.db.models import Membership, MembershipStatus, User
from app.db.session import get_db
from app.services.auth import normalize_email, provision_user_for_email

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/dev/login")
def dev_login(
    request: Request,
    email: str = Query(min_length=3),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, dict[str, str]]:
    if not settings.dev_login_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Development login is disabled",
        )

    normalized_email = normalize_email(email)
    if "@" not in normalized_email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email must contain @",
        )

    user = provision_user_for_email(db, normalized_email)
    db.commit()
    request.session["user_id"] = str(user.id)

    return {"user": {"id": str(user.id), "email": user.email}}


@router.get("/me")
def me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    membership = db.scalar(
        select(Membership).where(
            Membership.user_id == current_user.id,
            Membership.status == MembershipStatus.member,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Household membership not found",
        )

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "household_id": str(membership.household_id),
    }
