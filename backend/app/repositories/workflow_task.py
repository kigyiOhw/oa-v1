import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.workflow import WorkflowInstance, WorkflowTask

logger = logging.getLogger(__name__)


class WorkflowTaskRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, task_id: int) -> WorkflowTask | None:
        result = await self.session.execute(
            select(WorkflowTask)
            .options(selectinload(WorkflowTask.assignee))
            .where(WorkflowTask.id == task_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id_with_instance(self, task_id: int) -> WorkflowTask | None:
        result = await self.session.execute(
            select(WorkflowTask)
            .options(
                selectinload(WorkflowTask.assignee),
                selectinload(WorkflowTask.instance)
                .selectinload(WorkflowInstance.workflow_def),
            )
            .where(WorkflowTask.id == task_id)
        )
        return result.scalar_one_or_none()

    async def get_pending_by_assignee(
        self, assignee_id: int, page: int, page_size: int
    ) -> tuple[list[WorkflowTask], int]:
        offset = (page - 1) * page_size
        count_result = await self.session.execute(
            select(func.count(WorkflowTask.id)).where(
                WorkflowTask.assignee_id == assignee_id,
                WorkflowTask.status == "pending",
            )
        )
        total = count_result.scalar() or 0

        result = await self.session.execute(
            select(WorkflowTask)
            .options(
                selectinload(WorkflowTask.assignee),
                selectinload(WorkflowTask.instance).selectinload(WorkflowInstance.workflow_def),
            )
            .where(
                WorkflowTask.assignee_id == assignee_id,
                WorkflowTask.status == "pending",
            )
            .order_by(WorkflowTask.id.desc())
            .offset(offset)
            .limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_pending_count_by_users(self, user_ids: list[int]) -> dict[int, int]:
        result = await self.session.execute(
            select(WorkflowTask.assignee_id, func.count(WorkflowTask.id))
            .where(
                WorkflowTask.assignee_id.in_(user_ids),
                WorkflowTask.status == "pending",
            )
            .group_by(WorkflowTask.assignee_id)
        )
        counts: dict[int, int] = {uid: 0 for uid in user_ids}
        for row in result:
            counts[row[0]] = row[1]
        return counts

    async def get_pending_count(self, assignee_id: int) -> int:
        result = await self.session.execute(
            select(func.count(WorkflowTask.id)).where(
                WorkflowTask.assignee_id == assignee_id,
                WorkflowTask.status == "pending",
            )
        )
        return result.scalar() or 0

    async def has_task_in_instance(self, user_id: int, instance_id: int) -> bool:
        result = await self.session.execute(
            select(func.count(WorkflowTask.id)).where(
                WorkflowTask.assignee_id == user_id,
                WorkflowTask.instance_id == instance_id,
            )
        )
        return (result.scalar() or 0) > 0

    async def create(self, task: WorkflowTask) -> WorkflowTask:
        self.session.add(task)
        await self.session.flush()
        return task

    async def update(self, task: WorkflowTask) -> WorkflowTask:
        await self.session.flush()
        await self.session.refresh(task)
        return task
