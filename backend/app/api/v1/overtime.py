import logging

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DBDep, require_permission
from app.core.permissions import Permissions
from app.schemas.overtime import OvertimeCreate, OvertimeOut, OvertimeUpdate, PaginatedOvertimes
from app.services.overtime import OvertimeService

router = APIRouter(prefix="/overtimes", tags=["overtimes"])
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedOvertimes)
async def list_my_overtimes(
    db: DBDep,
    current_user: CurrentUser,
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedOvertimes:
    logger.info("----------overtimes.list_my_overtimes, start, user_id=%s, status=%s, page=%s",
                current_user.id, status_filter, page)
    service = OvertimeService(db)
    items, total = await service.list_my_overtimes(current_user, status_filter, page, page_size)
    for item in items:
        await service.sync_status(item)
    logger.info("----------overtimes.list_my_overtimes, done, user_id=%s, total=%s", current_user.id, total)
    return PaginatedOvertimes(
        items=[OvertimeOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=OvertimeOut, status_code=status.HTTP_201_CREATED)
async def create_draft(
    data: OvertimeCreate,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.OVERTIME_CREATE),
) -> OvertimeOut:
    logger.info("----------overtimes.create_draft, start, user_id=%s", current_user.id)
    service = OvertimeService(db)
    result = await service.create_draft(current_user, data)
    await db.commit()
    logger.info("----------overtimes.create_draft, done, overtime_id=%s, user_id=%s", result.id, current_user.id)
    return result


@router.get("/{overtime_id}", response_model=OvertimeOut)
async def get_overtime(
    overtime_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> OvertimeOut:
    logger.info("----------overtimes.get_overtime, start, overtime_id=%s, user_id=%s", overtime_id, current_user.id)
    service = OvertimeService(db)
    overtime = await service.get_overtime(overtime_id)
    await service.sync_status(overtime)
    if overtime.user_id != current_user.id:
        logger.info("----------overtimes.get_overtime, cross_user_read, overtime_id=%s, owner=%s, requester=%s",
                    overtime_id, overtime.user_id, current_user.id)
        await require_permission(Permissions.OVERTIME_READ)(current_user, db)
    logger.info("----------overtimes.get_overtime, done, overtime_id=%s", overtime_id)
    return overtime


@router.put("/{overtime_id}", response_model=OvertimeOut)
async def update_draft(
    overtime_id: int,
    data: OvertimeUpdate,
    db: DBDep,
    current_user: CurrentUser,
) -> OvertimeOut:
    logger.info("----------overtimes.update_draft, start, overtime_id=%s, user_id=%s", overtime_id, current_user.id)
    service = OvertimeService(db)
    result = await service.update_draft(current_user, overtime_id, data)
    await db.commit()
    logger.info("----------overtimes.update_draft, done, overtime_id=%s", overtime_id)
    return result


@router.delete("/{overtime_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(
    overtime_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> None:
    logger.info("----------overtimes.delete_draft, start, overtime_id=%s, user_id=%s", overtime_id, current_user.id)
    service = OvertimeService(db)
    await service.delete_draft(current_user, overtime_id)
    await db.commit()
    logger.info("----------overtimes.delete_draft, done, overtime_id=%s", overtime_id)


@router.post("/{overtime_id}/submit", response_model=OvertimeOut)
async def submit_overtime(
    overtime_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> OvertimeOut:
    logger.info("----------overtimes.submit_overtime, start, overtime_id=%s, user_id=%s", overtime_id, current_user.id)
    service = OvertimeService(db)
    result = await service.submit(current_user, overtime_id)
    await db.commit()
    logger.info("----------overtimes.submit_overtime, done, overtime_id=%s, instance_id=%s",
                overtime_id, result.workflow_instance_id)
    return result


@router.post("/{overtime_id}/cancel", response_model=OvertimeOut)
async def cancel_overtime(
    overtime_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> OvertimeOut:
    logger.info("----------overtimes.cancel_overtime, start, overtime_id=%s, user_id=%s", overtime_id, current_user.id)
    service = OvertimeService(db)
    result = await service.cancel(current_user, overtime_id)
    await db.commit()
    logger.info("----------overtimes.cancel_overtime, done, overtime_id=%s", overtime_id)
    return result
