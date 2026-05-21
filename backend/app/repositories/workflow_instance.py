import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.workflow import WorkflowHistory, WorkflowInstance, WorkflowTask

logger = logging.getLogger(__name__)


class WorkflowInstanceRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, instance_id: int) -> WorkflowInstance | None:
        result = await self.session.execute(
            select(WorkflowInstance).where(WorkflowInstance.id == instance_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id_with_all(self, instance_id: int) -> WorkflowInstance | None:
        result = await self.session.execute(
            select(WorkflowInstance)
            .options(
                selectinload(WorkflowInstance.workflow_def),
                selectinload(WorkflowInstance.initiator),
                selectinload(WorkflowInstance.tasks).selectinload(WorkflowTask.assignee),
                selectinload(WorkflowInstance.history).selectinload(WorkflowHistory.operator),
            )
            .where(WorkflowInstance.id == instance_id)
        )
        return result.scalar_one_or_none()

    async def get_by_initiator(
        self, initiator_id: int, page: int, page_size: int
    ) -> tuple[list[WorkflowInstance], int]:
        offset = (page - 1) * page_size
        count_result = await self.session.execute(
            select(func.count(WorkflowInstance.id)).where(
                WorkflowInstance.initiator_id == initiator_id
            )
        )
        total = count_result.scalar() or 0

        result = await self.session.execute(
            select(WorkflowInstance)
            .options(selectinload(WorkflowInstance.workflow_def))
            .where(WorkflowInstance.initiator_id == initiator_id)
            .order_by(WorkflowInstance.id.desc())
            .offset(offset)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def create(self, instance: WorkflowInstance) -> WorkflowInstance:
        self.session.add(instance)
        await self.session.flush()
        return instance

    async def update(self, instance: WorkflowInstance) -> WorkflowInstance:
        await self.session.flush()
        await self.session.refresh(instance)
        return instance
