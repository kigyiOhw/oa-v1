import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.setting import SettingRepository
from app.schemas.setting import CompanyInfo, QuickLink, QuickLinksUpdate

logger = logging.getLogger(__name__)


class SettingService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = SettingRepository(session)

    async def get_company_info(self) -> CompanyInfo:
        s = await self.repo.get("company_info")
        if not s:
            return CompanyInfo()
        return CompanyInfo(**json.loads(s.value))

    async def update_company_info(self, data: CompanyInfo) -> CompanyInfo:
        await self.repo.set("company_info", data.model_dump_json())
        await self.session.commit()
        logger.info("Company info updated")
        return data

    async def get_quick_links(self) -> list[QuickLink]:
        s = await self.repo.get("quick_links")
        if not s:
            return []
        data = json.loads(s.value)
        return [QuickLink(**item) for item in data]

    async def update_quick_links(self, data: QuickLinksUpdate) -> list[QuickLink]:
        await self.repo.set("quick_links", json.dumps([link.model_dump() for link in data.links]))
        await self.session.commit()
        logger.info("Quick links updated | count=%d", len(data.links))
        return data.links
