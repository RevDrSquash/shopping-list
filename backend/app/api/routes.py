from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_household, get_current_user
from app.core.config import Settings, get_settings
from app.db.models import Household, Membership, MembershipStatus, Staple, User
from app.db.session import get_db
from app.services.auth import normalize_email, provision_user_for_email
from app.services.staples import create_staple, get_staple, list_staples

router = APIRouter()


class StapleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    quantity: str = Field(default="", max_length=255)
    interval_days: int = Field(gt=0)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name is required")
        return stripped

    @field_validator("quantity")
    @classmethod
    def quantity_is_free_text(cls, value: str) -> str:
        return value.strip()


class StapleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    quantity: Optional[str] = Field(default=None, max_length=255)
    interval_days: Optional[int] = Field(default=None, gt=0)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name is required")
        return stripped

    @field_validator("quantity")
    @classmethod
    def quantity_is_free_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return value.strip()


class StapleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    household_id: UUID
    name: str
    quantity: str
    interval_days: int
    last_resolved_at: Optional[datetime]
    eligible_at: datetime
    created_at: datetime
    updated_at: datetime


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


@router.get("/staples", response_model=list[StapleResponse])
def get_staples(
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db),
) -> list[Staple]:
    return list_staples(db, household.id)


@router.post("/staples", response_model=StapleResponse, status_code=status.HTTP_201_CREATED)
def post_staple(
    payload: StapleCreate,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db),
) -> Staple:
    staple = create_staple(
        db=db,
        household_id=household.id,
        name=payload.name,
        quantity=payload.quantity,
        interval_days=payload.interval_days,
    )
    db.commit()
    db.refresh(staple)
    return staple


@router.patch("/staples/{staple_id}", response_model=StapleResponse)
def patch_staple(
    staple_id: UUID,
    payload: StapleUpdate,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db),
) -> Staple:
    staple = get_staple(db, household.id, staple_id)
    if staple is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staple not found")

    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates:
        staple.name = updates["name"]
    if "quantity" in updates:
        staple.quantity = updates["quantity"]
    if "interval_days" in updates:
        staple.interval_days = updates["interval_days"]

    db.commit()
    db.refresh(staple)
    return staple


@router.delete("/staples/{staple_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staple(
    staple_id: UUID,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db),
) -> Response:
    staple = get_staple(db, household.id, staple_id)
    if staple is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staple not found")

    db.delete(staple)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
