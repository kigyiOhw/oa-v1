import logging

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DBDep, require_permission
from app.core.permissions import Permissions
from app.schemas.consumable import (
    ConsumableCreate,
    ConsumableDetailOut,
    ConsumableOut,
    ConsumableUpdate,
    PaginatedConsumables,
    StockRequest,
)
from app.services.consumable import ConsumableService

router = APIRouter(prefix="/consumables", tags=["consumables"])

logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedConsumables)
async def list_consumables(
    db: DBDep,
    _perm: None = require_permission(Permissions.CONSUMABLE_READ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    category_id: int | None = None,
) -> dict:
    service = ConsumableService(db)
    items, total = await service.list_consumables(
        page=page, page_size=page_size, search=search, category_id=category_id,
    )
    return {
        "items": [ConsumableOut.model_validate(c) for c in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", response_model=ConsumableOut, status_code=status.HTTP_201_CREATED)
async def create_consumable(
    data: ConsumableCreate,
    db: DBDep,
    _perm: None = require_permission(Permissions.CONSUMABLE_CREATE),
) -> ConsumableOut:
    service = ConsumableService(db)
    c = await service.create_consumable(data)
    return ConsumableOut.model_validate(c)


@router.get("/{consumable_id}", response_model=ConsumableDetailOut)
async def get_consumable(
    consumable_id: int,
    db: DBDep,
    _perm: None = require_permission(Permissions.CONSUMABLE_READ),
) -> ConsumableDetailOut:
    service = ConsumableService(db)
    c = await service.get_consumable(consumable_id)
    return ConsumableDetailOut.model_validate(c)


@router.put("/{consumable_id}", response_model=ConsumableOut)
async def update_consumable(
    consumable_id: int,
    data: ConsumableUpdate,
    db: DBDep,
    _perm: None = require_permission(Permissions.CONSUMABLE_UPDATE),
) -> ConsumableOut:
    service = ConsumableService(db)
    c = await service.update_consumable(consumable_id, data)
    return ConsumableOut.model_validate(c)


@router.delete("/{consumable_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_consumable(
    consumable_id: int,
    db: DBDep,
    _perm: None = require_permission(Permissions.CONSUMABLE_DELETE),
) -> None:
    service = ConsumableService(db)
    await service.delete_consumable(consumable_id)


@router.post("/{consumable_id}/stock-in", response_model=ConsumableDetailOut)
async def stock_in(
    consumable_id: int,
    data: StockRequest,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.CONSUMABLE_UPDATE),
) -> ConsumableDetailOut:
    service = ConsumableService(db)
    c = await service.stock_in(consumable_id, data, current_user.id)
    return ConsumableDetailOut.model_validate(c)


@router.post("/{consumable_id}/stock-out", response_model=ConsumableDetailOut)
async def stock_out(
    consumable_id: int,
    data: StockRequest,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.CONSUMABLE_UPDATE),
) -> ConsumableDetailOut:
    service = ConsumableService(db)
    c = await service.stock_out(consumable_id, data, current_user.id)
    return ConsumableDetailOut.model_validate(c)
