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

    async def count_by_type_this_month(
        self, year: int, month: int, user_id: int | None = None, dept_id: int | None = None
    ) -> dict[str, int]:
        base = select(LeaveRequest.leave_type, func.count(LeaveRequest.id)).where(
            func.extract("year", LeaveRequest.created_at) == year,
            func.extract("month", LeaveRequest.created_at) == month,
        )
        if user_id is not None:
            base = base.where(LeaveRequest.user_id == user_id)
        if dept_id is not None:
            from app.models.user import User
            base = base.join(User, LeaveRequest.user_id == User.id).where(User.department_id == dept_id)
        rows = (await self.session.execute(base.group_by(LeaveRequest.leave_type))).all()
        return {row[0]: row[1] for row in rows}

    async def count_by_status_this_month(
        self, year: int, month: int, user_id: int | None = None, dept_id: int | None = None
    ) -> dict[str, int]:
        base = select(LeaveRequest.status, func.count(LeaveRequest.id)).where(
            func.extract("year", LeaveRequest.created_at) == year,
            func.extract("month", LeaveRequest.created_at) == month,
        )
        if user_id is not None:
            base = base.where(LeaveRequest.user_id == user_id)
        if dept_id is not None:
            from app.models.user import User
            base = base.join(User, LeaveRequest.user_id == User.id).where(User.department_id == dept_id)
        rows = (await self.session.execute(base.group_by(LeaveRequest.status))).all()
        return {row[0]: row[1] for row in rows}

    async def count_total_this_month(
        self, year: int, month: int, user_id: int | None = None, dept_id: int | None = None
    ) -> int:
        base = select(func.count(LeaveRequest.id)).where(
            func.extract("year", LeaveRequest.created_at) == year,
            func.extract("month", LeaveRequest.created_at) == month,
        )
        if user_id is not None:
            base = base.where(LeaveRequest.user_id == user_id)
        if dept_id is not None:
            from app.models.user import User
            base = base.join(User, LeaveRequest.user_id == User.id).where(User.department_id == dept_id)
        return (await self.session.execute(base)).scalar() or 0

    async def delete(self, leave: LeaveRequest) -> None:
        await self.session.delete(leave)
        await self.session.flush()
