"""add on_complete_hook to workflow_defs

Revision ID: 559a1b2c3d4e
Revises: 558e8a4b5f1e
Create Date: 2026-06-09

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "559a1b2c3d4e"
down_revision: str | None = "558e8a4b5f1e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "workflow_defs",
        sa.Column("on_complete_hook", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("workflow_defs", "on_complete_hook")
