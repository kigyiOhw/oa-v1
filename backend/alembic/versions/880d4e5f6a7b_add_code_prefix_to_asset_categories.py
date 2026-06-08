"""add code_prefix to asset_categories

Revision ID: 880d4e5f6a7b
Revises: 770c3d4e5f6a
Create Date: 2026-06-09

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "880d4e5f6a7b"
down_revision: str | None = "770c3d4e5f6a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "asset_categories",
        sa.Column("code_prefix", sa.String(10), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("asset_categories", "code_prefix")
