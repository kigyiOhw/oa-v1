import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.user import Role, User
from app.repositories.role import RoleRepository
from app.repositories.user import UserRepository

logger = logging.getLogger(__name__)


class UserAdminService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.role_repo = RoleRepository(session)

    async def list_users(
        self, page: int = 1, page_size: int = 20, search: str | None = None
    ) -> tuple[list[User], int]:
        return await self.user_repo.get_all(page=page, page_size=page_size, search=search)

    async def get_user(self, user_id: int) -> User:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise OAException("User not found", status_code=404)
        return user

    async def update_user(
        self,
        user_id: int,
        email: str | None = None,
        full_name: str | None = None,
        is_active: bool | None = None,
        is_superuser: bool | None = None,
        department_id: int | None = None,
        role_ids: list[int] | None = None,
    ) -> User:
        user = await self.get_user(user_id)
        if email is not None:
            existing = await self.user_repo.get_by_email(email)
            if existing and existing.id != user_id:
                raise OAException("Email already in use", status_code=400)
            user.email = email
        if full_name is not None:
            user.full_name = full_name
        if is_active is not None:
            user.is_active = is_active
        if is_superuser is not None:
            user.is_superuser = is_superuser
        if department_id is not None:
            user.department_id = department_id
        if role_ids is not None:
            roles = await self.role_repo.get_all()
            user.roles = [r for r in roles if r.id in role_ids]
        return await self.user_repo.update(user)

    async def delete_user(self, user_id: int) -> None:
        user = await self.get_user(user_id)
        await self.user_repo.delete(user)
