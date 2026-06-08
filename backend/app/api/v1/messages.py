import logging

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBDep
from app.schemas.message import (
    MessageDetailOut,
    MessageOut,
    MessageSend,
    PaginatedMessages,
    UnreadMessageCountOut,
)
from app.services.message import MessageService

router = APIRouter(prefix="/messages", tags=["messages"])
logger = logging.getLogger(__name__)


@router.get("/inbox", response_model=PaginatedMessages)
async def list_inbox(
    db: DBDep,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedMessages:
    logger.info(
        "----------messages.inbox, user_id=%s, page=%s",
        current_user.id, page,
    )
    service = MessageService(db)
    items, total = await service.get_inbox(current_user, page, page_size)
    return PaginatedMessages(
        items=[MessageOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/sent", response_model=PaginatedMessages)
async def list_sent(
    db: DBDep,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedMessages:
    logger.info(
        "----------messages.sent, user_id=%s, page=%s",
        current_user.id, page,
    )
    service = MessageService(db)
    items, total = await service.get_sent(current_user, page, page_size)
    return PaginatedMessages(
        items=[MessageOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/unread-count", response_model=UnreadMessageCountOut)
async def unread_count(
    db: DBDep,
    current_user: CurrentUser,
) -> UnreadMessageCountOut:
    service = MessageService(db)
    count = await service.get_unread_count(current_user)
    return UnreadMessageCountOut(count=count)


@router.post("", response_model=MessageOut, status_code=201)
async def send_message(
    data: MessageSend,
    db: DBDep,
    current_user: CurrentUser,
) -> MessageOut:
    logger.info(
        "----------messages.send, sender_id=%s, recipient_id=%s",
        current_user.id, data.recipient_id,
    )
    service = MessageService(db)
    msg = await service.send_message(current_user, data)
    return MessageOut.model_validate(msg)


@router.get("/{message_id}", response_model=MessageDetailOut)
async def get_message(
    message_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> MessageDetailOut:
    logger.info(
        "----------messages.get, message_id=%s, user_id=%s",
        message_id, current_user.id,
    )
    service = MessageService(db)
    msg = await service.get_message(message_id, current_user)
    detail = MessageDetailOut.model_validate(msg)
    # Populate usernames from loaded relationships (may be lazy-loaded)
    if msg.sender:
        detail.sender_username = msg.sender.username
    if msg.recipient:
        detail.recipient_username = msg.recipient.username
    return detail


@router.post("/{message_id}/read", response_model=MessageOut)
async def mark_read(
    message_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> MessageOut:
    logger.info(
        "----------messages.mark_read, message_id=%s, user_id=%s",
        message_id, current_user.id,
    )
    service = MessageService(db)
    msg = await service.mark_read(message_id, current_user)
    return MessageOut.model_validate(msg)


@router.delete("/{message_id}")
async def delete_message(
    message_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> dict:
    logger.info(
        "----------messages.delete, message_id=%s, user_id=%s",
        message_id, current_user.id,
    )
    service = MessageService(db)
    await service.delete_message(message_id, current_user)
    return {"ok": True}
