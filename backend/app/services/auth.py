import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.auth import LoginRequest, UserCreate
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash_async,
    verify_password_async,
)

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)

    async def register(self, data: UserCreate) -> tuple[str, str, User]:
        logger.info("Register service | checking username=%s email=%s", data.username, data.email)
        existing = await self.user_repo.get_by_username(data.username)
        if not existing:
            existing = await self.user_repo.get_by_email(data.email)
        if existing:
            logger.warning("Register failed | duplicate username or email | username=%s email=%s", data.username, data.email)
            raise OAException("Username or email already registered", status_code=400)

        logger.debug("Register service | creating user | username=%s", data.username)
        user = User(
            username=data.username,
            email=data.email,
            hashed_password=await get_password_hash_async(data.password),
            full_name=data.full_name,
        )
        await self.user_repo.create(user)
        await self.session.commit()
        # Eager-load roles to prevent lazy-load errors during serialization
        user = await self.user_repo.get_by_id_with_roles(user.id)
        logger.info("Register service | user created | user_id=%s username=%s", user.id, user.username)

        access_token = create_access_token({"sub": str(user.id)})
        refresh_token = create_refresh_token({"sub": str(user.id)})
        logger.debug("Register service | tokens generated | user_id=%s", user.id)
        return access_token, refresh_token, user

    async def login(self, data: LoginRequest) -> tuple[str, str, User]:
        logger.info("Login service | checking username=%s", data.username)
        user = await self.user_repo.get_by_username(data.username, with_roles=True)
        if not user:
            logger.warning("Login failed | user not found | username=%s", data.username)
            raise OAException("Incorrect username or password", status_code=401)
        if not await verify_password_async(data.password, user.hashed_password):
            logger.warning("Login failed | wrong password | username=%s", data.username)
            raise OAException("Incorrect username or password", status_code=401)
        if not user.is_active:
            logger.warning("Login failed | inactive user | username=%s", data.username)
            raise OAException("User is inactive", status_code=403)

        logger.info("Login service | success | user_id=%s username=%s", user.id, user.username)
        access_token = create_access_token({"sub": str(user.id)})
        refresh_token = create_refresh_token({"sub": str(user.id)})
        return access_token, refresh_token, user
