from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Household, Membership, MembershipStatus, User


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _ensure_personal_household(db: Session, user: User) -> None:
    has_member_household = any(
        membership.status == MembershipStatus.member for membership in user.memberships
    )
    if has_member_household:
        return

    household = Household(name=f"{user.email}'s household")
    membership = Membership(
        user=user,
        household=household,
        status=MembershipStatus.member,
    )
    db.add_all([household, membership])
    db.flush()


def provision_user_for_email(db: Session, email: str) -> User:
    normalized_email = normalize_email(email)
    user = db.scalar(
        select(User)
        .options(selectinload(User.memberships))
        .where(User.email == normalized_email)
    )

    if user is None:
        user = User(email=normalized_email)
        db.add(user)
        _ensure_personal_household(db, user)
        db.flush()
        return user

    _ensure_personal_household(db, user)

    return user


def provision_user_for_google_identity(db: Session, *, email: str, sub: str) -> User:
    normalized_email = normalize_email(email)
    user = db.scalar(
        select(User)
        .options(selectinload(User.memberships))
        .where(User.google_oauth_subject == sub)
    )
    if user is not None:
        return user

    user = db.scalar(
        select(User)
        .options(selectinload(User.memberships))
        .where(User.email == normalized_email)
    )
    if user is None:
        user = User(email=normalized_email, google_oauth_subject=sub)
        db.add(user)
        _ensure_personal_household(db, user)
        db.flush()
        return user

    user.google_oauth_subject = sub
    _ensure_personal_household(db, user)
    db.flush()
    return user
