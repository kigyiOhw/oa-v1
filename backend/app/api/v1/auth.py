from fastapi import APIRouter, Request, status

from app.api.deps import DBDep
from app.core.exceptions import OAException
from app.core.limiter import limiter
from app.schemas.auth import (
    UserCreate,
    TokenResponse,
    LoginRequest,
    RefreshRequest,
)
from app.services.auth import AuthService
from app.utils.security import decode_token, create_access_token
from app.repositories.user import UserRepository

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, data: UserCreate, db: DBDep) -> TokenResponse:
    service = AuthService(db)
    access_token, refresh_token, user = await service.register(data)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, data: LoginRequest, db: DBDep) -> TokenResponse:
    service = AuthService(db)
    access_token, refresh_token, user = await service.login(data)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/refresh")
@limiter.limit("20/minute")
async def refresh(request: Request, data: RefreshRequest, db: DBDep) -> dict[str, str]:
    payload = decode_token(data.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise OAException("Invalid refresh token", status_code=401)

    user_id = payload.get("sub")
    if user_id is None:
        raise OAException("Invalid refresh token", status_code=401)

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(int(user_id))
    if user is None or not user.is_active:
        raise OAException("Invalid refresh token", status_code=401)

    access_token = create_access_token({"sub": str(user_id)})
    return {"access_token": access_token, "token_type": "bearer"}
