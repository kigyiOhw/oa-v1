import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.leave_balance import LeaveBalance

logger = logging.getLogger(__name__)


class LeaveBalanceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, balance_id: int) -> LeaveBalance | None:
        result = await self.session.execute(
            select(LeaveBalance).where(LeaveBalance.id == balance_id)
        )
        return result.scalar_one_or_none()

    async def get_by_user_and_year(self, user_id: int, year: int) -> list[LeaveBalance]:
        result = await self.session.execute(
            select(LeaveBalance)
            .where(LeaveBalance.user_id == user_id)
            .where(LeaveBalance.year == year)
            .order_by(LeaveBalance.leave_type)
        )
        return list(result.scalars().all())

    async def create(self, balance: LeaveBalance) -> LeaveBalance:
        self.session.add(balance)
        await self.session.flush()
        return balance

    async def update(self, balance: LeaveBalance) -> LeaveBalance:
        await self.session.flush()
        await self.session.refresh(balance)
        return balance

    async def delete(self, balance: LeaveBalance) -> None:
        await self.session.delete(balance)
        await self.session.flush()
