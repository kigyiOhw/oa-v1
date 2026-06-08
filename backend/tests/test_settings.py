"""Tests for company settings API."""
import pytest
from httpx import AsyncClient


async def register_user(client: AsyncClient, username: str, email: str, superuser: bool = False) -> None:
    resp = await client.post("/api/v1/auth/register", json={
        "username": username, "email": email,
        "password": "password123", "full_name": "Test",
    })
    if resp.status_code != 201:
        return


async def login(client: AsyncClient, username: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={
        "username": username, "password": "password123",
    })
    return resp.json()["access_token"]


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_get_settings(client: AsyncClient):
    """Anyone can read company settings."""
    resp = await client.get("/api/v1/settings")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_update_settings_requires_auth(client: AsyncClient):
    """Unauthenticated user cannot update settings."""
    resp = await client.put("/api/v1/settings", json={"company_name": "Test"})
    assert resp.status_code == 401
