"""add half_day to leave_requests

Revision ID: 660b2c3d4e5f
Revises: 559a1b2c3d4e
Create Date: 2026-06-09

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "660b2c3d4e5f"
down_revision: str | None = "559a1b2c3d4e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "leave_requests",
        sa.Column("half_day", sa.String(2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("leave_requests", "half_day")
