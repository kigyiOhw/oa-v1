import logging

from fastapi import APIRouter, Request, status

from app.api.deps import DBDep
from app.core.exceptions import OAException
from app.core.limiter import limiter
from app.repositories.user import UserRepository
from app.schemas.auth import (
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
    logger.info("Register attempt | username=%s email=%s", data.username, data.email)
    service = AuthService(db)
    access_token, refresh_token, user = await service.register(data)
    logger.info("Register success | user_id=%s username=%s", user.id, user.username)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, data: LoginRequest, db: DBDep) -> TokenResponse:
    logger.info("Login attempt | username=%s", data.username)
    service = AuthService(db)
    access_token, refresh_token, user = await service.login(data)
    logger.info("Login success | user_id=%s username=%s", user.id, user.username)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/refresh")
@limiter.limit("20/minute")
async def refresh(request: Request, data: RefreshRequest, db: DBDep) -> dict[str, str]:
    logger.info("Token refresh attempt")
    payload = decode_token(data.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        logger.warning("Token refresh failed | reason=invalid_token_type")
        raise OAException("Invalid refresh token", status_code=401)

    user_id = payload.get("sub")
    if user_id is None:
        logger.warning("Token refresh failed | reason=missing_sub")
        raise OAException("Invalid refresh token", status_code=401)

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(int(user_id))
    if user is None:
        logger.warning("Token refresh failed | reason=user_not_found user_id=%s", user_id)
        raise OAException("Invalid refresh token", status_code=401)
    if not user.is_active:
        logger.warning("Token refresh failed | reason=inactive_user user_id=%s", user_id)
        raise OAException("Invalid refresh token", status_code=401)

    access_token = create_access_token({"sub": str(user_id)})
    logger.info("Token refresh success | user_id=%s", user_id)
    return {"access_token": access_token, "token_type": "bearer"}
