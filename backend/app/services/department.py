import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.department import Department
from app.repositories.department import DepartmentRepository

logger = logging.getLogger(__name__)


class DepartmentService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = DepartmentRepository(session)

    async def get_all(self) -> list[Department]:
        return await self.repo.get_all()

    async def get_tree(self) -> list[Department]:
        return await self.repo.get_tree()

    async def get_by_id(self, dept_id: int) -> Department:
        dept = await self.repo.get_by_id(dept_id)
        if not dept:
            raise OAException("Department not found", status_code=404)
        return dept

    async def create(self, name: str, parent_id: int | None, description: str | None, sort_order: int) -> Department:
        if parent_id is not None:
            parent = await self.repo.get_by_id(parent_id)
            if not parent:
                raise OAException("Parent department not found", status_code=404)
        dept = Department(
            name=name,
            parent_id=parent_id,
            description=description,
            sort_order=sort_order,
        )
        return await self.repo.create(dept)

    async def update(
        self, dept_id: int, name: str | None, parent_id: int | None,
        description: str | None, sort_order: int | None,
    ) -> Department:
        dept = await self.get_by_id(dept_id)
        if name is not None:
            dept.name = name
        if parent_id is not None:
            if parent_id == dept_id:
                raise OAException("Department cannot be its own parent", status_code=400)
            parent = await self.repo.get_by_id(parent_id)
            if not parent:
                raise OAException("Parent department not found", status_code=404)
            dept.parent_id = parent_id
        if description is not None:
            dept.description = description
        if sort_order is not None:
            dept.sort_order = sort_order
        return await self.repo.update(dept)

    async def delete(self, dept_id: int) -> None:
        dept = await self.get_by_id(dept_id)
        await self.repo.delete(dept)
