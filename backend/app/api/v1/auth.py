from fastapi import APIRouter, HTTPException, status

from app.api.deps import DBDep
from app.schemas.auth import (
    UserCreate,
    TokenResponse,
    LoginRequest,
    RefreshRequest,
)
from app.services.auth import AuthService
from app.utils.security import decode_token, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: DBDep) -> TokenResponse:
    service = AuthService(db)
    access_token, refresh_token, user = await service.register(data)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: DBDep) -> TokenResponse:
    service = AuthService(db)
    access_token, refresh_token, user = await service.login(data)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/refresh")
async def refresh(data: RefreshRequest) -> dict[str, str]:
    payload = decode_token(data.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    access_token = create_access_token({"sub": str(user_id)})
    return {"access_token": access_token, "token_type": "bearer"}
