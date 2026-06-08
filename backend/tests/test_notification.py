"""Tests for notification API endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.security import create_access_token, get_password_hash


async def register_user(client: AsyncClient, username: str, email: str, full_name: str = "Test") -> User:
    resp = await client.post("/api/v1/auth/register", json={
        "username": username, "email": email,
        "password": "password123", "full_name": full_name,
    })
    assert resp.status_code == 201
    return resp.json()


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_list_notifications_empty(client: AsyncClient):
    """List notifications for a user with none."""
    await register_user(client, "notif_user1", "notif1@test.com")
    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "notif_user1", "password": "password123",
    })
    token = login_resp.json()["access_token"]

    resp = await client.get("/api/v1/notifications", headers=auth_header(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_unread_count_zero(client: AsyncClient):
    """Unread count should be 0 for new user."""
    await register_user(client, "notif_user2", "notif2@test.com")
    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "notif_user2", "password": "password123",
    })
    token = login_resp.json()["access_token"]

    resp = await client.get("/api/v1/notifications/unread-count", headers=auth_header(token))
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


@pytest.mark.asyncio
async def test_mark_all_read_idempotent(client: AsyncClient):
    """Marking all as read when none exist should not error."""
    await register_user(client, "notif_user3", "notif3@test.com")
    login_resp = await client.post("/api/v1/auth/login", json={
        "username": "notif_user3", "password": "password123",
    })
    token = login_resp.json()["access_token"]

    resp = await client.post("/api/v1/notifications/read-all", headers=auth_header(token))
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


@pytest.mark.asyncio
async def test_notification_ownership_check(client: AsyncClient, db_session: AsyncSession):
    """User A cannot mark User B's notification as read (backlog #1 fix)."""
    # Register two users
    await register_user(client, "owner_user", "owner@test.com")
    await register_user(client, "attacker", "attacker@test.com")

    login_owner = await client.post("/api/v1/auth/login", json={
        "username": "owner_user", "password": "password123",
    })
    owner_token = login_owner.json()["access_token"]

    login_attacker = await client.post("/api/v1/auth/login", json={
        "username": "attacker", "password": "password123",
    })
    attacker_token = login_attacker.json()["access_token"]

    # Create a notification for owner via the notification service
    from app.models.notification import Notification
    from app.services.notification import NotificationService
    from sqlalchemy import select

    owner_result = await db_session.execute(
        select(User).where(User.username == "owner_user")
    )
    owner = owner_result.scalar_one()
    service = NotificationService(db_session)
    notif = await service.send_notification(
        db_session, owner.id, "workflow", "Test Title", "Test message",
    )
    notif_id = notif.id

    # Attacker tries to mark owner's notification as read → 403
    resp = await client.post(
        f"/api/v1/notifications/{notif_id}/read",
        headers=auth_header(attacker_token),
    )
    assert resp.status_code == 403

    # Owner can mark their own notification as read → 200
    resp = await client.post(
        f"/api/v1/notifications/{notif_id}/read",
        headers=auth_header(owner_token),
    )
    assert resp.status_code == 200
    assert resp.json()["is_read"] is True


@pytest.mark.asyncio
async def test_unauthorized_without_token(client: AsyncClient):
    """All notification endpoints require auth."""
    resp = await client.get("/api/v1/notifications")
    assert resp.status_code == 401
