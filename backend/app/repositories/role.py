import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import Permission, Role

logger = logging.getLogger(__name__)


class RoleRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all(self) -> list[Role]:
        result = await self.session.execute(
            select(Role).options(selectinload(Role.permissions)).order_by(Role.id)
        )
        return list(result.scalars().all())

    async def get_by_id(self, role_id: int) -> Role | None:
        result = await self.session.execute(
            select(Role).options(selectinload(Role.permissions)).where(Role.id == role_id)
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Role | None:
        result = await self.session.execute(
            select(Role).options(selectinload(Role.users)).where(Role.name == name)
        )
        return result.scalar_one_or_none()

    async def create(self, role: Role) -> Role:
        self.session.add(role)
        await self.session.flush()
        return role

    async def update(self, role: Role) -> Role:
        await self.session.flush()
        await self.session.refresh(role)
        return role

    async def delete(self, role: Role) -> None:
        await self.session.delete(role)
        await self.session.flush()
