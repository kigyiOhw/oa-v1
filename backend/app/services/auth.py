import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.employee import EmployeeProfile
from sqlalchemy import text

from app.models.user import Role, User
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
        logger.info("----------AuthService.register, start, username=%s, email=%s", data.username, data.email)
        existing = await self.user_repo.get_by_username(data.username)
        if not existing:
            existing = await self.user_repo.get_by_email(data.email)
        if existing:
            logger.warning("----------AuthService.register, duplicate, username=%s, email=%s", data.username, data.email)
            raise OAException("Username or email already registered", status_code=400)

        logger.info("----------AuthService.register, creating_user, username=%s", data.username)
        user = User(
            username=data.username,
            email=data.email,
            hashed_password=await get_password_hash_async(data.password),
            full_name=data.full_name,
        )
        await self.user_repo.create(user)

        # Auto-create employee profile
        self.session.add(EmployeeProfile(user_id=user.id))
        await self.session.flush()

        # Assign default "user" role
        logger.info("----------AuthService.register, assigning_default_role, user_id=%s", user.id)
        result = await self.session.execute(text("SELECT id, name, description, role_type, admin_scope, created_at FROM roles WHERE name = :name"), {"name": "user"})
        row = result.fetchone()
        user_role = None
        if row:
            user_role = Role(
                id=row.id, name=row.name, description=row.description,
                role_type=row.role_type, admin_scope=row.admin_scope, created_at=row.created_at,
            )
        if user_role:
            await self.session.execute(
                text("INSERT INTO user_roles (user_id, role_id) VALUES (:user_id, :role_id)"),
                {"user_id": user.id, "role_id": user_role.id},
            )
            await self.session.flush()
            logger.info("----------AuthService.register, role_assigned, user_id=%s, role=%s", user.id, user_role.name)
        else:
            logger.warning("----------AuthService.register, default_role_not_found, user_id=%s", user.id)

        await self.session.commit()
        user = await self.user_repo.get_by_id_with_roles(user.id)
        logger.info("----------AuthService.register, done, user_id=%s, username=%s", user.id, user.username)

        access_token = create_access_token({"sub": str(user.id)})
        refresh_token = create_refresh_token({"sub": str(user.id)})
        return access_token, refresh_token, user

    async def login(self, data: LoginRequest) -> tuple[str, str, User]:
        logger.info("----------AuthService.login, start, username=%s", data.username)
        user = await self.user_repo.get_by_username(data.username, with_roles=True)
        if not user:
            logger.warning("----------AuthService.login, user_not_found, username=%s", data.username)
            raise OAException("Incorrect username or password", status_code=401)
        if not await verify_password_async(data.password, user.hashed_password):
            logger.warning("----------AuthService.login, wrong_password, username=%s", data.username)
            raise OAException("Incorrect username or password", status_code=401)
        if not user.is_active:
            logger.warning("----------AuthService.login, user_inactive, username=%s", data.username)
            raise OAException("User is inactive", status_code=403)

        logger.info("----------AuthService.login, done, user_id=%s, username=%s", user.id, user.username)
        access_token = create_access_token({"sub": str(user.id)})
        refresh_token = create_refresh_token({"sub": str(user.id)})
        return access_token, refresh_token, user
