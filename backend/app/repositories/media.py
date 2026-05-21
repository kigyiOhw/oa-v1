import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.media import MediaFile

logger = logging.getLogger(__name__)


class MediaRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all(self, page: int, page_size: int) -> tuple[list[MediaFile], int]:
        offset = (page - 1) * page_size
        count_result = await self.session.execute(
            select(func.count(MediaFile.id))
        )
        total = count_result.scalar() or 0

        result = await self.session.execute(
            select(MediaFile)
            .order_by(MediaFile.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_by_id(self, media_id: int) -> MediaFile | None:
        result = await self.session.execute(
            select(MediaFile).where(MediaFile.id == media_id)
        )
        return result.scalar_one_or_none()

    async def create(self, media: MediaFile) -> MediaFile:
        self.session.add(media)
        await self.session.flush()
        return media

    async def delete(self, media: MediaFile) -> None:
        await self.session.delete(media)
        await self.session.flush()
