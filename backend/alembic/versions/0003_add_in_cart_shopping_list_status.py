"""Add in_cart shopping list item status.

Revision ID: 0003_in_cart_status
Revises: 0002_staples
Create Date: 2026-06-01
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0003_in_cart_status"
down_revision: Union[str, Sequence[str], None] = "0002_staples"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE shopping_list_item_status ADD VALUE IF NOT EXISTS 'in_cart'")


def downgrade() -> None:
    # PostgreSQL does not support dropping a single enum value without recreating the type.
    pass
