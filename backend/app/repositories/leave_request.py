import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.leave_request import LeaveRequest

logger = logging.getLogger(__name__)


class LeaveRequestRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, leave_id: int) -> LeaveRequest | None:
        result = await self.session.execute(
            select(LeaveRequest)
            .options(selectinload(LeaveRequest.user), selectinload(LeaveRequest.workflow_instance))
            .where(LeaveRequest.id == leave_id)
        )
        return result.scalar_one_or_none()

    async def get_by_user(
        self, user_id: int, status: str | None, page: int, page_size: int
    ) -> tuple[list[LeaveRequest], int]:
        offset = (page - 1) * page_size
        base = select(LeaveRequest).where(LeaveRequest.user_id == user_id)
        count_base = select(func.count(LeaveRequest.id)).where(LeaveRequest.user_id == user_id)

        if status:
            base = base.where(LeaveRequest.status == status)
            count_base = count_base.where(LeaveRequest.status == status)

        count_result = await self.session.execute(count_base)
        total = count_result.scalar() or 0

        result = await self.session.execute(
            base.order_by(LeaveRequest.created_at.desc()).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total

    async def create(self, leave: LeaveRequest) -> LeaveRequest:
        self.session.add(leave)
        await self.session.flush()
        return leave

    async def update(self, leave: LeaveRequest) -> LeaveRequest:
        await self.session.flush()
        await self.session.refresh(leave)
        return leave

    async def delete(self, leave: LeaveRequest) -> None:
        await self.session.delete(leave)
        await self.session.flush()
