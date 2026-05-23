from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class LeaveCreate(BaseModel):
    leave_type: str = Field(..., min_length=1, max_length=20)
    start_date: date
    end_date: date
    duration_days: int = Field(..., ge=1)
    reason: str = Field(..., min_length=1, max_length=2000)


class LeaveUpdate(BaseModel):
    leave_type: str | None = Field(None, max_length=20)
    start_date: date | None = None
    end_date: date | None = None
    duration_days: int | None = Field(None, ge=1)
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
    reason: str
    status: str
    created_at: datetime
    updated_at: datetime


class PaginatedLeaves(BaseModel):
    items: list[LeaveOut]
    total: int
    page: int
    page_size: int
