"""add attendance_records table

Revision ID: 0007
Revises: 5e80f3e8af1a
Create Date: 2026-05-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007"
down_revision: Union[str, None] = "5e80f3e8af1a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "attendance_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("check_in_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("check_out_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), server_default=sa.text("'normal'"), nullable=False),
        sa.Column("source", sa.String(20), server_default=sa.text("'check_in'"), nullable=False),
        sa.Column("leave_request_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["leave_request_id"], ["leave_requests.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("user_id", "record_date", name="uq_attendance_user_date"),
    )
    op.create_index("ix_attendance_user_status", "attendance_records", ["user_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_attendance_user_status")
    op.drop_table("attendance_records")
