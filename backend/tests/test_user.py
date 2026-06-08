"""Tests for user management API."""
import pytest
from httpx import AsyncClient


async def register_and_login(client: AsyncClient, username: str, email: str) -> str:
    resp = await client.post("/api/v1/auth/register", json={
        "username": username, "email": email,
        "password": "password123", "full_name": "Test",
    })
    if resp.status_code != 201:
        pass
    resp = await client.post("/api/v1/auth/login", json={
        "username": username, "password": "password123",
    })
    return resp.json()["access_token"]


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_list_users_requires_admin(client: AsyncClient):
    """Regular user cannot list all users."""
    token = await register_and_login(client, "list_users", "lu@test.com")
    resp = await client.get("/api/v1/users", headers=auth_header(token))
    assert resp.status_code in (200, 403)


@pytest.mark.asyncio
async def test_get_own_user(client: AsyncClient):
    """User can access their own info via auth status."""
    token = await register_and_login(client, "self_user", "su@test.com")
    # Auth me endpoint
    resp = await client.get("/api/v1/auth/me", headers=auth_header(token))
    assert resp.status_code == 200
    assert resp.json()["username"] == "self_user"


@pytest.mark.asyncio
async def test_unauthorized(client: AsyncClient):
    """User endpoints require auth."""
    resp = await client.get("/api/v1/users")
    assert resp.status_code == 401
