from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ExpenseCreate(BaseModel):
    expense_type: str = Field(..., min_length=1, max_length=20)
    amount: float = Field(..., gt=0)
    description: str = Field(..., min_length=1, max_length=2000)
    attachment_urls: list[str] | None = None


class ExpenseUpdate(BaseModel):
    expense_type: str | None = Field(None, max_length=20)
    amount: float | None = Field(None, gt=0)
    description: str | None = Field(None, max_length=2000)
    attachment_urls: list[str] | None = None


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    workflow_instance_id: int | None = None
    expense_type: str
    amount: float
    description: str
    attachment_urls: list[str] | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class PaginatedExpenses(BaseModel):
    items: list[ExpenseOut]
    total: int
    page: int
    page_size: int
