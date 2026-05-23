import logging

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DBDep, require_permission
from app.core.permissions import Permissions, get_admin_scope
from app.schemas.asset import (
    AssetAssignRequest,
    AssetCategoryCreate,
    AssetCategoryOut,
    AssetCategoryUpdate,
    AssetCreate,
    AssetDetailOut,
    AssetOut,
    AssetUpdate,
    PaginatedAssets,
)
from app.services.asset import AssetService

router = APIRouter(tags=["assets"])
cat_router = APIRouter(prefix="/asset-categories", tags=["asset-categories"])
asset_router = APIRouter(prefix="/assets", tags=["assets"])

logger = logging.getLogger(__name__)


# ── Categories ──

@cat_router.get("", response_model=list[AssetCategoryOut])
async def list_categories(db: DBDep) -> list[AssetCategoryOut]:
    service = AssetService(db)
    categories = await service.list_categories()
    return [_build_category_tree(c, categories) for c in categories if c.parent_id is None]


def _build_category_tree(cat, all_cats: list) -> AssetCategoryOut:
    children = [
        _build_category_tree(c, all_cats)
        for c in all_cats
        if c.parent_id == cat.id
    ]
    return AssetCategoryOut(
        id=cat.id, name=cat.name, parent_id=cat.parent_id,
        description=cat.description, sort_order=cat.sort_order,
        created_at=cat.created_at, children=children,
    )


@cat_router.post("", response_model=AssetCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: AssetCategoryCreate,
    db: DBDep,
    _perm: None = require_permission(Permissions.ASSET_CREATE),
) -> AssetCategoryOut:
    service = AssetService(db)
    cat = await service.create_category(data)
    return AssetCategoryOut.model_validate(cat)


@cat_router.put("/{category_id}", response_model=AssetCategoryOut)
async def update_category(
    category_id: int,
    data: AssetCategoryUpdate,
    db: DBDep,
    _perm: None = require_permission(Permissions.ASSET_UPDATE),
) -> AssetCategoryOut:
    service = AssetService(db)
    cat = await service.update_category(category_id, data)
    return AssetCategoryOut.model_validate(cat)


@cat_router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    db: DBDep,
    _perm: None = require_permission(Permissions.ASSET_DELETE),
) -> None:
    service = AssetService(db)
    await service.delete_category(category_id)


# ── Assets ──

@asset_router.get("/my", response_model=list[AssetOut])
async def list_my_assets(db: DBDep, current_user: CurrentUser) -> list[AssetOut]:
    service = AssetService(db)
    assets = await service.list_my_assets(current_user.id)
    return [AssetOut.model_validate(a) for a in assets]


@asset_router.get("", response_model=PaginatedAssets)
async def list_assets(
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ASSET_READ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    category_id: int | None = None,
    status: str | None = None,
    department_id: int | None = None,
) -> dict:
    scope = get_admin_scope(current_user)
    if scope.scope == "department" and scope.dept_id:
        department_id = scope.dept_id
    service = AssetService(db)
    items, total = await service.list_assets(
        page=page, page_size=page_size, search=search,
        category_id=category_id, status=status, department_id=department_id,
    )
    return {
        "items": [AssetOut.model_validate(a) for a in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@asset_router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def create_asset(
    data: AssetCreate,
    db: DBDep,
    _perm: None = require_permission(Permissions.ASSET_CREATE),
) -> AssetOut:
    service = AssetService(db)
    asset = await service.create_asset(data)
    return AssetOut.model_validate(asset)


@asset_router.get("/{asset_id}", response_model=AssetDetailOut)
async def get_asset(
    asset_id: int,
    db: DBDep,
    _perm: None = require_permission(Permissions.ASSET_READ),
) -> AssetDetailOut:
    service = AssetService(db)
    asset = await service.get_asset(asset_id)
    return AssetDetailOut.model_validate(asset)


@asset_router.put("/{asset_id}", response_model=AssetOut)
async def update_asset(
    asset_id: int,
    data: AssetUpdate,
    db: DBDep,
    _perm: None = require_permission(Permissions.ASSET_UPDATE),
) -> AssetOut:
    service = AssetService(db)
    asset = await service.update_asset(asset_id, data)
    return AssetOut.model_validate(asset)


@asset_router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: int,
    db: DBDep,
    _perm: None = require_permission(Permissions.ASSET_DELETE),
) -> None:
    service = AssetService(db)
    await service.delete_asset(asset_id)


@asset_router.post("/{asset_id}/assign", response_model=AssetDetailOut)
async def assign_asset(
    asset_id: int,
    data: AssetAssignRequest,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ASSET_UPDATE),
) -> AssetDetailOut:
    service = AssetService(db)
    asset = await service.assign(asset_id, data.user_id, current_user.id)
    return AssetDetailOut.model_validate(asset)


@asset_router.post("/{asset_id}/return", response_model=AssetDetailOut)
async def return_asset(
    asset_id: int,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ASSET_UPDATE),
) -> AssetDetailOut:
    service = AssetService(db)
    asset = await service.return_asset(asset_id, current_user.id)
    return AssetDetailOut.model_validate(asset)
