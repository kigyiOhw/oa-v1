import logging

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DBDep, require_permission
from app.core.permissions import Permissions
from app.schemas.auth import UserAdminUpdate, UserOut
from app.services.user_admin import UserAdminService

router = APIRouter(prefix="/users", tags=["users"])
logger = logging.getLogger(__name__)


@router.get("", response_model=dict)
async def list_users(
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.USER_READ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
) -> dict:
    service = UserAdminService(db)
    users, total = await service.list_users(page=page, page_size=page_size, search=search)
    return {
        "items": [UserOut.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.USER_READ),
) -> UserOut:
    service = UserAdminService(db)
    return await service.get_user(user_id)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    data: UserAdminUpdate,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.USER_UPDATE),
) -> UserOut:
    service = UserAdminService(db)
    return await service.update_user(
        user_id=user_id,
        email=data.email,
        full_name=data.full_name,
        is_active=data.is_active,
        is_superuser=data.is_superuser,
        department_id=data.department_id,
        role_ids=data.role_ids,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.USER_DELETE),
) -> None:
    service = UserAdminService(db)
    await service.delete_user(user_id)
