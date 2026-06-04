import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.security import get_password_hash


async def create_user(
    db_session: AsyncSession, username: str, email: str, **kwargs
) -> User:
    user = User(
        username=username,
        email=email,
        hashed_password=get_password_hash("password123"),
        **kwargs,
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


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# -- Dashboard stats tests --


@pytest.mark.asyncio
async def test_dashboard_stats_requires_auth(client: AsyncClient):
    """Unauthenticated requests should get 401."""
    resp = await client.get("/api/v1/dashboard/stats")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_dashboard_stats_returns_workflow_data(
    client: AsyncClient, db_session: AsyncSession
):
    """Regular user gets workflow + attendance + leave stats, no org/asset."""
    user = await create_user(db_session, "dash1", "dash1@test.com")
    token = await login(client, "dash1")

    resp = await client.get("/api/v1/dashboard/stats", headers=auth_header(token))
    assert resp.status_code == 200
    data = resp.json()["data"]

    # Regular user: org and asset should be null
    assert data["org"] is None
    assert data["asset"] is None

    # Workflow stats should be present
    assert "workflow" in data
    wf = data["workflow"]
    assert isinstance(wf["pending_tasks"], int)
    assert isinstance(wf["initiated"], int)
    assert isinstance(wf["processed"], int)

    # Leave stats should be present
    assert "leave" in data
    leave = data["leave"]
    assert isinstance(leave["total_this_month"], int)
    assert isinstance(leave["by_type"], dict)
    assert isinstance(leave["by_status"], dict)

    # Attendance overview should be present
    assert "attendance" in data
    att = data["attendance"]
    assert isinstance(att["work_days"], int)
    assert isinstance(att["late_count"], int)
    assert isinstance(att["early_count"], int)
    assert isinstance(att["absent_count"], int)
    assert isinstance(att["leave_count"], int)


@pytest.mark.asyncio
async def test_dashboard_stats_admin_sees_org_and_asset(
    client: AsyncClient, db_session: AsyncSession
):
    """Super admin gets org overview and asset overview."""
    user = await create_user(db_session, "dash2", "dash2@test.com", is_superuser=True)
    token = await login(client, "dash2")

    resp = await client.get("/api/v1/dashboard/stats", headers=auth_header(token))
    assert resp.status_code == 200
    data = resp.json()["data"]

    # Admin: org should be populated
    assert data["org"] is not None
    org = data["org"]
    assert isinstance(org["total_users"], int)
    assert isinstance(org["total_departments"], int)
    assert isinstance(org["users_by_department"], list)

    # Admin: asset should be populated
    assert data["asset"] is not None
    asset = data["asset"]
    assert isinstance(asset["total"], int)
    assert isinstance(asset["by_status"], dict)


@pytest.mark.asyncio
async def test_dashboard_stats_workflow_counts_match(
    client: AsyncClient, db_session: AsyncSession
):
    """Pending task count should be 0 for a new user with no tasks."""
    user = await create_user(db_session, "dash3", "dash3@test.com")
    token = await login(client, "dash3")

    resp = await client.get("/api/v1/dashboard/stats", headers=auth_header(token))
    assert resp.status_code == 200
    wf = resp.json()["data"]["workflow"]

    # New user has no tasks, no instances, no history
    assert wf["pending_tasks"] == 0
    assert wf["initiated"] == 0
    assert wf["processed"] == 0
