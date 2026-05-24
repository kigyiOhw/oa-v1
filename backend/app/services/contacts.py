import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.contacts import ContactsRepository
from app.schemas.contacts import ContactOut, DepartmentTreeNode

logger = logging.getLogger(__name__)


class ContactsService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ContactsRepository(session)

    async def list_contacts(
        self,
        search: str | None = None,
        department_id: int | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[ContactOut], int]:
        items, total = await self.repo.get_contacts(search, department_id, page, page_size)
        return [ContactOut(**item) for item in items], total

    async def get_tree(self) -> list[DepartmentTreeNode]:
        roots = await self.repo.get_department_tree()
        return [_build_node(d) for d in roots]


def _build_node(dept) -> DepartmentTreeNode:
    return DepartmentTreeNode(
        id=dept.id,
        name=dept.name,
        children=[_build_node(c) for c in dept.children],
        employee_count=len([u for u in dept.users if u.is_active]),
    )
