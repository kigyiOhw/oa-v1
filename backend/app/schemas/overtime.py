from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OvertimeCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    duration_hours: float = Field(..., gt=0)
    reason: str = Field(..., min_length=1, max_length=2000)


class OvertimeUpdate(BaseModel):
    start_time: datetime | None = None
    end_time: datetime | None = None
    duration_hours: float | None = Field(None, gt=0)
    reason: str | None = Field(None, max_length=2000)


class OvertimeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    workflow_instance_id: int | None = None
    start_time: datetime
    end_time: datetime
    duration_hours: float
    reason: str
    status: str
    created_at: datetime
    updated_at: datetime


class PaginatedOvertimes(BaseModel):
    items: list[OvertimeOut]
    total: int
    page: int
    page_size: int
