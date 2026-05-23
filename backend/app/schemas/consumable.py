from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ── Consumable ──

class ConsumableCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category_id: int
    unit: str = Field(..., max_length=20)
    safety_stock: Decimal = Field(Decimal("0"), max_digits=10, decimal_places=1)
    description: str | None = None


class ConsumableUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    category_id: int | None = None
    unit: str | None = Field(None, max_length=20)
    safety_stock: Decimal | None = Field(None, max_digits=10, decimal_places=1)
    description: str | None = None


class ConsumableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category_id: int
    unit: str
    current_stock: Decimal
    safety_stock: Decimal
    description: str | None = None
    created_at: datetime
    updated_at: datetime
    category: dict | None = None


class ConsumableDetailOut(ConsumableOut):
    records: list["ConsumableRecordOut"] = []


class StockRequest(BaseModel):
    quantity: Decimal = Field(..., gt=0, max_digits=10, decimal_places=1)
    notes: str | None = Field(None, max_length=500)


class ConsumableRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    consumable_id: int
    type: str
    quantity: Decimal
    operator_id: int
    record_date: date
    notes: str | None = None
    created_at: datetime
    operator: dict | None = None


class PaginatedConsumables(BaseModel):
    items: list[ConsumableOut]
    total: int
    page: int
    page_size: int
