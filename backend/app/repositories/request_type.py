import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.request_type import RequestType

logger = logging.getLogger(__name__)


class RequestTypeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, type_id: int) -> RequestType | None:
        result = await self.session.execute(
            select(RequestType).where(RequestType.id == type_id)
        )
        return result.scalar_one_or_none()

    async def list_by_module(self, module: str) -> list[RequestType]:
        result = await self.session.execute(
            select(RequestType)
            .where(RequestType.module == module)
            .where(RequestType.is_active.is_(True))
            .order_by(RequestType.sort_order, RequestType.name)
        )
        return list(result.scalars().all())

    async def list_all(self) -> list[RequestType]:
        result = await self.session.execute(
            select(RequestType).order_by(RequestType.module, RequestType.sort_order, RequestType.name)
        )
        return list(result.scalars().all())

    async def create(self, request_type: RequestType) -> RequestType:
        self.session.add(request_type)
        await self.session.flush()
        return request_type

    async def update(self, request_type: RequestType) -> RequestType:
        await self.session.flush()
        await self.session.refresh(request_type)
        return request_type

    async def delete(self, request_type: RequestType) -> None:
        await self.session.delete(request_type)
        await self.session.flush()
