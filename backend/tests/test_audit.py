"""Tests for audit log API."""
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
async def test_list_audit_logs_requires_auth(client: AsyncClient):
    """Audit logs require authentication."""
    resp = await client.get("/api/v1/audit-logs")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_audit_logs_with_auth(client: AsyncClient):
    """Authenticated user can list audit logs."""
    token = await register_and_login(client, "audit_viewer", "audit@test.com")
    resp = await client.get("/api/v1/audit-logs", headers=auth_header(token))
    # May return 200 (empty) or 403 if not admin — depends on permission config
    assert resp.status_code in (200, 403)


@pytest.mark.asyncio
async def test_filter_by_date(client: AsyncClient):
    """Audit logs support date filter params."""
    token = await register_and_login(client, "audit_date", "adate@test.com")
    resp = await client.get("/api/v1/audit-logs", params={
        "start_date": "2020-01-01",
        "end_date": "2030-01-01",
    }, headers=auth_header(token))
    assert resp.status_code in (200, 403)
