"""workflow_engine

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add manager_id to users (self-referencing FK)
    op.add_column("users", sa.Column("manager_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_users_manager_id", "users", "users",
        ["manager_id"], ["id"], ondelete="SET NULL",
    )

    # workflow_defs
    op.create_table(
        "workflow_defs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("definition", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # workflow_instances
    op.create_table(
        "workflow_instances",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workflow_def_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("initiator_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("current_node_id", sa.String(50), nullable=False),
        sa.Column("form_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["workflow_def_id"], ["workflow_defs.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["initiator_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_instances_initiator", "workflow_instances", ["initiator_id"])
    op.create_index("ix_instances_status", "workflow_instances", ["status"])

    # workflow_tasks
    op.create_table(
        "workflow_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("instance_id", sa.Integer(), nullable=False),
        sa.Column("node_id", sa.String(50), nullable=False),
        sa.Column("assignee_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["instance_id"], ["workflow_instances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_tasks_assignee_status", "workflow_tasks", ["assignee_id", "status"])

    # workflow_history
    op.create_table(
        "workflow_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("instance_id", sa.Integer(), nullable=False),
        sa.Column("node_id", sa.String(50), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("operator_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["instance_id"], ["workflow_instances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["operator_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_history_instance", "workflow_history", ["instance_id"])


def downgrade() -> None:
    op.drop_table("workflow_history")
    op.drop_table("workflow_tasks")
    op.drop_table("workflow_instances")
    op.drop_table("workflow_defs")
    op.drop_constraint("fk_users_manager_id", "users", type_="foreignkey")
    op.drop_column("users", "manager_id")
