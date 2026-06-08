"""Tests for announcement API."""
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
async def test_list_published_announcements(client: AsyncClient):
    """Anyone can list published announcements."""
    token = await register_and_login(client, "ann_viewer", "ann@test.com")
    resp = await client.get("/api/v1/announcements", headers=auth_header(token))
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_create_requires_permission(client: AsyncClient):
    """Regular user cannot create announcements."""
    token = await register_and_login(client, "ann_create", "ann_c@test.com")
    resp = await client.post("/api/v1/announcements", json={
        "title": "Test", "content": "Content",
    }, headers=auth_header(token))
    assert resp.status_code in (403, 401)
