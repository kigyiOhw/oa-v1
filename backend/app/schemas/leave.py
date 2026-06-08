from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class LeaveCreate(BaseModel):
    leave_type: str = Field(..., min_length=1, max_length=20)
    start_date: date
    end_date: date
    duration_days: float = Field(..., ge=0.5)
    half_day: str | None = Field(None, pattern=r"^(am|pm)$")
    reason: str = Field(..., min_length=1, max_length=2000)


class LeaveUpdate(BaseModel):
    leave_type: str | None = Field(None, max_length=20)
    start_date: date | None = None
    end_date: date | None = None
    duration_days: float | None = Field(None, ge=0.5)
    half_day: str | None = Field(None, pattern=r"^(am|pm)$")
    reason: str | None = Field(None, max_length=2000)


class LeaveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    workflow_instance_id: int | None = None
    leave_type: str
    start_date: date
    end_date: date
    duration_days: float
    half_day: str | None = None
    reason: str
    status: str
    created_at: datetime
    updated_at: datetime


class PaginatedLeaves(BaseModel):
    items: list[LeaveOut]
    total: int
    page: int
    page_size: int
