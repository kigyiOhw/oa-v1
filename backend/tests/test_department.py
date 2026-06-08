"""Tests for department API."""
import pytest
from httpx import AsyncClient


async def register_user(client: AsyncClient, username: str, email: str) -> None:
    resp = await client.post("/api/v1/auth/register", json={
        "username": username, "email": email,
        "password": "password123", "full_name": "Test",
    })
    assert resp.status_code == 201


async def login(client: AsyncClient, username: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={
        "username": username, "password": "password123",
    })
    return resp.json()["access_token"]


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_list_departments(client: AsyncClient):
    """List departments endpoint."""
    await register_user(client, "dept_viewer", "dept@test.com")
    token = await login(client, "dept_viewer")

    resp = await client.get("/api/v1/departments", headers=auth_header(token))
    assert resp.status_code in (200, 403)


@pytest.mark.asyncio
async def test_create_department_requires_permission(client: AsyncClient):
    """Regular user cannot create department."""
    await register_user(client, "dept_creator", "dept_c@test.com")
    token = await login(client, "dept_creator")

    resp = await client.post("/api/v1/departments", json={
        "name": "New Dept", "description": "Test",
    }, headers=auth_header(token))
    assert resp.status_code in (403, 401)


@pytest.mark.asyncio
async def test_unauthorized(client: AsyncClient):
    """Department endpoints require auth."""
    resp = await client.get("/api/v1/departments")
    assert resp.status_code == 401
