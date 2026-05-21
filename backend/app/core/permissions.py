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


ALL_PERMISSIONS: list[str] = [p.value for p in Permissions]
