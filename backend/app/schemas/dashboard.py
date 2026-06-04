from pydantic import BaseModel


class OrgOverview(BaseModel):
    total_users: int
    total_departments: int
    users_by_department: list[dict]  # [{dept_name, count}, ...]


class LeaveStats(BaseModel):
    total_this_month: int
    by_type: dict[str, int]  # {annual: 5, sick: 2, ...}
    by_status: dict[str, int]  # {approved: 3, pending: 4, ...}


class AssetOverview(BaseModel):
    total: int
    by_status: dict[str, int]  # {idle: 10, in_use: 25, scrapped: 3}


class WorkflowStats(BaseModel):
    pending_tasks: int
    initiated: int
    processed: int


class AttendanceOverview(BaseModel):
    work_days: int
    late_count: int
    early_count: int
    absent_count: int
    leave_count: int


class DashboardStats(BaseModel):
    org: OrgOverview | None = None       # null for regular users
    leave: LeaveStats
    asset: AssetOverview | None = None   # null for regular users
    workflow: WorkflowStats
    attendance: AttendanceOverview | None = None  # null for unauthenticated
