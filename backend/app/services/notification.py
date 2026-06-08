import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.notification import Notification
from app.models.user import User
from app.repositories.notification import NotificationRepository
from app.schemas.notification import NotificationOut

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = NotificationRepository(session)

    async def list_notifications(
        self, user: User, page: int, page_size: int, unread_only: bool = False
    ) -> tuple[list[Notification], int]:
        return await self.repo.get_by_user(user.id, page, page_size, unread_only)

    async def get_unread_count(self, user: User) -> int:
        return await self.repo.get_unread_count(user.id)

    async def mark_read(self, notification_id: int, user: User) -> Notification:
        # Verify ownership first
        notif = await self.repo.get_by_id(notification_id)
        if not notif:
            raise OAException("Notification not found", status_code=404)
        if notif.user_id != user.id:
            raise OAException("Access denied", status_code=403)
        notif = await self.repo.mark_read(notification_id)
        await self.session.commit()
        return notif

    async def mark_all_read(self, user: User) -> int:
        count = await self.repo.mark_all_read(user.id)
        await self.session.commit()
        return count

    async def delete(self, notification_id: int, user: User) -> None:
        notif = await self.repo.get_by_id(notification_id)
        if not notif:
            raise OAException("Notification not found", status_code=404)
        if notif.user_id != user.id:
            raise OAException("Access denied", status_code=403)
        await self.repo.delete(notif)
        await self.session.commit()

    @staticmethod
    async def send_notification(
        session: AsyncSession,
        user_id: int,
        type_: str,
        title: str,
        message: str,
        reference_type: str | None = None,
        reference_id: int | None = None,
    ) -> Notification:
        """Persist notification and push via WebSocket (best-effort)."""
        repo = NotificationRepository(session)
        notif = Notification(
            user_id=user_id,
            type=type_,
            title=title,
            message=message,
            reference_type=reference_type,
            reference_id=reference_id,
        )
        notif = await repo.create(notif)
        await session.commit()

        try:
            from app.api.v1.websocket import manager
            await manager.send_to_user(user_id, {
                "type": "notification",
                "payload": NotificationOut.model_validate(notif).model_dump(mode="json"),
            })
        except Exception:
            logger.debug("WebSocket send failed for user_id=%s (offline)", user_id)

        return notif
