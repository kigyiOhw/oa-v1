import logging

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBDep
from app.schemas.notification import NotificationOut, PaginatedNotifications, UnreadCountOut
from app.services.notification import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedNotifications)
async def list_notifications(
    db: DBDep,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
) -> PaginatedNotifications:
    logger.info(
        "----------notifications.list, user_id=%s, page=%s, unread_only=%s",
        current_user.id, page, unread_only,
    )
    service = NotificationService(db)
    items, total = await service.list_notifications(current_user, page, page_size, unread_only)
    logger.info("----------notifications.list, done, user_id=%s, total=%s", current_user.id, total)
    return PaginatedNotifications(
        items=[NotificationOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(
    db: DBDep,
    current_user: CurrentUser,
) -> UnreadCountOut:
    service = NotificationService(db)
    count = await service.get_unread_count(current_user)
    return UnreadCountOut(count=count)


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> NotificationOut:
    logger.info(
        "----------notifications.mark_read, user_id=%s, notif_id=%s",
        current_user.id, notification_id,
    )
    service = NotificationService(db)
    notif = await service.mark_read(notification_id, current_user)
    return NotificationOut.model_validate(notif)


@router.post("/read-all", response_model=UnreadCountOut)
async def mark_all_read(
    db: DBDep,
    current_user: CurrentUser,
) -> UnreadCountOut:
    logger.info("----------notifications.mark_all_read, user_id=%s", current_user.id)
    service = NotificationService(db)
    count = await service.mark_all_read(current_user)
    return UnreadCountOut(count=count)
