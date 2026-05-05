from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.responses import RedirectResponse, StreamingResponse

from app.api.deps import get_current_household, get_current_user
from app.core.config import Settings, get_settings
from app.db.models import Household, Membership, MembershipStatus, ShoppingListItem, ShoppingListItemStatus, Staple, User
from app.db.session import get_db
from app.services.auth import normalize_email, provision_user_for_email, provision_user_for_google_identity
from app.services.events import household_event_stream, household_events
from app.services.google_oauth import oauth
from app.services.households import (
    InvitationConflictError,
    InvitationView,
    SoleMemberLeaveError,
    accept_invitation,
    cancel_invitation,
    decline_invitation,
    household_member_count,
    invite_user_by_email,
    leave_household,
    list_pending_invitations_for_household,
    list_pending_invitations_for_user,
)
from app.services.promotion import promote_all_inactive_staples
from app.services.shopping_list import add_one_off_item, confirm_item, list_active_items, resolve_item
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


class PromotionResponse(BaseModel):
    promoted_count: int


class ShoppingListItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    quantity: str = Field(default="", max_length=255)

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


class ShoppingListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    household_id: UUID
    staple_id: Optional[UUID]
    name: str
    quantity: str
    status: ShoppingListItemStatus
    created_at: datetime
    updated_at: datetime


class CurrentUserResponse(BaseModel):
    id: UUID
    email: str
    household_id: UUID
    household_member_count: int


class InvitationCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)

    @field_validator("email")
    @classmethod
    def email_must_be_normalized_address(cls, value: str) -> str:
        normalized = normalize_email(value)
        if "@" not in normalized:
            raise ValueError("Email must contain @")
        return normalized


class InvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    household_id: UUID
    household_name: str
    user_id: UUID
    user_email: str
    status: MembershipStatus
    created_at: datetime


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/config")
def config(settings: Settings = Depends(get_settings)) -> dict[str, bool]:
    return {
        "dev_login_enabled": settings.dev_login_enabled,
        "google_oauth_enabled": settings.google_oauth_enabled,
    }


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


@router.get("/auth/google/login")
async def google_login(
    request: Request,
    settings: Settings = Depends(get_settings),
):
    if not settings.google_oauth_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured",
        )

    redirect_uri = f"{settings.app_base_url}/api/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/auth/google/callback")
async def google_callback(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    if not settings.google_oauth_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured",
        )

    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo") or {}
    if userinfo.get("email_verified") is not True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google account email is not verified",
        )

    email = userinfo.get("email")
    sub = userinfo.get("sub")
    if not email or not sub:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google account identity is incomplete",
        )

    user = provision_user_for_google_identity(db, email=email, sub=sub)
    db.commit()
    request.session["user_id"] = str(user.id)
    return RedirectResponse("/", status_code=status.HTTP_302_FOUND)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request) -> Response:
    request.session.clear()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=CurrentUserResponse)
def me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentUserResponse:
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

    return CurrentUserResponse(
        id=current_user.id,
        email=current_user.email,
        household_id=membership.household_id,
        household_member_count=household_member_count(db, membership.household_id),
    )


@router.post(
    "/households/invitations",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_household_invitation(
    payload: InvitationCreate,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db),
) -> InvitationView:
    try:
        invitation = invite_user_by_email(db, household, payload.email)
    except InvitationConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already has an invitation or membership for this household",
        ) from exc

    db.commit()
    household_events.broadcast_household_changed(household.id)
    return invitation


@router.get("/households/invitations", response_model=list[InvitationResponse])
def get_household_invitations(
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db),
) -> list[InvitationView]:
    return list_pending_invitations_for_household(db, household.id)


@router.delete("/households/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_household_invitation(
    invitation_id: UUID,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db),
) -> Response:
    if not cancel_invitation(db, household.id, invitation_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    db.commit()
    household_events.broadcast_household_changed(household.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/invitations", response_model=list[InvitationResponse])
def get_invitations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[InvitationView]:
    return list_pending_invitations_for_user(db, current_user.id)


@router.post("/invitations/{invitation_id}/accept", status_code=status.HTTP_204_NO_CONTENT)
def post_accept_invitation(
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    household_id = accept_invitation(db, current_user, invitation_id)
    if household_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    db.commit()
    household_events.broadcast_household_changed(household_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/invitations/{invitation_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
def post_decline_invitation(
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    household_id = decline_invitation(db, current_user, invitation_id)
    if household_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    db.commit()
    household_events.broadcast_household_changed(household_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/households/leave", status_code=status.HTTP_204_NO_CONTENT)
def post_leave_household(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        old_household_id = leave_household(db, current_user)
    except SoleMemberLeaveError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot leave a household with only one member",
        ) from exc
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Household membership not found") from exc

    db.commit()
    household_events.broadcast_household_changed(old_household_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/staples", response_model=list[StapleResponse])
def get_staples(
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db),
) -> list[Staple]:
    return list_staples(db, household.id)


@router.get("/shopping-list", response_model=list[ShoppingListItemResponse])
def get_shopping_list(
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db),
) -> list[ShoppingListItem]:
    return list_active_items(db, household.id)


@router.get("/events")
async def get_events(
    request: Request,
    household: Household = Depends(get_current_household),
) -> StreamingResponse:
    return StreamingResponse(
        household_event_stream(request, household.id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/shopping-list/items",
    response_model=ShoppingListItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_shopping_list_item(
    payload: ShoppingListItemCreate,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db),
) -> ShoppingListItem:
    item = add_one_off_item(
        db=db,
        household_id=household.id,
        name=payload.name,
        quantity=payload.quantity,
    )
    db.commit()
    household_events.broadcast_household_changed(household.id)
    db.refresh(item)
    return item


@router.post("/shopping-list/items/{item_id}/confirm", response_model=ShoppingListItemResponse)
def post_confirm_shopping_list_item(
    item_id: UUID,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db),
) -> ShoppingListItem:
    item = confirm_item(db, household.id, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping list item not found")

    db.commit()
    household_events.broadcast_household_changed(household.id)
    db.refresh(item)
    return item


@router.post("/shopping-list/items/{item_id}/skip", status_code=status.HTTP_204_NO_CONTENT)
def post_skip_shopping_list_item(
    item_id: UUID,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db),
) -> Response:
    if not resolve_item(db, household.id, item_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping list item not found")

    db.commit()
    household_events.broadcast_household_changed(household.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/shopping-list/items/{item_id}/purchase", status_code=status.HTTP_204_NO_CONTENT)
def post_purchase_shopping_list_item(
    item_id: UUID,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db),
) -> Response:
    if not resolve_item(db, household.id, item_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping list item not found")

    db.commit()
    household_events.broadcast_household_changed(household.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
    household_events.broadcast_household_changed(household.id)
    db.refresh(staple)
    return staple


@router.post("/staples/promote-all", response_model=PromotionResponse)
def post_promote_all_staples(
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db),
) -> PromotionResponse:
    promoted_count = promote_all_inactive_staples(db, household.id)
    db.commit()
    if promoted_count > 0:
        household_events.broadcast_household_changed(household.id)
    return PromotionResponse(promoted_count=promoted_count)


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
    if updates:
        household_events.broadcast_household_changed(household.id)
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
    household_events.broadcast_household_changed(household.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
