import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.workflow import WorkflowDef
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


# -- Check-in tests --


@pytest.mark.asyncio
async def test_check_in_creates_record(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "att1", "att1@test.com", is_superuser=True)
    token = await login(client, "att1")

    resp = await client.post("/api/v1/attendance/check-in", headers=auth_header(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] in ("normal", "late")
    assert data["check_in_time"] is not None
    assert data["source"] == "check_in"


@pytest.mark.asyncio
async def test_check_in_idempotent_update(client: AsyncClient, db_session: AsyncSession):
    """Check-in twice: second call updates check_in_time but doesn't error."""
    await create_user(db_session, "att2", "att2@test.com", is_superuser=True)
    token = await login(client, "att2")

    resp1 = await client.post("/api/v1/attendance/check-in", headers=auth_header(token))
    assert resp1.status_code == 200

    resp2 = await client.post("/api/v1/attendance/check-in", headers=auth_header(token))
    assert resp2.status_code == 200
    assert resp2.json()["data"]["id"] == resp1.json()["data"]["id"]


@pytest.mark.asyncio
async def test_check_in_after_full_day_errors(client: AsyncClient, db_session: AsyncSession):
    """Check-in after already checked in + out should error."""
    await create_user(db_session, "att3", "att3@test.com", is_superuser=True)
    token = await login(client, "att3")

    resp = await client.post("/api/v1/attendance/check-in", headers=auth_header(token))
    assert resp.status_code == 200

    # Check out via API
    resp2 = await client.post("/api/v1/attendance/check-out", headers=auth_header(token))
    assert resp2.status_code == 200

    # Now try check-in again — should fail (already completed today)
    resp3 = await client.post("/api/v1/attendance/check-in", headers=auth_header(token))
    assert resp3.status_code == 400


# -- Check-out tests --


@pytest.mark.asyncio
async def test_check_out_after_check_in(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "att4", "att4@test.com", is_superuser=True)
    token = await login(client, "att4")

    resp = await client.post("/api/v1/attendance/check-in", headers=auth_header(token))
    assert resp.status_code == 200

    resp2 = await client.post("/api/v1/attendance/check-out", headers=auth_header(token))
    assert resp2.status_code == 200
    data = resp2.json()["data"]
    assert data["check_out_time"] is not None


@pytest.mark.asyncio
async def test_check_out_without_check_in_errors(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "att5", "att5@test.com", is_superuser=True)
    token = await login(client, "att5")

    resp = await client.post("/api/v1/attendance/check-out", headers=auth_header(token))
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_double_check_out_errors(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "att6", "att6@test.com", is_superuser=True)
    token = await login(client, "att6")

    await client.post("/api/v1/attendance/check-in", headers=auth_header(token))
    await client.post("/api/v1/attendance/check-out", headers=auth_header(token))
    resp = await client.post("/api/v1/attendance/check-out", headers=auth_header(token))
    assert resp.status_code == 400


# -- My records tests --


@pytest.mark.asyncio
async def test_get_my_records(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "att7", "att7@test.com", is_superuser=True)
    token = await login(client, "att7")

    await client.post("/api/v1/attendance/check-in", headers=auth_header(token))

    from datetime import UTC, datetime
    today = datetime.now(UTC)
    resp = await client.get(
        f"/api/v1/attendance/me?year={today.year}&month={today.month}&page=1&page_size=20",
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] >= 1
    assert len(data["items"]) >= 1


@pytest.mark.asyncio
async def test_get_my_summary(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "att8", "att8@test.com", is_superuser=True)
    token = await login(client, "att8")

    await client.post("/api/v1/attendance/check-in", headers=auth_header(token))

    from datetime import UTC, datetime
    today = datetime.now(UTC)
    resp = await client.get(
        f"/api/v1/attendance/me/summary?year={today.year}&month={today.month}",
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["normal_days"] + data["late_days"] >= 1


# -- Team view tests --


@pytest.mark.asyncio
async def test_team_summary_returns_subordinates(client: AsyncClient, db_session: AsyncSession):
    manager = await create_user(db_session, "mgr1", "mgr1@test.com", is_superuser=True)
    sub = await create_user(db_session, "sub1", "sub1@test.com", manager_id=manager.id, is_superuser=True)
    token = await login(client, "mgr1")

    # sub checks in
    sub_token = await login(client, "sub1")
    await client.post("/api/v1/attendance/check-in", headers=auth_header(sub_token))

    from datetime import UTC, datetime
    today = datetime.now(UTC)
    resp = await client.get(
        f"/api/v1/attendance/team?year={today.year}&month={today.month}",
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    items = resp.json()["data"]
    assert len(items) >= 1
    sub_item = next((i for i in items if i["user_id"] == sub.id), None)
    assert sub_item is not None
    assert sub_item["username"] == "sub1"


@pytest.mark.asyncio
async def test_team_summary_empty_for_user_without_subs(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "user1", "user1@test.com", is_superuser=True)
    token = await login(client, "user1")

    from datetime import UTC, datetime
    today = datetime.now(UTC)
    resp = await client.get(
        f"/api/v1/attendance/team?year={today.year}&month={today.month}",
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    assert resp.json()["data"] == []


@pytest.mark.asyncio
async def test_team_member_detail(client: AsyncClient, db_session: AsyncSession):
    manager = await create_user(db_session, "mgr2", "mgr2@test.com", is_superuser=True)
    sub = await create_user(db_session, "sub2", "sub2@test.com", manager_id=manager.id, is_superuser=True)
    token = await login(client, "mgr2")

    from datetime import UTC, datetime
    today = datetime.now(UTC)
    resp = await client.get(
        f"/api/v1/attendance/team/{sub.id}?year={today.year}&month={today.month}",
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["user_id"] == sub.id
    assert data["username"] == "sub2"
    assert "summary" in data
    assert "recent_leaves" in data


@pytest.mark.asyncio
async def test_team_member_detail_not_subordinate_errors(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "mgr3", "mgr3@test.com", is_superuser=True)
    other = await create_user(db_session, "other1", "other1@test.com", is_superuser=True)
    token = await login(client, "mgr3")

    from datetime import UTC, datetime
    today = datetime.now(UTC)
    resp = await client.get(
        f"/api/v1/attendance/team/{other.id}?year={today.year}&month={today.month}",
        headers=auth_header(token),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_team_member_records(client: AsyncClient, db_session: AsyncSession):
    manager = await create_user(db_session, "mgr4", "mgr4@test.com", is_superuser=True)
    sub = await create_user(db_session, "sub3", "sub3@test.com", manager_id=manager.id, is_superuser=True)
    token = await login(client, "mgr4")
    sub_token = await login(client, "sub3")

    await client.post("/api/v1/attendance/check-in", headers=auth_header(sub_token))

    from datetime import UTC, datetime
    today = datetime.now(UTC)
    resp = await client.get(
        f"/api/v1/attendance/team/{sub.id}/records?year={today.year}&month={today.month}&page=1&page_size=20",
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_team_member_summary(client: AsyncClient, db_session: AsyncSession):
    manager = await create_user(db_session, "mgr5", "mgr5@test.com", is_superuser=True)
    sub = await create_user(db_session, "sub4", "sub4@test.com", manager_id=manager.id, is_superuser=True)
    token = await login(client, "mgr5")
    sub_token = await login(client, "sub4")

    await client.post("/api/v1/attendance/check-in", headers=auth_header(sub_token))

    from datetime import UTC, datetime
    today = datetime.now(UTC)
    resp = await client.get(
        f"/api/v1/attendance/team/{sub.id}/summary?year={today.year}&month={today.month}",
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["normal_days"] + data["late_days"] >= 1


# -- Config tests --


@pytest.mark.asyncio
async def test_get_default_config(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "att9", "att9@test.com", is_superuser=True)
    token = await login(client, "att9")

    resp = await client.get("/api/v1/attendance/config", headers=auth_header(token))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["work_start_time"] == "09:00"
    assert data["work_end_time"] == "18:00"


@pytest.mark.asyncio
async def test_update_config(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "att10", "att10@test.com", is_superuser=True)
    token = await login(client, "att10")

    resp = await client.put(
        "/api/v1/attendance/config",
        json={
            "work_start_time": "08:00",
            "work_end_time": "17:00",
            "late_tolerance_minutes": 10,
            "enable_mandatory_check_in": True,
        },
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["work_start_time"] == "08:00"
    assert data["late_tolerance_minutes"] == 10
    assert data["enable_mandatory_check_in"] is True


# -- Permission tests --


@pytest.mark.asyncio
async def test_check_in_without_permission_fails(client: AsyncClient, db_session: AsyncSession):
    """User without attendance:check-in permission should get 403."""
    # Create user without any roles (no permissions)
    from app.models.user import User
    user = User(
        username="noperm", email="noperm@test.com",
        hashed_password=get_password_hash("password123"),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token = await login(client, "noperm")

    resp = await client.post("/api/v1/attendance/check-in", headers=auth_header(token))
    assert resp.status_code == 403


# -- Leave sync tests --


LEAVE_WF_DEFINITION = {
    "nodes": [
        {"id": "start", "type": "start", "label": "Submit"},
        {"id": "manager_approve", "type": "task", "label": "Manager Approval", "assignee_type": "manager"},
        {"id": "end_approved", "type": "end", "label": "Approved", "outcome": "approved"},
        {"id": "end_rejected", "type": "end", "label": "Rejected", "outcome": "rejected"},
    ],
    "transitions": [
        {"from": "start", "action": "submit", "to": "manager_approve"},
        {"from": "manager_approve", "action": "approve", "to": "end_approved"},
        {"from": "manager_approve", "action": "reject", "to": "end_rejected"},
    ],
}


async def seed_leave_workflow(db_session: AsyncSession):
    wf = WorkflowDef(name="Leave Approval", definition=LEAVE_WF_DEFINITION)
    db_session.add(wf)
    await db_session.commit()
    await db_session.refresh(wf)
    return wf


@pytest.mark.asyncio
async def test_leave_approval_syncs_attendance(client: AsyncClient, db_session: AsyncSession):
    """When leave is approved, attendance records should be created with status=leave."""
    manager = await create_user(db_session, "attmgr", "attmgr@test.com", is_superuser=True)
    await create_user(db_session, "attemp", "attemp@test.com", manager_id=manager.id, is_superuser=True)
    await seed_leave_workflow(db_session)

    # Employee creates leave draft
    emp_token = await login(client, "attemp")
    resp = await client.post(
        "/api/v1/leaves",
        json={
            "leave_type": "annual",
            "start_date": "2026-06-01",
            "end_date": "2026-06-03",
            "duration_days": 3,
            "reason": "Vacation",
        },
        headers=auth_header(emp_token),
    )
    leave_id = resp.json()["id"]

    # Submit for approval
    resp = await client.post(f"/api/v1/leaves/{leave_id}/submit", headers=auth_header(emp_token))
    assert resp.status_code == 200
    leave_data = resp.json()
    assert leave_data["status"] == "submitted"

    # Get the pending task for the manager
    mgr_token = await login(client, "attmgr")
    tasks_resp = await client.get("/api/v1/workflow/tasks?page=1&page_size=10", headers=auth_header(mgr_token))
    tasks = tasks_resp.json()["items"]
    task = tasks[0]

    # Manager approves
    approve_resp = await client.post(
        f"/api/v1/workflow/tasks/{task['id']}/approve",
        json={"comment": "Approved"},
        headers=auth_header(mgr_token),
    )
    assert approve_resp.status_code == 200

    # Check attendance records were created
    attendance_resp = await client.get(
        "/api/v1/attendance/me?year=2026&month=6&page=1&page_size=20",
        headers=auth_header(emp_token),
    )
    assert attendance_resp.status_code == 200
    records = attendance_resp.json()["data"]["items"]
    leave_records = [r for r in records if r["status"] == "leave"]
    assert len(leave_records) == 3  # 3 days of leave
    for r in leave_records:
        assert r["source"] == "leave_sync"


@pytest.mark.asyncio
async def test_leave_rejection_cleans_up_attendance(client: AsyncClient, db_session: AsyncSession):
    """When leave is rejected, sync records should be cleaned up."""
    manager = await create_user(db_session, "attmgr2", "attmgr2@test.com", is_superuser=True)
    await create_user(db_session, "attemp2", "attemp2@test.com", manager_id=manager.id, is_superuser=True)
    await seed_leave_workflow(db_session)

    emp_token = await login(client, "attemp2")
    resp = await client.post(
        "/api/v1/leaves",
        json={
            "leave_type": "personal",
            "start_date": "2026-07-01",
            "end_date": "2026-07-02",
            "duration_days": 2,
            "reason": "Personal",
        },
        headers=auth_header(emp_token),
    )
    leave_id = resp.json()["id"]

    # Submit
    await client.post(f"/api/v1/leaves/{leave_id}/submit", headers=auth_header(emp_token))

    # Manager rejects
    mgr_token = await login(client, "attmgr2")
    tasks_resp = await client.get("/api/v1/workflow/tasks?page=1&page_size=10", headers=auth_header(mgr_token))
    tasks = tasks_resp.json()["items"]
    task = tasks[0]

    await client.post(
        f"/api/v1/workflow/tasks/{task['id']}/reject",
        json={"comment": "Denied"},
        headers=auth_header(mgr_token),
    )

    # Check no leave records exist (rejection should clean up)
    attendance_resp = await client.get(
        "/api/v1/attendance/me?year=2026&month=7&page=1&page_size=20",
        headers=auth_header(emp_token),
    )
    assert attendance_resp.status_code == 200
    records = attendance_resp.json()["data"]["items"]
    leave_records = [r for r in records if r["status"] == "leave"]
    assert len(leave_records) == 0
