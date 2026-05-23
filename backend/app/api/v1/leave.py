import logging

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DBDep, require_permission
from app.core.permissions import Permissions
from app.schemas.leave import LeaveCreate, LeaveOut, LeaveUpdate, PaginatedLeaves
from app.services.leave import LeaveService

router = APIRouter(prefix="/leaves", tags=["leaves"])
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedLeaves)
async def list_my_leaves(
    db: DBDep,
    current_user: CurrentUser,
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedLeaves:
    logger.info("----------leaves.list_my_leaves, start, user_id=%s, status=%s, page=%s",
                current_user.id, status_filter, page)
    service = LeaveService(db)
    items, total = await service.list_my_leaves(current_user, status_filter, page, page_size)
    for item in items:
        await service.sync_status(item)
    logger.info("----------leaves.list_my_leaves, done, user_id=%s, total=%s", current_user.id, total)
    return PaginatedLeaves(
        items=[LeaveOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=LeaveOut, status_code=status.HTTP_201_CREATED)
async def create_draft(
    data: LeaveCreate,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.LEAVE_CREATE),
) -> LeaveOut:
    logger.info("----------leaves.create_draft, start, user_id=%s, type=%s", current_user.id, data.leave_type)
    service = LeaveService(db)
    result = await service.create_draft(current_user, data)
    logger.info("----------leaves.create_draft, done, leave_id=%s, user_id=%s", result.id, current_user.id)
    return result


@router.get("/{leave_id}", response_model=LeaveOut)
async def get_leave(
    leave_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> LeaveOut:
    logger.info("----------leaves.get_leave, start, leave_id=%s, user_id=%s", leave_id, current_user.id)
    service = LeaveService(db)
    leave = await service.get_leave(leave_id)
    await service.sync_status(leave)
    if leave.user_id != current_user.id:
        logger.info("----------leaves.get_leave, cross_user_read, leave_id=%s, owner=%s, requester=%s",
                    leave_id, leave.user_id, current_user.id)
        await require_permission(Permissions.LEAVE_READ)(current_user, db)
    logger.info("----------leaves.get_leave, done, leave_id=%s", leave_id)
    return leave


@router.put("/{leave_id}", response_model=LeaveOut)
async def update_draft(
    leave_id: int,
    data: LeaveUpdate,
    db: DBDep,
    current_user: CurrentUser,
) -> LeaveOut:
    logger.info("----------leaves.update_draft, start, leave_id=%s, user_id=%s", leave_id, current_user.id)
    service = LeaveService(db)
    result = await service.update_draft(current_user, leave_id, data)
    logger.info("----------leaves.update_draft, done, leave_id=%s", leave_id)
    return result


@router.delete("/{leave_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(
    leave_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> None:
    logger.info("----------leaves.delete_draft, start, leave_id=%s, user_id=%s", leave_id, current_user.id)
    service = LeaveService(db)
    await service.delete_draft(current_user, leave_id)
    logger.info("----------leaves.delete_draft, done, leave_id=%s", leave_id)


@router.post("/{leave_id}/submit", response_model=LeaveOut)
async def submit_leave(
    leave_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> LeaveOut:
    logger.info("----------leaves.submit_leave, start, leave_id=%s, user_id=%s", leave_id, current_user.id)
    service = LeaveService(db)
    result = await service.submit(current_user, leave_id)
    logger.info("----------leaves.submit_leave, done, leave_id=%s, instance_id=%s", leave_id, result.workflow_instance_id)
    return result


@router.post("/{leave_id}/cancel", response_model=LeaveOut)
async def cancel_leave(
    leave_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> LeaveOut:
    logger.info("----------leaves.cancel_leave, start, leave_id=%s, user_id=%s", leave_id, current_user.id)
    service = LeaveService(db)
    result = await service.cancel(current_user, leave_id)
    logger.info("----------leaves.cancel_leave, done, leave_id=%s", leave_id)
    return result
