import logging

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DBDep, require_permission
from app.core.permissions import Permissions, get_admin_scope
from app.schemas.employee import (
    EmployeeProfileAdminUpdate,
    EmployeeProfileMyUpdate,
    EmployeeProfileOut,
    OnboardingRequest,
    PaginatedEmployees,
    ResignRequest,
)
from app.services.employee import EmployeeService

router = APIRouter(prefix="/employees", tags=["employees"])
logger = logging.getLogger(__name__)


# ── Self-service endpoints (login required, no extra permission) ──

@router.get("/me", response_model=EmployeeProfileOut)
async def get_my_profile(
    db: DBDep,
    current_user: CurrentUser,
) -> EmployeeProfileOut:
    service = EmployeeService(db)
    profile = await service.get_my_profile(current_user)
    return EmployeeProfileOut.from_profile(profile)


@router.put("/me", response_model=EmployeeProfileOut)
async def update_my_profile(
    data: EmployeeProfileMyUpdate,
    db: DBDep,
    current_user: CurrentUser,
) -> EmployeeProfileOut:
    service = EmployeeService(db)
    profile = await service.update_my_profile(current_user, data)
    return EmployeeProfileOut.from_profile(profile)


@router.post("/me/onboarding", response_model=EmployeeProfileOut)
async def complete_onboarding(
    data: OnboardingRequest,
    db: DBDep,
    current_user: CurrentUser,
) -> EmployeeProfileOut:
    service = EmployeeService(db)
    profile = await service.complete_onboarding(current_user, data)
    return EmployeeProfileOut.from_profile(profile)


# ── Admin endpoints ──

@router.get("", response_model=dict)
async def list_employees(
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.EMPLOYEE_READ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    department_id: int | None = None,
    employment_status: str | None = None,
) -> dict:
    scope = get_admin_scope(current_user)
    if scope.scope == "department" and scope.dept_id:
        department_id = scope.dept_id
    service = EmployeeService(db)
    profiles, total = await service.admin_get_all(
        page=page, page_size=page_size,
        search=search, department_id=department_id,
        employment_status=employment_status,
    )
    return {
        "items": [EmployeeProfileOut.from_profile(p) for p in profiles],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{profile_id}", response_model=EmployeeProfileOut)
async def get_employee(
    profile_id: int,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.EMPLOYEE_READ),
) -> EmployeeProfileOut:
    service = EmployeeService(db)
    profile = await service.admin_get(profile_id)
    return EmployeeProfileOut.from_profile(profile)


@router.put("/{profile_id}", response_model=EmployeeProfileOut)
async def update_employee(
    profile_id: int,
    data: EmployeeProfileAdminUpdate,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.EMPLOYEE_UPDATE),
) -> EmployeeProfileOut:
    service = EmployeeService(db)
    profile = await service.admin_update(profile_id, data)
    return EmployeeProfileOut.from_profile(profile)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    profile_id: int,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.EMPLOYEE_DELETE),
) -> None:
    service = EmployeeService(db)
    await service.admin_delete(profile_id)


@router.post("/{profile_id}/resign", response_model=EmployeeProfileOut)
async def resign_employee(
    profile_id: int,
    data: ResignRequest,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.EMPLOYEE_UPDATE),
) -> EmployeeProfileOut:
    service = EmployeeService(db)
    profile = await service.resign(profile_id, data)
    return EmployeeProfileOut.from_profile(profile)
