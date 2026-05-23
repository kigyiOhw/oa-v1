import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.user import Role
from app.repositories.permission import PermissionRepository
from app.repositories.role import RoleRepository

logger = logging.getLogger(__name__)


class RoleService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = RoleRepository(session)
        self.perm_repo = PermissionRepository(session)

    async def get_all(self) -> list[Role]:
        return await self.repo.get_all()

    async def get_by_id(self, role_id: int) -> Role:
        role = await self.repo.get_by_id(role_id)
        if not role:
            raise OAException("Role not found", status_code=404)
        return role

    async def create(self, name: str, description: str | None, role_type: str = "user", admin_scope: str | None = None) -> Role:
        existing = await self.repo.get_by_name(name)
        if existing:
            raise OAException("Role name already exists", status_code=400)
        role = Role(name=name, description=description, role_type=role_type, admin_scope=admin_scope)
        return await self.repo.create(role)

    async def update(self, role_id: int, name: str | None, description: str | None, role_type: str | None = None, admin_scope: str | None = None) -> Role:
        role = await self.get_by_id(role_id)
        if name is not None:
            existing = await self.repo.get_by_name(name)
            if existing and existing.id != role_id:
                raise OAException("Role name already exists", status_code=400)
            role.name = name
        if description is not None:
            role.description = description
        if role_type is not None:
            role.role_type = role_type
        if admin_scope is not None:
            role.admin_scope = admin_scope
        return await self.repo.update(role)

    async def delete(self, role_id: int) -> None:
        role = await self.get_by_id(role_id)
        await self.repo.delete(role)

    async def assign_permissions(self, role_id: int, permission_ids: list[int]) -> Role:
        role = await self.get_by_id(role_id)
        all_perms = await self.perm_repo.get_all()
        role.permissions = [p for p in all_perms if p.id in permission_ids]
        return await self.repo.update(role)
