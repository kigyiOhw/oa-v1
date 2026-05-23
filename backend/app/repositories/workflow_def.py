import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workflow import WorkflowDef

logger = logging.getLogger(__name__)


class WorkflowDefRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all(self) -> list[WorkflowDef]:
        result = await self.session.execute(
            select(WorkflowDef).order_by(WorkflowDef.id)
        )
        return list(result.scalars().all())

    async def get_by_id(self, def_id: int) -> WorkflowDef | None:
        result = await self.session.execute(
            select(WorkflowDef).where(WorkflowDef.id == def_id)
        )
        return result.scalar_one_or_none()

    async def create(self, wf_def: WorkflowDef) -> WorkflowDef:
        self.session.add(wf_def)
        await self.session.flush()
        return wf_def

    async def update(self, wf_def: WorkflowDef) -> WorkflowDef:
        await self.session.flush()
        await self.session.refresh(wf_def)
        return wf_def

    async def delete(self, wf_def: WorkflowDef) -> None:
        await self.session.delete(wf_def)
        await self.session.flush()

    async def get_by_name(self, name: str) -> WorkflowDef | None:
        result = await self.session.execute(
            select(WorkflowDef).where(WorkflowDef.name == name, WorkflowDef.is_active == True)
        )
        return result.scalar_one_or_none()

    async def count_active_instances(self, def_id: int) -> int:
        from app.models.workflow import WorkflowInstance

        result = await self.session.execute(
            select(func.count(WorkflowInstance.id)).where(
                WorkflowInstance.workflow_def_id == def_id,
                WorkflowInstance.status == "pending",
            )
        )
        return result.scalar() or 0
