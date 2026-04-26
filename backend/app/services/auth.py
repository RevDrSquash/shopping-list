from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Household, Membership, MembershipStatus, User


def normalize_email(email: str) -> str:
    return email.strip().lower()


def provision_user_for_email(db: Session, email: str) -> User:
    normalized_email = normalize_email(email)
    user = db.scalar(
        select(User)
        .options(selectinload(User.memberships))
        .where(User.email == normalized_email)
    )

    if user is None:
        user = User(email=normalized_email)
        household = Household(name=f"{normalized_email}'s household")
        membership = Membership(
            user=user,
            household=household,
            status=MembershipStatus.member,
        )
        db.add_all([user, household, membership])
        db.flush()
        return user

    has_member_household = any(
        membership.status == MembershipStatus.member for membership in user.memberships
    )
    if not has_member_household:
        household = Household(name=f"{normalized_email}'s household")
        membership = Membership(
            user=user,
            household=household,
            status=MembershipStatus.member,
        )
        db.add_all([household, membership])
        db.flush()

    return user
