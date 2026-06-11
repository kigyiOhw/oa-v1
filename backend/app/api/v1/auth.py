import logging

from fastapi import APIRouter, Request, status

from app.api.deps import CurrentUser, DBDep
from app.core.exceptions import OAException
from app.core.limiter import limiter
from app.repositories.user import UserRepository
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserCreate,
)
from app.services.auth import AuthService
from app.utils.security import create_access_token, decode_token

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, data: UserCreate, db: DBDep) -> TokenResponse:
    logger.info("----------auth.register, start, username=%s, email=%s", data.username, data.email)
    service = AuthService(db)
    access_token, refresh_token, user = await service.register(data)
    logger.info("----------auth.register, done, user_id=%s, username=%s", user.id, user.username)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, data: LoginRequest, db: DBDep) -> TokenResponse:
    logger.info("----------auth.login, start, username=%s", data.username)
    service = AuthService(db)
    access_token, refresh_token, user = await service.login(data)
    logger.info("----------auth.login, done, user_id=%s, username=%s", user.id, user.username)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/refresh")
@limiter.limit("20/minute")
async def refresh(request: Request, data: RefreshRequest, db: DBDep) -> dict[str, str]:
    logger.info("----------auth.refresh, start")
    payload = decode_token(data.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        logger.warning("----------auth.refresh, invalid_token_type")
        raise OAException("Invalid refresh token", status_code=401)

    user_id = payload.get("sub")
    if user_id is None:
        logger.warning("----------auth.refresh, missing_sub")
        raise OAException("Invalid refresh token", status_code=401)

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(int(user_id))
    if user is None:
        logger.warning("----------auth.refresh, user_not_found, user_id=%s", user_id)
        raise OAException("Invalid refresh token", status_code=401)
    if not user.is_active:
        logger.warning("----------auth.refresh, user_inactive, user_id=%s", user_id)
        raise OAException("Invalid refresh token", status_code=401)

    access_token = create_access_token({"sub": str(user_id)})
    logger.info("----------auth.refresh, done, user_id=%s", user_id)
    return {"access_token": access_token, "token_type": "bearer"}


@router.put("/me/password")
async def change_password(
    data: ChangePasswordRequest,
    db: DBDep,
    current_user: CurrentUser,
) -> dict[str, str]:
    logger.info("----------auth.change_password, start, user_id=%s", current_user.id)
    service = AuthService(db)
    await service.change_password(current_user, data.old_password, data.new_password)
    logger.info("----------auth.change_password, done, user_id=%s", current_user.id)
    return {"message": "Password changed successfully"}
