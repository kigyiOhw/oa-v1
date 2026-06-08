"""add actual_start_time and actual_end_time to overtime_requests

Revision ID: 770c3d4e5f6a
Revises: 660b2c3d4e5f
Create Date: 2026-06-09

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "770c3d4e5f6a"
down_revision: str | None = "660b2c3d4e5f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "overtime_requests",
        sa.Column("actual_start_time", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "overtime_requests",
        sa.Column("actual_end_time", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("overtime_requests", "actual_end_time")
    op.drop_column("overtime_requests", "actual_start_time")
