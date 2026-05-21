import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.setting import Setting

logger = logging.getLogger(__name__)


class SettingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, key: str) -> Setting | None:
        result = await self.session.execute(
            select(Setting).where(Setting.key == key)
        )
        return result.scalar_one_or_none()

    async def get_all(self) -> list[Setting]:
        result = await self.session.execute(select(Setting))
        return list(result.scalars().all())

    async def set(self, key: str, value: str) -> Setting:
        setting = await self.get(key)
        if setting:
            setting.value = value
            await self.session.flush()
        else:
            setting = Setting(key=key, value=value)
            self.session.add(setting)
            await self.session.flush()
        return setting
