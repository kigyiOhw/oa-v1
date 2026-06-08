import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.employee import EmployeeProfile
from app.models.user import User
from app.models.workflow import WorkflowTask
from app.repositories.employee import EmployeeRepository
from app.schemas.employee import (
    EmployeeProfileAdminUpdate,
    EmployeeProfileMyUpdate,
    OnboardingRequest,
    ResignRequest,
)

logger = logging.getLogger(__name__)


class EmployeeService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = EmployeeRepository(session)

    async def _ensure_profile(self, user: User) -> EmployeeProfile:
        profile = await self.repo.get_by_user_id(user.id)
        if not profile:
            raise OAException("Employee profile not found", status_code=404)
        return profile

    async def get_my_profile(self, user: User) -> EmployeeProfile:
        return await self._ensure_profile(user)

    async def update_my_profile(self, user: User, data: EmployeeProfileMyUpdate) -> EmployeeProfile:
        profile = await self._ensure_profile(user)
        if data.phone is not None:
            profile.phone = data.phone
        if data.address is not None:
            profile.address = data.address
        result = await self.repo.update(profile)
        await self.session.commit()
        return result

    async def complete_onboarding(self, user: User, data: OnboardingRequest) -> EmployeeProfile:
        profile = await self._ensure_profile(user)
        if profile.onboarding_complete:
            raise OAException("Onboarding already completed", status_code=400)

        profile.phone = data.phone
        profile.address = data.address
        profile.birthday = data.birthday
        profile.work_experience = data.work_experience
        profile.graduation_school = data.graduation_school
        profile.education_level = data.education_level
        profile.onboarding_complete = True
        result = await self.repo.update(profile)
        await self.session.commit()
        return result

    async def admin_get_all(
        self,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        department_id: int | None = None,
        employment_status: str | None = None,
    ) -> tuple[list[EmployeeProfile], int]:
        return await self.repo.get_all(
            page=page, page_size=page_size,
            search=search, department_id=department_id,
            employment_status=employment_status,
        )

    async def admin_get(self, profile_id: int) -> EmployeeProfile:
        profile = await self.repo.get_by_id(profile_id)
        if not profile:
            raise OAException("Employee profile not found", status_code=404)
        return profile

    async def admin_update(self, profile_id: int, data: EmployeeProfileAdminUpdate) -> EmployeeProfile:
        profile = await self.admin_get(profile_id)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)
        result = await self.repo.update(profile)
        await self.session.commit()
        return result

    async def admin_delete(self, profile_id: int) -> None:
        profile = await self.admin_get(profile_id)
        await self.repo.delete(profile)
        await self.session.commit()

    async def resign(self, profile_id: int, data: ResignRequest) -> EmployeeProfile:
        profile = await self.admin_get(profile_id)
        if profile.employment_status == "resigned":
            raise OAException("Employee is already resigned", status_code=400)
        if profile.user_id == data.successor_id:
            raise OAException("Cannot transfer work to self", status_code=400)

        # 1. Transfer subordinates
        subordinates = await self._get_subordinates(profile.user_id)
        for sub in subordinates:
            sub.manager_id = data.successor_id

        # 2. Transfer pending workflow tasks
        pending_tasks = await self._get_pending_tasks(profile.user_id)
        for task in pending_tasks:
            task.assignee_id = data.successor_id

        if subordinates or pending_tasks:
            await self.session.flush()

        # 3. Return assigned assets
        from app.models.asset import Asset, AssetAssignment
        assets_result = await self.session.execute(
            select(Asset).where(Asset.current_user_id == profile.user_id)
        )
        assigned_assets = assets_result.scalars().all()
        for asset in assigned_assets:
            self.session.add(AssetAssignment(
                asset_id=asset.id,
                user_id=profile.user_id,
                action="return",
                action_date=data.resignation_date or date.today(),
                notes="Auto-returned on resignation",
                operator_id=profile.user_id,
            ))
            asset.current_user_id = None
        if assigned_assets:
            await self.session.flush()
            logger.info("EmployeeService.resign | returned %d assets for user_id=%s", len(assigned_assets), profile.user_id)

        # 4. Set resignation status
        profile.employment_status = "resigned"
        profile.resignation_date = data.resignation_date or date.today()
        result = await self.repo.update(profile)
        await self.session.commit()
        return result

    async def _get_subordinates(self, user_id: int) -> list[User]:
        result = await self.session.execute(
            select(User).where(User.manager_id == user_id)
        )
        return list(result.scalars().all())

    async def _get_pending_tasks(self, user_id: int) -> list[WorkflowTask]:
        result = await self.session.execute(
            select(WorkflowTask).where(
                WorkflowTask.assignee_id == user_id,
                WorkflowTask.status == "pending",
            )
        )
        return list(result.scalars().all())
