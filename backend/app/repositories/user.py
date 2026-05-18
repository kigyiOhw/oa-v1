import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

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

    async def get_by_username(self, username: str) -> User | None:
        logger.debug("UserRepository | get_by_username | username=%s", username)
        result = await self.session.execute(select(User).where(User.username == username))
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
