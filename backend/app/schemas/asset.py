from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ── Asset Category ──

class AssetCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    parent_id: int | None = None
    description: str | None = Field(None, max_length=200)
    sort_order: int = 0


class AssetCategoryUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    parent_id: int | None = None
    description: str | None = Field(None, max_length=200)
    sort_order: int | None = None


class AssetCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    parent_id: int | None = None
    description: str | None = None
    sort_order: int
    created_at: datetime
    children: list["AssetCategoryOut"] = []


# ── Asset ──

class AssetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category_id: int
    department_id: int | None = None
    purchase_date: date | None = None
    purchase_price: Decimal | None = Field(None, max_digits=10, decimal_places=2)
    supplier: str | None = Field(None, max_length=200)
    specification: dict | None = None
    description: str | None = None


class AssetUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    category_id: int | None = None
    department_id: int | None = None
    status: str | None = Field(None, pattern=r"^(in_use|idle|scrapped|repairing)$")
    purchase_date: date | None = None
    purchase_price: Decimal | None = Field(None, max_digits=10, decimal_places=2)
    supplier: str | None = Field(None, max_length=200)
    specification: dict | None = None
    description: str | None = None


class AssetAssignRequest(BaseModel):
    user_id: int


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category_id: int
    asset_code: str
    status: str
    department_id: int | None = None
    current_user_id: int | None = None
    purchase_date: date | None = None
    purchase_price: Decimal | None = None
    supplier: str | None = None
    specification: dict | None = None
    description: str | None = None
    created_at: datetime
    updated_at: datetime
    category: AssetCategoryOut | None = None
    department: dict | None = None


class AssetDetailOut(AssetOut):
    current_user: dict | None = None
    assignments: list["AssetAssignmentOut"] = []


class AssetAssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    asset_id: int
    user_id: int
    action: str
    action_date: date
    notes: str | None = None
    operator_id: int
    created_at: datetime
    user: dict | None = None
    operator: dict | None = None


class PaginatedAssets(BaseModel):
    items: list[AssetOut]
    total: int
    page: int
    page_size: int
