from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from app.db.models import Household, Membership, MembershipStatus, ShoppingListItem, Staple, User
from app.services.auth import normalize_email


class HouseholdServiceError(Exception):
    """Base class for expected household-management domain errors."""


class InvitationConflictError(HouseholdServiceError):
    pass


class SoleMemberLeaveError(HouseholdServiceError):
    pass


@dataclass(frozen=True)
class InvitationView:
    id: UUID
    household_id: UUID
    household_name: str
    user_id: UUID
    user_email: str
    status: MembershipStatus
    created_at: datetime


def _invitation_view(membership: Membership) -> InvitationView:
    return InvitationView(
        id=membership.id,
        household_id=membership.household_id,
        household_name=membership.household.name,
        user_id=membership.user_id,
        user_email=membership.user.email,
        status=membership.status,
        created_at=membership.created_at,
    )


def _get_current_member_membership(db: Session, user_id: UUID) -> Optional[Membership]:
    return db.scalar(
        select(Membership)
        .options(selectinload(Membership.household))
        .where(
            Membership.user_id == user_id,
            Membership.status == MembershipStatus.member,
        )
    )


def household_member_count(db: Session, household_id: UUID) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Membership)
        .where(
            Membership.household_id == household_id,
            Membership.status == MembershipStatus.member,
        )
    ) or 0


def invite_user_by_email(db: Session, household: Household, email: str) -> InvitationView:
    normalized_email = normalize_email(email)
    user = db.scalar(select(User).where(User.email == normalized_email))
    if user is None:
        user = User(email=normalized_email)
        db.add(user)
        db.flush()

    existing_membership = db.scalar(
        select(Membership)
        .where(
            Membership.user_id == user.id,
            Membership.household_id == household.id,
        )
    )
    if existing_membership is not None:
        raise InvitationConflictError("User already has a membership for this household")

    membership = Membership(
        user_id=user.id,
        household_id=household.id,
        status=MembershipStatus.pending,
    )
    db.add(membership)
    db.flush()
    membership.household = household
    membership.user = user
    return _invitation_view(membership)


def list_pending_invitations_for_user(db: Session, user_id: UUID) -> list[InvitationView]:
    memberships = db.scalars(
        select(Membership)
        .options(
            selectinload(Membership.household),
            selectinload(Membership.user),
        )
        .where(
            Membership.user_id == user_id,
            Membership.status == MembershipStatus.pending,
        )
        .order_by(Membership.created_at)
    )
    return [_invitation_view(membership) for membership in memberships]


def list_pending_invitations_for_household(db: Session, household_id: UUID) -> list[InvitationView]:
    memberships = db.scalars(
        select(Membership)
        .options(
            selectinload(Membership.household),
            selectinload(Membership.user),
        )
        .where(
            Membership.household_id == household_id,
            Membership.status == MembershipStatus.pending,
        )
        .order_by(Membership.created_at)
    )
    return [_invitation_view(membership) for membership in memberships]


def cancel_invitation(db: Session, household_id: UUID, invitation_id: UUID) -> bool:
    membership = db.scalar(
        select(Membership).where(
            Membership.id == invitation_id,
            Membership.household_id == household_id,
            Membership.status == MembershipStatus.pending,
        )
    )
    if membership is None:
        return False

    db.delete(membership)
    db.flush()
    return True


def accept_invitation(db: Session, user: User, invitation_id: UUID) -> Optional[UUID]:
    membership = db.scalar(
        select(Membership)
        .options(selectinload(Membership.household))
        .where(
            Membership.id == invitation_id,
            Membership.user_id == user.id,
            Membership.status == MembershipStatus.pending,
        )
    )
    if membership is None:
        return None

    old_membership = _get_current_member_membership(db, user.id)
    if old_membership is None:
        return None

    new_household_id = membership.household_id
    old_household = old_membership.household
    old_household_id = old_membership.household_id

    db.execute(
        update(Staple)
        .where(Staple.household_id == old_household_id)
        .values(household_id=new_household_id)
    )
    db.execute(
        update(ShoppingListItem)
        .where(ShoppingListItem.household_id == old_household_id)
        .values(household_id=new_household_id)
    )

    db.delete(old_household)
    db.flush()

    membership.status = MembershipStatus.member
    db.flush()
    return new_household_id


def decline_invitation(db: Session, user: User, invitation_id: UUID) -> Optional[UUID]:
    membership = db.scalar(
        select(Membership).where(
            Membership.id == invitation_id,
            Membership.user_id == user.id,
            Membership.status == MembershipStatus.pending,
        )
    )
    if membership is None:
        return None

    household_id = membership.household_id
    db.delete(membership)
    db.flush()
    return household_id


def leave_household(db: Session, user: User) -> UUID:
    old_membership = _get_current_member_membership(db, user.id)
    if old_membership is None:
        raise LookupError("Household membership not found")

    old_household_id = old_membership.household_id
    if household_member_count(db, old_household_id) == 1:
        raise SoleMemberLeaveError("Cannot leave a household with only one member")

    new_household = Household(name=f"{user.email}'s household")
    db.add(new_household)
    db.flush()

    staple_id_map: dict[UUID, UUID] = {}
    staples = db.scalars(
        select(Staple)
        .where(Staple.household_id == old_household_id)
        .order_by(Staple.created_at, Staple.name)
    )
    for staple in staples:
        staple_copy = Staple(
            household_id=new_household.id,
            name=staple.name,
            quantity=staple.quantity,
            interval_days=staple.interval_days,
            last_resolved_at=staple.last_resolved_at,
            created_at=staple.created_at,
            updated_at=staple.updated_at,
        )
        db.add(staple_copy)
        db.flush()
        staple_id_map[staple.id] = staple_copy.id

    items = db.scalars(
        select(ShoppingListItem)
        .where(ShoppingListItem.household_id == old_household_id)
        .order_by(ShoppingListItem.created_at, ShoppingListItem.name)
    )
    for item in items:
        item_copy = ShoppingListItem(
            household_id=new_household.id,
            staple_id=staple_id_map.get(item.staple_id) if item.staple_id is not None else None,
            name=item.name,
            quantity=item.quantity,
            status=item.status,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        db.add(item_copy)

    db.delete(old_membership)
    db.flush()

    db.add(
        Membership(
            user_id=user.id,
            household_id=new_household.id,
            status=MembershipStatus.member,
        )
    )
    db.flush()
    return old_household_id
