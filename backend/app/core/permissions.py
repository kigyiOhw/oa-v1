from enum import StrEnum


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


ALL_PERMISSIONS: list[str] = [p.value for p in Permissions]
