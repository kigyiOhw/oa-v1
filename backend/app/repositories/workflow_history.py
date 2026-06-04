import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.workflow import WorkflowHistory

logger = logging.getLogger(__name__)


class WorkflowHistoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_instance(self, instance_id: int) -> list[WorkflowHistory]:
        result = await self.session.execute(
            select(WorkflowHistory)
            .options(selectinload(WorkflowHistory.operator))
            .where(WorkflowHistory.instance_id == instance_id)
            .order_by(WorkflowHistory.id)
        )
        return list(result.scalars().all())

    async def count_by_operator(self, operator_id: int) -> int:
        result = await self.session.execute(
            select(func.count(WorkflowHistory.id)).where(
                WorkflowHistory.operator_id == operator_id
            )
        )
        return result.scalar() or 0

    async def create(self, history: WorkflowHistory) -> WorkflowHistory:
        self.session.add(history)
        await self.session.flush()
        return history
