import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.expense_request import ExpenseRequest

logger = logging.getLogger(__name__)


class ExpenseRequestRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, expense_id: int) -> ExpenseRequest | None:
        result = await self.session.execute(
            select(ExpenseRequest)
            .options(selectinload(ExpenseRequest.user), selectinload(ExpenseRequest.workflow_instance))
            .where(ExpenseRequest.id == expense_id)
        )
        return result.scalar_one_or_none()

    async def get_by_user(
        self, user_id: int, status: str | None, page: int, page_size: int
    ) -> tuple[list[ExpenseRequest], int]:
        offset = (page - 1) * page_size
        base = select(ExpenseRequest).where(ExpenseRequest.user_id == user_id)
        count_base = select(func.count(ExpenseRequest.id)).where(ExpenseRequest.user_id == user_id)

        if status:
            base = base.where(ExpenseRequest.status == status)
            count_base = count_base.where(ExpenseRequest.status == status)

        count_result = await self.session.execute(count_base)
        total = count_result.scalar() or 0

        result = await self.session.execute(
            base.order_by(ExpenseRequest.created_at.desc()).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total

    async def create(self, expense: ExpenseRequest) -> ExpenseRequest:
        self.session.add(expense)
        await self.session.flush()
        return expense

    async def update(self, expense: ExpenseRequest) -> ExpenseRequest:
        await self.session.flush()
        await self.session.refresh(expense)
        return expense

    async def delete(self, expense: ExpenseRequest) -> None:
        await self.session.delete(expense)
        await self.session.flush()
