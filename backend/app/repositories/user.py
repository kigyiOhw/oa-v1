import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import Role, User

logger = logging.getLogger(__name__)


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: int) -> User | None:
        logger.debug("UserRepository | get_by_id | user_id=%s", user_id)
        result = await self.session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        logger.debug("UserRepository | get_by_id | user_id=%s found=%s", user_id, user is not None)
        return user

    async def get_by_id_with_roles(self, user_id: int) -> User | None:
        result = await self.session.execute(
            select(User)
            .options(selectinload(User.roles).selectinload(Role.permissions))
            .where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str, with_roles: bool = False) -> User | None:
        logger.debug("UserRepository | get_by_username | username=%s", username)
        stmt = select(User).where(User.username == username)
        if with_roles:
            stmt = stmt.options(selectinload(User.roles).selectinload(Role.permissions))
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        logger.debug("UserRepository | get_by_username | username=%s found=%s", username, user is not None)
        return user

    async def get_by_email(self, email: str) -> User | None:
        logger.debug("UserRepository | get_by_email | email=%s", email)
        result = await self.session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        logger.debug("UserRepository | get_by_email | email=%s found=%s", email, user is not None)
        return user

    async def create(self, user: User) -> User:
        logger.info("UserRepository | create | username=%s email=%s", user.username, user.email)
        self.session.add(user)
        await self.session.flush()
        logger.info("UserRepository | create | flushed | user_id=%s", user.id)
        return user

    async def get_all(
        self, page: int = 1, page_size: int = 20, search: str | None = None
    ) -> tuple[list[User], int]:
        stmt = select(User).options(
            selectinload(User.roles).selectinload(Role.permissions)
        )
        count_stmt = select(func.count(User.id))
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                User.username.ilike(pattern) | User.email.ilike(pattern)
            )
            count_stmt = count_stmt.where(
                User.username.ilike(pattern) | User.email.ilike(pattern)
            )
        total = await self.session.scalar(count_stmt)
        stmt = stmt.order_by(User.id).offset((page - 1) * page_size).limit(page_size)
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), total

    async def update(self, user: User) -> User:
        await self.session.flush()
        await self.session.refresh(user)
        return user

    async def delete(self, user: User) -> None:
        await self.session.delete(user)
        await self.session.flush()
