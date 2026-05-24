import logging

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBDep, require_permission
from app.schemas.attendance import (
    AttendanceConfigSchema,
    AttendanceOut,
    PaginatedAttendance,
    TeamMemberSummary,
)
from app.services.attendance import AttendanceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attendance", tags=["attendance"])


# -- self-service --

@router.post("/check-in", response_model=dict)
async def check_in(
    db: DBDep,
    current_user: CurrentUser,
    _: None = require_permission("attendance:check-in"),
):
    service = AttendanceService(db)
    record = await service.check_in(current_user)
    data = AttendanceOut.model_validate(record).model_dump()
    return {"success": True, "data": data, "error": None}


@router.post("/check-out", response_model=dict)
async def check_out(
    db: DBDep,
    current_user: CurrentUser,
    _: None = require_permission("attendance:check-in"),
):
    service = AttendanceService(db)
    record = await service.check_out(current_user)
    data = AttendanceOut.model_validate(record).model_dump()
    return {"success": True, "data": data, "error": None}


@router.get("/me", response_model=dict)
async def get_my_records(
    db: DBDep,
    current_user: CurrentUser,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: None = require_permission("attendance:read"),
):
    service = AttendanceService(db)
    items, total = await service.get_my_records(current_user, year, month, page, page_size)
    data = PaginatedAttendance(
        items=[AttendanceOut.model_validate(r).model_dump() for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )
    return {"success": True, "data": data.model_dump(), "error": None}


@router.get("/me/summary", response_model=dict)
async def get_my_summary(
    db: DBDep,
    current_user: CurrentUser,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    _: None = require_permission("attendance:read"),
):
    service = AttendanceService(db)
    result = await service.get_my_summary(current_user, year, month)
    return {"success": True, "data": result.model_dump(), "error": None}


# -- team views --

@router.get("/team", response_model=dict)
async def get_team_summary(
    db: DBDep,
    current_user: CurrentUser,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    _: None = require_permission("attendance:subordinates:read"),
):
    service = AttendanceService(db)
    items = await service.get_team_summary(current_user, year, month)
    result = [TeamMemberSummary(
        user_id=item["user_id"],
        username=item["username"],
        full_name=item["full_name"],
        department_name=item["department_name"],
        summary=item["summary"],
    ).model_dump() for item in items]
    return {"success": True, "data": result, "error": None}


@router.get("/team/{user_id}", response_model=dict)
async def get_team_member_detail(
    user_id: int,
    db: DBDep,
    current_user: CurrentUser,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    _: None = require_permission("attendance:subordinates:read"),
):
    service = AttendanceService(db)
    result = await service.get_team_member_detail(current_user, user_id, year, month)
    return {"success": True, "data": result, "error": None}


@router.get("/team/{user_id}/records", response_model=dict)
async def get_team_member_records(
    user_id: int,
    db: DBDep,
    current_user: CurrentUser,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: None = require_permission("attendance:subordinates:read"),
):
    service = AttendanceService(db)
    items, total = await service.get_team_member_records(
        current_user, user_id, year, month, page, page_size
    )
    data = PaginatedAttendance(
        items=[AttendanceOut.model_validate(r).model_dump() for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )
    return {"success": True, "data": data.model_dump(), "error": None}


@router.get("/team/{user_id}/summary", response_model=dict)
async def get_team_member_summary(
    user_id: int,
    db: DBDep,
    current_user: CurrentUser,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    _: None = require_permission("attendance:subordinates:read"),
):
    service = AttendanceService(db)
    result = await service.get_team_member_summary(current_user, user_id, year, month)
    return {"success": True, "data": result.model_dump(), "error": None}


# -- config --

@router.get("/config", response_model=dict)
async def get_attendance_config(
    db: DBDep,
    current_user: CurrentUser,
    _: None = require_permission("attendance:read"),
):
    service = AttendanceService(db)
    result = await service.get_config()
    return {"success": True, "data": result, "error": None}


@router.put("/config", response_model=dict)
async def update_attendance_config(
    config: AttendanceConfigSchema,
    db: DBDep,
    current_user: CurrentUser,
    _: None = require_permission("attendance:update"),
):
    service = AttendanceService(db)
    result = await service.update_config(config)
    return {"success": True, "data": result, "error": None}
