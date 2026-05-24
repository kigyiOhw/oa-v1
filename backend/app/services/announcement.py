import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.announcement import Announcement
from app.models.user import User
from app.repositories.announcement import AnnouncementRepository
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate
from app.services.notification import NotificationService

logger = logging.getLogger(__name__)


class AnnouncementService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = AnnouncementRepository(session)

    async def get_published(self, page: int, page_size: int):
        return await self.repo.get_published(page, page_size)

    async def get_all(self, page: int, page_size: int):
        return await self.repo.get_all(page, page_size)

    async def get_by_id(self, ann_id: int) -> Announcement:
        ann = await self.repo.get_by_id(ann_id)
        if not ann:
            raise OAException("Announcement not found", status_code=404)
        return ann

    async def create(self, data: AnnouncementCreate, author: User) -> Announcement:
        ann = Announcement(
            title=data.title,
            content=data.content,
            author_id=author.id,
            is_pinned=data.is_pinned,
            is_published=False,
        )
        ann = await self.repo.create(ann)
        logger.info("Announcement created | id=%d title=%s", ann.id, ann.title)
        return ann

    async def update(self, ann_id: int, data: AnnouncementUpdate) -> Announcement:
        ann = await self.get_by_id(ann_id)
        if data.title is not None:
            ann.title = data.title
        if data.content is not None:
            ann.content = data.content
        if data.is_pinned is not None:
            ann.is_pinned = data.is_pinned
        if data.is_published is not None:
            was_new_publish = data.is_published and not ann.published_at
            if data.is_published and not ann.published_at:
                ann.published_at = datetime.now(timezone.utc)
            ann.is_published = data.is_published
        ann = await self.repo.update(ann)
        logger.info("Announcement updated | id=%d", ann.id)

        if data.is_published is not None and was_new_publish:
            users = (await self.session.execute(
                select(User).where(User.is_active == True)
            )).scalars().all()
            for u in users:
                if u.id != ann.author_id:
                    await NotificationService.send_notification(
                        self.session,
                        user_id=u.id,
                        type_="announcement",
                        title="New Announcement",
                        message=ann.title,
                        reference_type="announcement",
                        reference_id=ann.id,
                    )
        return ann

    async def delete(self, ann_id: int) -> None:
        ann = await self.get_by_id(ann_id)
        await self.repo.delete(ann)
        logger.info("Announcement deleted | id=%d", ann_id)
