"""Add staples and shopping list items.

Revision ID: 0002_staples
Revises: 0001_initial
Create Date: 2026-04-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0002_staples"
down_revision: Union[str, Sequence[str], None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    shopping_list_item_status = postgresql.ENUM(
        "needs_review",
        "confirmed",
        "purchased",
        name="shopping_list_item_status",
        create_type=False,
    )
    shopping_list_item_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "staples",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("household_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("quantity", sa.String(length=255), nullable=False),
        sa.Column("interval_days", sa.Integer(), nullable=False),
        sa.Column("last_purchased_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_add_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_staples_household_id"), "staples", ["household_id"], unique=False)
    op.create_index(op.f("ix_staples_next_add_at"), "staples", ["next_add_at"], unique=False)

    op.create_table(
        "shopping_list_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("household_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staple_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("quantity", sa.String(length=255), nullable=False),
        sa.Column("status", shopping_list_item_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["staple_id"], ["staples.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_shopping_list_items_household_id"),
        "shopping_list_items",
        ["household_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_shopping_list_items_staple_id"),
        "shopping_list_items",
        ["staple_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_shopping_list_items_staple_id"), table_name="shopping_list_items")
    op.drop_index(op.f("ix_shopping_list_items_household_id"), table_name="shopping_list_items")
    op.drop_table("shopping_list_items")
    op.drop_index(op.f("ix_staples_next_add_at"), table_name="staples")
    op.drop_index(op.f("ix_staples_household_id"), table_name="staples")
    op.drop_table("staples")

    shopping_list_item_status = postgresql.ENUM(
        "needs_review",
        "confirmed",
        "purchased",
        name="shopping_list_item_status",
        create_type=False,
    )
    shopping_list_item_status.drop(op.get_bind(), checkfirst=True)
