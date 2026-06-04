import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.department import Department

logger = logging.getLogger(__name__)


class DepartmentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all(self) -> list[Department]:
        result = await self.session.execute(
            select(Department).order_by(Department.sort_order, Department.id)
        )
        return list(result.scalars().all())

    async def get_by_id(self, dept_id: int) -> Department | None:
        result = await self.session.execute(
            select(Department).where(Department.id == dept_id)
        )
        return result.scalar_one_or_none()

    async def create(self, dept: Department) -> Department:
        self.session.add(dept)
        await self.session.flush()
        return dept

    async def update(self, dept: Department) -> Department:
        await self.session.flush()
        await self.session.refresh(dept)
        return dept

    async def count_all(self) -> int:
        result = await self.session.execute(
            select(func.count(Department.id))
        )
        return result.scalar() or 0

    async def delete(self, dept: Department) -> None:
        await self.session.delete(dept)
        await self.session.flush()

    async def get_tree(self) -> list[Department]:
        result = await self.session.execute(
            select(Department)
            .options(selectinload(Department.children))
            .where(Department.parent_id.is_(None))
            .order_by(Department.sort_order, Department.id)
        )
        return list(result.scalars().all())
