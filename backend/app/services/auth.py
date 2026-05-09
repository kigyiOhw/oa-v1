from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.auth import UserCreate, LoginRequest
from app.utils.security import (
    get_password_hash_async,
    verify_password_async,
    create_access_token,
    create_refresh_token,
)


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)

    async def register(self, data: UserCreate) -> tuple[str, str, User]:
        existing = await self.user_repo.get_by_username(data.username)
        if not existing:
            existing = await self.user_repo.get_by_email(data.email)
        if existing:
            raise OAException("Username or email already registered", status_code=400)

        user = User(
            username=data.username,
            email=data.email,
            hashed_password=await get_password_hash_async(data.password),
            full_name=data.full_name,
        )
        self.user_repo.create(user)
        await self.session.commit()
        await self.session.refresh(user)

        access_token = create_access_token({"sub": str(user.id)})
        refresh_token = create_refresh_token({"sub": str(user.id)})
        return access_token, refresh_token, user

    async def login(self, data: LoginRequest) -> tuple[str, str, User]:
        user = await self.user_repo.get_by_username(data.username)
        if not user or not await verify_password_async(data.password, user.hashed_password):
            raise OAException("Incorrect username or password", status_code=401)
        if not user.is_active:
            raise OAException("User is inactive", status_code=403)

        access_token = create_access_token({"sub": str(user.id)})
        refresh_token = create_refresh_token({"sub": str(user.id)})
        return access_token, refresh_token, user
