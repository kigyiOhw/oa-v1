from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class AttendanceConfigSchema(BaseModel):
    work_start_time: str = Field(default="09:00")
    work_end_time: str = Field(default="18:00")
    late_tolerance_minutes: int = Field(default=0, ge=0)
    enable_mandatory_check_in: bool = False


class CheckInRequest(BaseModel):
    pass


class CheckOutRequest(BaseModel):
    pass


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    record_date: date
    check_in_time: datetime | None = None
    check_out_time: datetime | None = None
    status: str
    source: str
    leave_request_id: int | None = None
    created_at: datetime
    updated_at: datetime


class MonthlySummary(BaseModel):
    year: int
    month: int
    total_days: int
    normal_days: int
    late_days: int
    early_days: int
    absent_days: int
    leave_days: int
    business_trip_days: int


class TeamMemberSummary(BaseModel):
    user_id: int
    username: str
    full_name: str | None = None
    department_name: str | None = None
    summary: MonthlySummary


class TeamMemberDetail(BaseModel):
    user_id: int
    username: str
    full_name: str | None = None
    email: str
    department_name: str | None = None
    phone: str | None = None
    join_date: date | None = None
    employment_status: str | None = None
    summary: MonthlySummary
    recent_leaves: list[dict]  # simplified leave records


class PaginatedAttendance(BaseModel):
    items: list[AttendanceOut]
    total: int
    page: int
    page_size: int
