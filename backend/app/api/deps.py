import logging
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.core.permissions import is_super_admin
from app.db.base import AsyncSessionLocal
from app.models.user import Permission, User, role_permissions, user_roles
from app.repositories.user import UserRepository
from app.utils.security import decode_token

logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


DBDep = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: DBDep,
) -> User:
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        logger.warning("Auth failed | invalid token type or decode error")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if user_id_str is None:
        logger.warning("Auth failed | missing sub in token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id_with_roles(int(user_id_str))
    if user is None:
        logger.warning("Auth failed | user not found | user_id=%s", user_id_str)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        logger.warning("Auth failed | inactive user | user_id=%s", user_id_str)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.debug("Auth success | user_id=%s username=%s", user.id, user.username)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_permission(permission: str):
    async def _check(current_user: CurrentUser, db: DBDep) -> None:
        if is_super_admin(current_user):
            return
        stmt = (
            select(Permission.code)
            .join(role_permissions, Permission.id == role_permissions.c.permission_id)
            .join(user_roles, role_permissions.c.role_id == user_roles.c.role_id)
            .where(user_roles.c.user_id == current_user.id)
        )
        result = await db.execute(stmt)
        user_perms = {row[0] for row in result.fetchall()}
        if permission not in user_perms:
            raise OAException("Insufficient permissions", status_code=403)
    return Depends(_check)


async def require_superuser(current_user: CurrentUser) -> None:
    if not is_super_admin(current_user):
        raise OAException("Insufficient permissions", status_code=403)


RequireSuperuser = Annotated[None, Depends(require_superuser)]
