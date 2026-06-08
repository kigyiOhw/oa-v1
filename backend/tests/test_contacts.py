"""Tests for contacts API endpoints."""
import pytest
from httpx import AsyncClient


async def register_user(client: AsyncClient, username: str, email: str, full_name: str = "Test") -> None:
    resp = await client.post("/api/v1/auth/register", json={
        "username": username, "email": email,
        "password": "password123", "full_name": full_name,
    })
    assert resp.status_code == 201


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_list_contacts(client: AsyncClient):
    """List contacts returns registered users."""
    await register_user(client, "contact_user1", "c1@test.com", "Alice")
    await register_user(client, "contact_user2", "c2@test.com", "Bob")

    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "contact_user1", "password": "password123",
    })
    token = login_resp.json()["access_token"]

    resp = await client.get("/api/v1/contacts", headers=auth_header(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_search_contacts(client: AsyncClient):
    """Search contacts filters by name or username."""
    await register_user(client, "search_me", "sm@test.com", "SearchTarget")

    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "search_me", "password": "password123",
    })
    token = login_resp.json()["access_token"]

    resp = await client.get("/api/v1/contacts", params={"search": "SearchTarget"}, headers=auth_header(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_contacts_tree(client: AsyncClient):
    """Department tree endpoint returns results."""
    await register_user(client, "tree_user", "tree@test.com")

    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "tree_user", "password": "password123",
    })
    token = login_resp.json()["access_token"]

    resp = await client.get("/api/v1/contacts/tree", headers=auth_header(token))
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_unauthorized(client: AsyncClient):
    """Contacts endpoint requires auth."""
    resp = await client.get("/api/v1/contacts")
    assert resp.status_code == 401
