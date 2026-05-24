import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.overtime_request import OvertimeRequest

logger = logging.getLogger(__name__)


class OvertimeRequestRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, overtime_id: int) -> OvertimeRequest | None:
        result = await self.session.execute(
            select(OvertimeRequest)
            .options(selectinload(OvertimeRequest.user), selectinload(OvertimeRequest.workflow_instance))
            .where(OvertimeRequest.id == overtime_id)
        )
        return result.scalar_one_or_none()

    async def get_by_user(
        self, user_id: int, status: str | None, page: int, page_size: int
    ) -> tuple[list[OvertimeRequest], int]:
        offset = (page - 1) * page_size
        base = select(OvertimeRequest).where(OvertimeRequest.user_id == user_id)
        count_base = select(func.count(OvertimeRequest.id)).where(OvertimeRequest.user_id == user_id)

        if status:
            base = base.where(OvertimeRequest.status == status)
            count_base = count_base.where(OvertimeRequest.status == status)

        count_result = await self.session.execute(count_base)
        total = count_result.scalar() or 0

        result = await self.session.execute(
            base.order_by(OvertimeRequest.created_at.desc()).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total

    async def create(self, overtime: OvertimeRequest) -> OvertimeRequest:
        self.session.add(overtime)
        await self.session.flush()
        return overtime

    async def update(self, overtime: OvertimeRequest) -> OvertimeRequest:
        await self.session.flush()
        await self.session.refresh(overtime)
        return overtime

    async def delete(self, overtime: OvertimeRequest) -> None:
        await self.session.delete(overtime)
        await self.session.flush()
