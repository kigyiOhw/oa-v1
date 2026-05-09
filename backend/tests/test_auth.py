import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123",
        "full_name": "Test User",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["user"]["username"] == "testuser"
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_register_duplicate(client: AsyncClient):
    payload = {
        "username": "dupuser",
        "email": "dup1@example.com",
        "password": "password123",
    }
    r1 = await client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201

    r2 = await client.post("/api/v1/auth/register", json=payload)
    assert r2.status_code == 400
    assert "already registered" in r2.json()["detail"]


@pytest.mark.asyncio
async def test_register_invalid_username(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "username": "test-user!",
        "email": "test@example.com",
        "password": "password123",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_weak_password(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "username": "weakpass",
        "email": "weak@example.com",
        "password": "123456",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_short_password(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "username": "shortpass",
        "email": "short@example.com",
        "password": "abc12",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "username": "loginuser",
        "email": "login@example.com",
        "password": "password123",
    })

    resp = await client.post("/api/v1/auth/login", json={
        "username": "loginuser",
        "password": "password123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["username"] == "loginuser"
    assert "access_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "username": "wrongpass",
        "email": "wrong@example.com",
        "password": "password123",
    })

    resp = await client.post("/api/v1/auth/login", json={
        "username": "wrongpass",
        "password": "badpassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_disabled_user(client: AsyncClient, db_session):
    from app.models.user import User
    from app.utils.security import get_password_hash

    user = User(
        username="disabled",
        email="disabled@example.com",
        hashed_password=get_password_hash("password123"),
        is_active=False,
    )
    db_session.add(user)
    await db_session.commit()

    resp = await client.post("/api/v1/auth/login", json={
        "username": "disabled",
        "password": "password123",
    })
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_refresh_success(client: AsyncClient):
    reg = await client.post("/api/v1/auth/register", json={
        "username": "refreshuser",
        "email": "refresh@example.com",
        "password": "password123",
    })
    refresh_token = reg.json()["refresh_token"]

    resp = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_refresh_invalid_token(client: AsyncClient):
    resp = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": "invalid.token.here",
    })
    assert resp.status_code == 401
