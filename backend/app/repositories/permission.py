import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Permission

logger = logging.getLogger(__name__)


class PermissionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all(self) -> list[Permission]:
        result = await self.session.execute(select(Permission).order_by(Permission.code))
        return list(result.scalars().all())

    async def get_by_codes(self, codes: list[str]) -> list[Permission]:
        result = await self.session.execute(
            select(Permission).where(Permission.code.in_(codes))
        )
        return list(result.scalars().all())
