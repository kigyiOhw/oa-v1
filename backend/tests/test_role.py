"""Tests for role API."""
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
async def test_list_roles(client: AsyncClient):
    """List roles endpoint."""
    token = await register_and_login(client, "role_viewer", "rv@test.com")
    resp = await client.get("/api/v1/roles", headers=auth_header(token))
    assert resp.status_code in (200, 403)


@pytest.mark.asyncio
async def test_get_role_types(client: AsyncClient):
    """Get role types endpoint."""
    token = await register_and_login(client, "role_types", "rt@test.com")
    resp = await client.get("/api/v1/roles/types", headers=auth_header(token))
    assert resp.status_code in (200, 403)


@pytest.mark.asyncio
async def test_unauthorized(client: AsyncClient):
    """Role endpoints require auth."""
    resp = await client.get("/api/v1/roles")
    assert resp.status_code == 401
