import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.announcement import Announcement

logger = logging.getLogger(__name__)


class AnnouncementRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_published(self, page: int, page_size: int) -> tuple[list[Announcement], int]:
        offset = (page - 1) * page_size
        base = select(Announcement).where(Announcement.is_published == True)
        count_result = await self.session.execute(
            select(func.count(Announcement.id)).where(Announcement.is_published == True)
        )
        total = count_result.scalar() or 0

        result = await self.session.execute(
            base.order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_all(self, page: int, page_size: int) -> tuple[list[Announcement], int]:
        offset = (page - 1) * page_size
        count_result = await self.session.execute(
            select(func.count(Announcement.id))
        )
        total = count_result.scalar() or 0

        result = await self.session.execute(
            select(Announcement)
            .order_by(Announcement.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_by_id(self, ann_id: int) -> Announcement | None:
        result = await self.session.execute(
            select(Announcement).where(Announcement.id == ann_id)
        )
        return result.scalar_one_or_none()

    async def create(self, ann: Announcement) -> Announcement:
        self.session.add(ann)
        await self.session.flush()
        return ann

    async def update(self, ann: Announcement) -> Announcement:
        await self.session.flush()
        await self.session.refresh(ann)
        return ann

    async def delete(self, ann: Announcement) -> None:
        await self.session.delete(ann)
        await self.session.flush()
