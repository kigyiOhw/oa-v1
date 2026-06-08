"""Tests for overtime request API."""
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
async def test_create_draft(client: AsyncClient):
    """User can create an overtime draft."""
    token = await register_and_login(client, "ot_user", "ot@test.com")
    now = "2026-06-08T09:00:00"
    later = "2026-06-08T12:00:00"
    resp = await client.post("/api/v1/overtimes", json={
        "start_time": now,
        "end_time": later,
        "duration_hours": 3.0,
        "reason": "Project deadline",
    }, headers=auth_header(token))
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "draft"


@pytest.mark.asyncio
async def test_list_my_overtimes(client: AsyncClient):
    """User can list their own overtime requests."""
    token = await register_and_login(client, "ot_list", "ol@test.com")
    resp = await client.get("/api/v1/overtimes", headers=auth_header(token))
    assert resp.status_code == 200
    assert "items" in resp.json()


@pytest.mark.asyncio
async def test_delete_draft(client: AsyncClient):
    """User can delete their own overtime draft."""
    token = await register_and_login(client, "ot_del", "od@test.com")
    now = "2026-06-08T14:00:00"
    later = "2026-06-08T18:00:00"

    create_resp = await client.post("/api/v1/overtimes", json={
        "start_time": now,
        "end_time": later,
        "duration_hours": 4.0,
        "reason": "Testing",
    }, headers=auth_header(token))
    ot_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/overtimes/{ot_id}", headers=auth_header(token))
    assert del_resp.status_code == 200


@pytest.mark.asyncio
async def test_unauthorized(client: AsyncClient):
    """Overtime endpoints require auth."""
    resp = await client.get("/api/v1/overtimes")
    assert resp.status_code == 401
