import logging

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DBDep, require_permission
from app.core.permissions import Permissions
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentTree, DepartmentUpdate
from app.services.department import DepartmentService

router = APIRouter(prefix="/departments", tags=["departments"])
logger = logging.getLogger(__name__)


@router.get("", response_model=list[DepartmentOut])
async def list_departments(
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.DEPT_READ),
) -> list[DepartmentOut]:
    service = DepartmentService(db)
    departments = await service.get_all()
    return [DepartmentOut.model_validate(d) for d in departments]


@router.get("/tree", response_model=list[DepartmentTree])
async def department_tree(
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.DEPT_READ),
) -> list[DepartmentTree]:
    service = DepartmentService(db)
    return await service.get_tree()


@router.get("/{dept_id}", response_model=DepartmentOut)
async def get_department(
    dept_id: int,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.DEPT_READ),
) -> DepartmentOut:
    service = DepartmentService(db)
    return await service.get_by_id(dept_id)


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    data: DepartmentCreate,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.DEPT_CREATE),
) -> DepartmentOut:
    service = DepartmentService(db)
    return await service.create(
        name=data.name,
        parent_id=data.parent_id,
        description=data.description,
        sort_order=data.sort_order,
    )


@router.put("/{dept_id}", response_model=DepartmentOut)
async def update_department(
    dept_id: int,
    data: DepartmentUpdate,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.DEPT_UPDATE),
) -> DepartmentOut:
    service = DepartmentService(db)
    return await service.update(
        dept_id=dept_id,
        name=data.name,
        parent_id=data.parent_id,
        description=data.description,
        sort_order=data.sort_order,
    )


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    dept_id: int,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.DEPT_DELETE),
) -> None:
    service = DepartmentService(db)
    await service.delete(dept_id)
