from dataclasses import dataclass
from enum import StrEnum

from app.models.user import User


@dataclass
class AdminScope:
    scope: str  # "global" | "department" | "self"
    dept_id: int | None = None


def get_admin_scope(user: User) -> AdminScope:
    """Determine the user's data visibility scope from their roles."""
    if user.is_superuser:
        return AdminScope(scope="global")

    best_scope = AdminScope(scope="self")
    for role in user.roles:
        rt = role.role_type
        if rt == "super_admin":
            return AdminScope(scope="global")
        if rt == "module_admin":
            if role.admin_scope == "global":
                return AdminScope(scope="global")
            if role.admin_scope == "department" and user.department_id:
                best_scope = AdminScope(scope="department", dept_id=user.department_id)
        if rt == "dept_admin":
            if user.department_id:
                best_scope = AdminScope(scope="department", dept_id=user.department_id)
    return best_scope


def is_super_admin(user: User) -> bool:
    """Check if user has super admin privileges via is_superuser or role_type."""
    if user.is_superuser:
        return True
    return any(r.role_type == "super_admin" for r in user.roles)


class Permissions(StrEnum):
    USER_CREATE = "user:create"
    USER_READ = "user:read"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"
    ROLE_CREATE = "role:create"
    ROLE_READ = "role:read"
    ROLE_UPDATE = "role:update"
    ROLE_DELETE = "role:delete"
    PERMISSION_READ = "permission:read"
    PERMISSION_ASSIGN = "permission:assign"
    DEPT_CREATE = "dept:create"
    DEPT_READ = "dept:read"
    DEPT_UPDATE = "dept:update"
    DEPT_DELETE = "dept:delete"
    WORKFLOW_DEF_CREATE = "workflow_def:create"
    WORKFLOW_DEF_READ = "workflow_def:read"
    WORKFLOW_DEF_UPDATE = "workflow_def:update"
    WORKFLOW_DEF_DELETE = "workflow_def:delete"
    ANNOUNCEMENT_CREATE = "announcement:create"
    ANNOUNCEMENT_READ = "announcement:read"
    ANNOUNCEMENT_UPDATE = "announcement:update"
    ANNOUNCEMENT_DELETE = "announcement:delete"
    MEDIA_UPLOAD = "media:upload"
    MEDIA_READ = "media:read"
    MEDIA_DELETE = "media:delete"
    LEAVE_CREATE = "leave:create"
    LEAVE_READ = "leave:read"
    LEAVE_DELETE = "leave:delete"
    EMPLOYEE_CREATE = "employee:create"
    EMPLOYEE_READ = "employee:read"
    EMPLOYEE_UPDATE = "employee:update"
    EMPLOYEE_DELETE = "employee:delete"
    ASSET_CREATE = "asset:create"
    ASSET_READ = "asset:read"
    ASSET_UPDATE = "asset:update"
    ASSET_DELETE = "asset:delete"
    CONSUMABLE_CREATE = "consumable:create"
    CONSUMABLE_READ = "consumable:read"
    CONSUMABLE_UPDATE = "consumable:update"
    CONSUMABLE_DELETE = "consumable:delete"
    ATTENDANCE_CHECK_IN = "attendance:check-in"
    ATTENDANCE_READ = "attendance:read"
    ATTENDANCE_SUBORDINATES_READ = "attendance:subordinates:read"
    ATTENDANCE_UPDATE = "attendance:update"
    NOTIFICATION_READ = "notification:read"
    CONTACTS_READ = "contacts:read"
    EXPENSE_CREATE = "expense:create"
    EXPENSE_READ = "expense:read"
    EXPENSE_DELETE = "expense:delete"
    OVERTIME_CREATE = "overtime:create"
    OVERTIME_READ = "overtime:read"
    OVERTIME_DELETE = "overtime:delete"
    AUDIT_READ = "audit:read"


ALL_PERMISSIONS: list[str] = [p.value for p in Permissions]
