import logging

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.department import Department
from app.models.employee import EmployeeProfile
from app.models.user import User

logger = logging.getLogger(__name__)


class ContactsRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_contacts(
        self,
        search: str | None = None,
        department_id: int | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[dict], int]:
        base = (
            select(
                User.id,
                User.username,
                User.email,
                User.full_name,
                Department.name.label("department_name"),
                EmployeeProfile.phone,
            )
            .outerjoin(EmployeeProfile, EmployeeProfile.user_id == User.id)
            .outerjoin(Department, Department.id == User.department_id)
            .where(User.is_active == True)
        )

        if department_id is not None:
            base = base.where(User.department_id == department_id)
        if search:
            pattern = f"%{search}%"
            base = base.where(
                or_(
                    User.full_name.ilike(pattern),
                    User.username.ilike(pattern),
                    EmployeeProfile.phone.ilike(pattern),
                )
            )

        count_q = select(func.count()).select_from(base.subquery())
        total = await self.session.scalar(count_q) or 0

        offset = (page - 1) * page_size
        rows = await self.session.execute(
            base.order_by(User.full_name).offset(offset).limit(page_size)
        )
        items = [dict(r._mapping) for r in rows]
        return items, total

    async def get_department_tree(self) -> list[Department]:
        result = await self.session.execute(
            select(Department)
            .options(selectinload(Department.children), selectinload(Department.users))
            .where(Department.parent_id.is_(None))
            .order_by(Department.sort_order)
        )
        return list(result.scalars().all())
