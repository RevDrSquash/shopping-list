from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import Enum as SqlEnum


class Base(DeclarativeBase):
    pass


class MembershipStatus(str, Enum):
    pending = "pending"
    member = "member"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    google_oauth_subject: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        index=True,
    )

    memberships: Mapped[List["Membership"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Household(TimestampMixin, Base):
    __tablename__ = "households"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    memberships: Mapped[List["Membership"]] = relationship(
        back_populates="household",
        cascade="all, delete-orphan",
    )


class Membership(TimestampMixin, Base):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "household_id", name="uq_memberships_user_household"),
        Index(
            "uq_memberships_one_member_household_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'member'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    household_id: Mapped[UUID] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[MembershipStatus] = mapped_column(
        SqlEnum(MembershipStatus, name="membership_status"),
        nullable=False,
        default=MembershipStatus.member,
    )

    user: Mapped[User] = relationship(back_populates="memberships")
    household: Mapped[Household] = relationship(back_populates="memberships")
