import logging

from fastapi import APIRouter, status
from pydantic import BaseModel

from app.api.deps import CurrentUser, DBDep, require_permission
from app.core.permissions import Permissions
from app.schemas.permission import PermissionOut
from app.schemas.role import RoleCreate, RoleOut, RoleUpdate
from app.services.role import RoleService

router = APIRouter(prefix="/roles", tags=["roles"])
logger = logging.getLogger(__name__)

ROLE_TYPES = [
    {"value": "super_admin", "label": "超级管理员", "description": "拥有全部权限，可管理所有模块和部门数据"},
    {"value": "module_admin", "label": "模块管理员", "description": "管理特定模块，可选择全局或部门数据范围"},
    {"value": "dept_admin", "label": "部门管理员", "description": "管理本部门的人员、资产、耗材等"},
    {"value": "user", "label": "普通用户", "description": "个人数据和自助操作"},
]


class AssignPermissionsRequest(BaseModel):
    permission_ids: list[int]


@router.get("/types")
async def list_role_types() -> list[dict[str, str]]:
    return ROLE_TYPES


@router.get("", response_model=list[RoleOut])
async def list_roles(
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ROLE_READ),
) -> list[RoleOut]:
    service = RoleService(db)
    roles = await service.get_all()
    return [RoleOut.model_validate(r) for r in roles]


@router.get("/{role_id}", response_model=RoleOut)
async def get_role(
    role_id: int,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ROLE_READ),
) -> RoleOut:
    service = RoleService(db)
    return await service.get_by_id(role_id)


@router.post("", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    data: RoleCreate,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ROLE_CREATE),
) -> RoleOut:
    service = RoleService(db)
    return await service.create(name=data.name, description=data.description, role_type=data.role_type, admin_scope=data.admin_scope)


@router.put("/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: int,
    data: RoleUpdate,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ROLE_UPDATE),
) -> RoleOut:
    service = RoleService(db)
    return await service.update(role_id=role_id, name=data.name, description=data.description, role_type=data.role_type, admin_scope=data.admin_scope)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: int,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ROLE_DELETE),
) -> None:
    service = RoleService(db)
    await service.delete(role_id)


@router.put("/{role_id}/permissions", response_model=RoleOut)
async def assign_permissions(
    role_id: int,
    data: AssignPermissionsRequest,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.PERMISSION_ASSIGN),
) -> RoleOut:
    service = RoleService(db)
    return await service.assign_permissions(role_id, data.permission_ids)


@router.get("/{role_id}/permissions", response_model=list[PermissionOut])
async def get_role_permissions(
    role_id: int,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ROLE_READ),
) -> list[PermissionOut]:
    service = RoleService(db)
    role = await service.get_by_id(role_id)
    return [PermissionOut.model_validate(p) for p in role.permissions]
