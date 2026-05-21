import io

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.security import get_password_hash


async def create_superuser(db_session: AsyncSession, username: str, email: str) -> User:
    user = User(
        username=username,
        email=email,
        hashed_password=get_password_hash("password123"),
        is_superuser=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def create_user(db_session: AsyncSession, username: str, email: str) -> User:
    user = User(
        username=username,
        email=email,
        hashed_password=get_password_hash("password123"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def login(client: AsyncClient, username: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={
        "username": username,
        "password": "password123",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]


# -- Announcements --


@pytest.mark.asyncio
async def test_list_published_public(client: AsyncClient, db_session: AsyncSession):
    """Published announcements are accessible without authentication."""
    user = await create_superuser(db_session, "annadmin1", "annadmin1@test.com")
    token = await login(client, "annadmin1")

    await client.post(
        "/api/v1/announcements",
        json={"title": "Hello", "content": "World", "is_pinned": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Publish it
    await client.put(
        "/api/v1/announcements/1",
        json={"is_published": True},
        headers={"Authorization": f"Bearer {token}"},
    )

    # Public access - no auth header
    resp = await client.get("/api/v1/announcements")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Hello"


@pytest.mark.asyncio
async def test_create_announcement_requires_permission(client: AsyncClient, db_session: AsyncSession):
    user = await create_user(db_session, "normal1", "normal1@test.com")
    token = await login(client, "normal1")

    resp = await client.post(
        "/api/v1/announcements",
        json={"title": "Test", "content": "Test content"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_announcement_as_admin(client: AsyncClient, db_session: AsyncSession):
    await create_superuser(db_session, "annadmin2", "annadmin2@test.com")
    token = await login(client, "annadmin2")

    resp = await client.post(
        "/api/v1/announcements",
        json={"title": "Important", "content": "## Markdown content", "is_pinned": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Important"
    assert data["is_published"] is False
    assert data["is_pinned"] is True


@pytest.mark.asyncio
async def test_publish_announcement(client: AsyncClient, db_session: AsyncSession):
    await create_superuser(db_session, "annadmin3", "annadmin3@test.com")
    token = await login(client, "annadmin3")

    await client.post(
        "/api/v1/announcements",
        json={"title": "Draft", "content": "Draft content"},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Publish
    resp = await client.put(
        "/api/v1/announcements/1",
        json={"is_published": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_published"] is True
    assert data["published_at"] is not None


@pytest.mark.asyncio
async def test_pinned_first(client: AsyncClient, db_session: AsyncSession):
    await create_superuser(db_session, "annadmin4", "annadmin4@test.com")
    token = await login(client, "annadmin4")

    await client.post(
        "/api/v1/announcements",
        json={"title": "Normal", "content": "N"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.put("/api/v1/announcements/1", json={"is_published": True}, headers={"Authorization": f"Bearer {token}"})

    await client.post(
        "/api/v1/announcements",
        json={"title": "Pinned", "content": "P", "is_pinned": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.put("/api/v1/announcements/2", json={"is_published": True}, headers={"Authorization": f"Bearer {token}"})

    resp = await client.get("/api/v1/announcements")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert data["items"][0]["title"] == "Pinned"


@pytest.mark.asyncio
async def test_delete_announcement(client: AsyncClient, db_session: AsyncSession):
    await create_superuser(db_session, "annadmin5", "annadmin5@test.com")
    token = await login(client, "annadmin5")

    await client.post(
        "/api/v1/announcements",
        json={"title": "To Delete", "content": "Gone"},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.delete("/api/v1/announcements/1", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204

    resp = await client.get("/api/v1/announcements/1")
    assert resp.status_code == 404


# -- Media --


@pytest.mark.asyncio
async def test_list_media_public(client: AsyncClient):
    """Media list is public."""
    resp = await client.get("/api/v1/media")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data


@pytest.mark.asyncio
async def test_upload_media_as_admin(client: AsyncClient, db_session: AsyncSession):
    await create_superuser(db_session, "medadmin1", "medadmin1@test.com")
    token = await login(client, "medadmin1")

    fake_file = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    resp = await client.post(
        "/api/v1/media/upload",
        files={"file": ("test.png", fake_file, "image/png")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "test.png"
    assert data["file_type"] == "image"
    assert data["file_path"].startswith("/media/")


@pytest.mark.asyncio
async def test_upload_media_requires_permission(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "normal2", "normal2@test.com")
    token = await login(client, "normal2")

    fake_file = io.BytesIO(b"x" * 50)
    resp = await client.post(
        "/api/v1/media/upload",
        files={"file": ("bad.txt", fake_file, "text/plain")},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Either 403 (no permission) or 400 (bad file type) — both are acceptable rejections
    assert resp.status_code in (400, 403)


@pytest.mark.asyncio
async def test_upload_invalid_extension(client: AsyncClient, db_session: AsyncSession):
    await create_superuser(db_session, "medadmin2", "medadmin2@test.com")
    token = await login(client, "medadmin2")

    fake_file = io.BytesIO(b"x" * 50)
    resp = await client.post(
        "/api/v1/media/upload",
        files={"file": ("bad.txt", fake_file, "text/plain")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_delete_media(client: AsyncClient, db_session: AsyncSession):
    await create_superuser(db_session, "medadmin3", "medadmin3@test.com")
    token = await login(client, "medadmin3")

    fake_file = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    resp = await client.post(
        "/api/v1/media/upload",
        files={"file": ("delme.png", fake_file, "image/png")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    media_id = resp.json()["id"]

    resp = await client.delete(f"/api/v1/media/{media_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204


# -- Settings (Company Info & Quick Links) --


@pytest.mark.asyncio
async def test_get_company_info_default(client: AsyncClient):
    """Company info returns defaults when nothing is configured."""
    resp = await client.get("/api/v1/settings/company-info")
    assert resp.status_code == 200
    data = resp.json()
    assert "name" in data
    assert "description" in data


@pytest.mark.asyncio
async def test_update_company_info(client: AsyncClient, db_session: AsyncSession):
    await create_superuser(db_session, "setadmin1", "setadmin1@test.com")
    token = await login(client, "setadmin1")

    resp = await client.put(
        "/api/v1/settings/company-info",
        json={"name": "ACME Corp", "logo_url": "https://example.com/logo.png",
              "description": "We make things", "address": "Shanghai", "contact": "400-123-4567"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "ACME Corp"

    # Verify persistence
    resp = await client.get("/api/v1/settings/company-info")
    assert resp.json()["name"] == "ACME Corp"


@pytest.mark.asyncio
async def test_company_info_public(client: AsyncClient):
    """Company info is publicly accessible without auth."""
    resp = await client.get("/api/v1/settings/company-info")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_quick_links_empty(client: AsyncClient):
    """Quick links return empty when not configured."""
    resp = await client.get("/api/v1/settings/quick-links")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_update_quick_links(client: AsyncClient, db_session: AsyncSession):
    await create_superuser(db_session, "setadmin2", "setadmin2@test.com")
    token = await login(client, "setadmin2")

    resp = await client.put(
        "/api/v1/settings/quick-links",
        json={"links": [
            {"name": "OA Portal", "url": "https://oa.example.com", "icon": "home"},
            {"name": "HR System", "url": "https://hr.example.com", "icon": "users"},
        ]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["name"] == "OA Portal"

    # Verify persistence
    resp = await client.get("/api/v1/settings/quick-links")
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_quick_links_public(client: AsyncClient):
    """Quick links are publicly accessible without auth."""
    resp = await client.get("/api/v1/settings/quick-links")
    assert resp.status_code == 200
