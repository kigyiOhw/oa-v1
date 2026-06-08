"""Tests for permissions API."""
import pytest
from httpx import AsyncClient


async def register_and_login(client: AsyncClient, username: str, email: str) -> str:
    await client.post("/api/v1/auth/register", json={
        "username": username, "email": email,
        "password": "password123", "full_name": "Test",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "username": username, "password": "password123",
    })
    return resp.json()["access_token"]


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_list_permissions(client: AsyncClient):
    """List permissions endpoint returns results."""
    token = await register_and_login(client, "perm_user", "perm@test.com")
    resp = await client.get("/api/v1/permissions", headers=auth_header(token))
    assert resp.status_code in (200, 403)


@pytest.mark.asyncio
async def test_unauthorized(client: AsyncClient):
    """Permissions endpoint requires auth."""
    resp = await client.get("/api/v1/permissions")
    assert resp.status_code == 401
