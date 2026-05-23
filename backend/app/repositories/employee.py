import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.employee import EmployeeProfile
from app.models.user import User

logger = logging.getLogger(__name__)


class EmployeeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_user_id(self, user_id: int) -> EmployeeProfile | None:
        result = await self.session.execute(
            select(EmployeeProfile)
            .options(selectinload(EmployeeProfile.user).selectinload(User.department))
            .where(EmployeeProfile.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, profile_id: int) -> EmployeeProfile | None:
        result = await self.session.execute(
            select(EmployeeProfile)
            .options(selectinload(EmployeeProfile.user).selectinload(User.department))
            .where(EmployeeProfile.id == profile_id)
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        department_id: int | None = None,
        employment_status: str | None = None,
    ) -> tuple[list[EmployeeProfile], int]:
        base = (
            select(EmployeeProfile)
            .options(selectinload(EmployeeProfile.user).selectinload(User.department))
        )
        count_base = select(func.count(EmployeeProfile.id))

        if search:
            search_filter = (
                EmployeeProfile.user.has(
                    User.username.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%")
                )
            )
            base = base.where(search_filter)
            count_base = count_base.where(search_filter)

        if department_id is not None:
            dept_filter = EmployeeProfile.user.has(User.department_id == department_id)
            base = base.where(dept_filter)
            count_base = count_base.where(dept_filter)

        if employment_status:
            base = base.where(EmployeeProfile.employment_status == employment_status)
            count_base = count_base.where(EmployeeProfile.employment_status == employment_status)

        total = await self.session.scalar(count_base)

        offset = (page - 1) * page_size
        result = await self.session.execute(
            base.order_by(EmployeeProfile.id).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total

    async def create(self, profile: EmployeeProfile) -> EmployeeProfile:
        self.session.add(profile)
        await self.session.flush()
        return profile

    async def update(self, profile: EmployeeProfile) -> EmployeeProfile:
        await self.session.flush()
        await self.session.refresh(profile)
        return profile

    async def delete(self, profile: EmployeeProfile) -> None:
        await self.session.delete(profile)
        await self.session.flush()
