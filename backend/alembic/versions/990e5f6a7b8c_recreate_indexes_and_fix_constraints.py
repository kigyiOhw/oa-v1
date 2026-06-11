"""recreate dropped indexes, add FK indexes, server_defaults, and ondelete

Revision ID: 990e5f6a7b8c
Revises: 880d4e5f6a7b
Create Date: 2026-06-09

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "990e5f6a7b8c"
down_revision: str | None = "880d4e5f6a7b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1. Recreate 8 indexes dropped by migration 52769097cf87 ──

    op.create_index("ix_announcements_pinned_published", "announcements", ["is_pinned", "is_published"])
    op.create_index("ix_media_files_type", "media_files", ["file_type"])
    op.create_index("ix_leave_requests_user_status", "leave_requests", ["user_id", "status"])
    op.create_index("ix_instances_initiator", "workflow_instances", ["initiator_id"])
    op.create_index("ix_instances_status", "workflow_instances", ["status"])
    op.create_index("ix_tasks_assignee_status", "workflow_tasks", ["assignee_id", "status"])
    op.create_index("ix_history_instance", "workflow_history", ["instance_id"])
    op.create_index("ix_attendance_user_status", "attendance_records", ["user_id", "status"])

    # ── 2. Add indexes for 25 FK columns ──

    op.create_index("ix_users_department_id", "users", ["department_id"])
    op.create_index("ix_users_manager_id", "users", ["manager_id"])
    op.create_index("ix_departments_parent_id", "departments", ["parent_id"])
    op.create_index("ix_announcements_author_id", "announcements", ["author_id"])
    op.create_index("ix_media_files_uploaded_by", "media_files", ["uploaded_by"])
    # leave_requests.user_id already covered by ix_leave_requests_user_status above
    op.create_index("ix_leave_requests_workflow_instance_id", "leave_requests", ["workflow_instance_id"])
    op.create_index("ix_expense_requests_user_id", "expense_requests", ["user_id"])
    op.create_index("ix_expense_requests_workflow_instance_id", "expense_requests", ["workflow_instance_id"])
    op.create_index("ix_overtime_requests_user_id", "overtime_requests", ["user_id"])
    op.create_index("ix_overtime_requests_workflow_instance_id", "overtime_requests", ["workflow_instance_id"])
    op.create_index("ix_consumables_category_id", "consumables", ["category_id"])
    op.create_index("ix_consumable_records_consumable_id", "consumable_records", ["consumable_id"])
    op.create_index("ix_consumable_records_operator_id", "consumable_records", ["operator_id"])
    op.create_index("ix_assets_category_id", "assets", ["category_id"])
    op.create_index("ix_assets_department_id", "assets", ["department_id"])
    op.create_index("ix_assets_current_user_id", "assets", ["current_user_id"])
    op.create_index("ix_asset_assignments_asset_id", "asset_assignments", ["asset_id"])
    op.create_index("ix_asset_assignments_user_id", "asset_assignments", ["user_id"])
    op.create_index("ix_asset_assignments_operator_id", "asset_assignments", ["operator_id"])
    op.create_index("ix_attendance_records_leave_request_id", "attendance_records", ["leave_request_id"])
    op.create_index("ix_workflow_instances_def_id", "workflow_instances", ["workflow_def_id"])
    # workflow_instances.initiator_id already covered by ix_instances_initiator above
    op.create_index("ix_workflow_tasks_instance_id", "workflow_tasks", ["instance_id"])
    # workflow_tasks.assignee_id already covered by ix_tasks_assignee_status above
    op.create_index("ix_workflow_history_operator_id", "workflow_history", ["operator_id"])

    # ── 3. Add server_default for NOT NULL columns missing it ──

    op.alter_column("expense_requests", "status", server_default=sa.text("'draft'"))
    op.alter_column("overtime_requests", "status", server_default=sa.text("'draft'"))
    op.alter_column("notifications", "is_read", server_default=sa.text("false"))

    # ── 4. Add ondelete for FK constraints missing it ──

    # Drop existing FK constraints and recreate with ondelete
    # consumables.category_id -> asset_categories
    op.drop_constraint("consumables_category_id_fkey", "consumables", type_="foreignkey")
    op.create_foreign_key(
        "consumables_category_id_fkey", "consumables", "asset_categories",
        ["category_id"], ["id"], ondelete="SET NULL"
    )
    # consumable_records.operator_id -> users
    op.drop_constraint("consumable_records_operator_id_fkey", "consumable_records", type_="foreignkey")
    op.create_foreign_key(
        "consumable_records_operator_id_fkey", "consumable_records", "users",
        ["operator_id"], ["id"], ondelete="SET NULL"
    )
    # asset_assignments.user_id -> users
    op.drop_constraint("asset_assignments_user_id_fkey", "asset_assignments", type_="foreignkey")
    op.create_foreign_key(
        "asset_assignments_user_id_fkey", "asset_assignments", "users",
        ["user_id"], ["id"], ondelete="SET NULL"
    )
    # asset_assignments.operator_id -> users
    op.drop_constraint("asset_assignments_operator_id_fkey", "asset_assignments", type_="foreignkey")
    op.create_foreign_key(
        "asset_assignments_operator_id_fkey", "asset_assignments", "users",
        ["operator_id"], ["id"], ondelete="SET NULL"
    )


def downgrade() -> None:
    # ── 4. Revert ondelete ──
    op.drop_constraint("asset_assignments_operator_id_fkey", "asset_assignments", type_="foreignkey")
    op.create_foreign_key(
        "asset_assignments_operator_id_fkey", "asset_assignments", "users",
        ["operator_id"], ["id"]
    )
    op.drop_constraint("asset_assignments_user_id_fkey", "asset_assignments", type_="foreignkey")
    op.create_foreign_key(
        "asset_assignments_user_id_fkey", "asset_assignments", "users",
        ["user_id"], ["id"]
    )
    op.drop_constraint("consumable_records_operator_id_fkey", "consumable_records", type_="foreignkey")
    op.create_foreign_key(
        "consumable_records_operator_id_fkey", "consumable_records", "users",
        ["operator_id"], ["id"]
    )
    op.drop_constraint("consumables_category_id_fkey", "consumables", type_="foreignkey")
    op.create_foreign_key(
        "consumables_category_id_fkey", "consumables", "asset_categories",
        ["category_id"], ["id"]
    )

    # ── 3. Revert server_default ──
    op.alter_column("notifications", "is_read", server_default=None)
    op.alter_column("overtime_requests", "status", server_default=None)
    op.alter_column("expense_requests", "status", server_default=None)

    # ── 2. Drop FK indexes ──
    op.drop_index("ix_workflow_history_operator_id", "workflow_history")
    op.drop_index("ix_workflow_tasks_instance_id", "workflow_tasks")
    op.drop_index("ix_workflow_instances_def_id", "workflow_instances")
    op.drop_index("ix_attendance_records_leave_request_id", "attendance_records")
    op.drop_index("ix_asset_assignments_operator_id", "asset_assignments")
    op.drop_index("ix_asset_assignments_user_id", "asset_assignments")
    op.drop_index("ix_asset_assignments_asset_id", "asset_assignments")
    op.drop_index("ix_assets_current_user_id", "assets")
    op.drop_index("ix_assets_department_id", "assets")
    op.drop_index("ix_assets_category_id", "assets")
    op.drop_index("ix_consumable_records_operator_id", "consumable_records")
    op.drop_index("ix_consumable_records_consumable_id", "consumable_records")
    op.drop_index("ix_consumables_category_id", "consumables")
    op.drop_index("ix_overtime_requests_workflow_instance_id", "overtime_requests")
    op.drop_index("ix_overtime_requests_user_id", "overtime_requests")
    op.drop_index("ix_expense_requests_workflow_instance_id", "expense_requests")
    op.drop_index("ix_expense_requests_user_id", "expense_requests")
    op.drop_index("ix_leave_requests_workflow_instance_id", "leave_requests")
    op.drop_index("ix_media_files_uploaded_by", "media_files")
    op.drop_index("ix_announcements_author_id", "announcements")
    op.drop_index("ix_departments_parent_id", "departments")
    op.drop_index("ix_users_manager_id", "users")
    op.drop_index("ix_users_department_id", "users")

    # ── 1. Drop recreated indexes ──
    op.drop_index("ix_attendance_user_status", "attendance_records")
    op.drop_index("ix_history_instance", "workflow_history")
    op.drop_index("ix_tasks_assignee_status", "workflow_tasks")
    op.drop_index("ix_instances_status", "workflow_instances")
    op.drop_index("ix_instances_initiator", "workflow_instances")
    op.drop_index("ix_leave_requests_user_status", "leave_requests")
    op.drop_index("ix_media_files_type", "media_files")
    op.drop_index("ix_announcements_pinned_published", "announcements")
