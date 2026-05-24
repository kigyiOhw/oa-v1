import logging

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification

logger = logging.getLogger(__name__)


class NotificationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_user(
        self, user_id: int, page: int = 1, page_size: int = 20, unread_only: bool = False
    ) -> tuple[list[Notification], int]:
        base = select(Notification).where(Notification.user_id == user_id)
        count_base = select(func.count(Notification.id)).where(Notification.user_id == user_id)

        if unread_only:
            base = base.where(Notification.is_read == False)
            count_base = count_base.where(Notification.is_read == False)

        total = await self.session.scalar(count_base)
        offset = (page - 1) * page_size
        result = await self.session.execute(
            base.order_by(Notification.created_at.desc()).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total or 0

    async def get_unread_count(self, user_id: int) -> int:
        result = await self.session.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
        )
        return result or 0

    async def create(self, notification: Notification) -> Notification:
        self.session.add(notification)
        await self.session.flush()
        await self.session.refresh(notification)
        return notification

    async def mark_read(self, notification_id: int, user_id: int) -> Notification | None:
        result = await self.session.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(is_read=True)
            .returning(Notification)
        )
        await self.session.flush()
        return result.scalar_one_or_none()

    async def mark_all_read(self, user_id: int) -> int:
        result = await self.session.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)
            .values(is_read=True)
        )
        await self.session.flush()
        return result.rowcount
