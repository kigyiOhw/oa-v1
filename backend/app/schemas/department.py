from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    parent_id: int | None = None
    description: str | None = Field(None, max_length=200)
    sort_order: int = 0


class DepartmentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    parent_id: int | None = None
    description: str | None = None
    sort_order: int | None = None


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    parent_id: int | None = None
    description: str | None = None
    sort_order: int = 0
    created_at: datetime


class DepartmentTree(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    parent_id: int | None = None
    description: str | None = None
    sort_order: int = 0
    children: list["DepartmentTree"] = []
