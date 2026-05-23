import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.workflow import WorkflowDef
from app.utils.security import get_password_hash

LEAVE_DEFINITION = {
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

SELF_APPROVE_DEFINITION = {
    "nodes": [
        {"id": "start", "type": "start", "label": "Submit"},
        {"id": "approve", "type": "task", "label": "Self Review", "assignee_type": "initiator"},
        {"id": "end_approved", "type": "end", "label": "Approved", "outcome": "approved"},
        {"id": "end_rejected", "type": "end", "label": "Rejected", "outcome": "rejected"},
    ],
    "transitions": [
        {"from": "start", "action": "submit", "to": "approve"},
        {"from": "approve", "action": "approve", "to": "end_approved"},
        {"from": "approve", "action": "reject", "to": "end_rejected"},
    ],
}


async def create_user(db_session: AsyncSession, username: str, email: str, **kwargs) -> User:
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


async def login(client: AsyncClient, username: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={
        "username": username,
        "password": "password123",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]


async def seed_workflow(db_session: AsyncSession, name: str, definition: dict) -> WorkflowDef:
    wf = WorkflowDef(name=name, definition=definition)
    db_session.add(wf)
    await db_session.commit()
    await db_session.refresh(wf)
    return wf


# -- Draft CRUD --


@pytest.mark.asyncio
async def test_create_draft(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "leaveuser1", "leaveuser1@test.com")
    await seed_workflow(db_session, "Leave Approval", LEAVE_DEFINITION)
    token = await login(client, "leaveuser1")

    resp = await client.post(
        "/api/v1/leaves",
        json={
            "leave_type": "annual",
            "start_date": "2026-05-25",
            "end_date": "2026-05-27",
            "duration_days": 3,
            "reason": "Family vacation",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["leave_type"] == "annual"
    assert data["status"] == "draft"
    assert data["workflow_instance_id"] is None
    assert data["duration_days"] == 3


@pytest.mark.asyncio
async def test_list_my_leaves(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "leaveuser2", "leaveuser2@test.com")
    await seed_workflow(db_session, "Leave Approval", LEAVE_DEFINITION)
    token = await login(client, "leaveuser2")

    await client.post(
        "/api/v1/leaves",
        json={"leave_type": "sick", "start_date": "2026-06-01", "end_date": "2026-06-01", "duration_days": 1, "reason": "Fever"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/v1/leaves",
        json={"leave_type": "personal", "start_date": "2026-07-01", "end_date": "2026-07-02", "duration_days": 2, "reason": "Personal matters"},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get("/api/v1/leaves", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_list_leaves_filter_by_status(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "leaveuser3", "leaveuser3@test.com")
    await seed_workflow(db_session, "Leave Approval", LEAVE_DEFINITION)
    token = await login(client, "leaveuser3")

    await client.post(
        "/api/v1/leaves",
        json={"leave_type": "annual", "start_date": "2026-08-01", "end_date": "2026-08-03", "duration_days": 3, "reason": "Travel"},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get("/api/v1/leaves?status=draft", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    resp2 = await client.get("/api/v1/leaves?status=submitted", headers={"Authorization": f"Bearer {token}"})
    assert resp2.status_code == 200
    assert resp2.json()["total"] == 0


@pytest.mark.asyncio
async def test_get_leave(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "leaveuser4", "leaveuser4@test.com")
    await seed_workflow(db_session, "Leave Approval", LEAVE_DEFINITION)
    token = await login(client, "leaveuser4")

    created = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "other", "start_date": "2026-05-22", "end_date": "2026-05-22", "duration_days": 1, "reason": "Errand"},
        headers={"Authorization": f"Bearer {token}"},
    )
    leave_id = created.json()["id"]

    resp = await client.get(f"/api/v1/leaves/{leave_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["leave_type"] == "other"


@pytest.mark.asyncio
async def test_update_draft(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "leaveuser5", "leaveuser5@test.com")
    await seed_workflow(db_session, "Leave Approval", LEAVE_DEFINITION)
    token = await login(client, "leaveuser5")

    created = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "annual", "start_date": "2026-09-01", "end_date": "2026-09-02", "duration_days": 2, "reason": "Trip"},
        headers={"Authorization": f"Bearer {token}"},
    )
    leave_id = created.json()["id"]

    resp = await client.put(
        f"/api/v1/leaves/{leave_id}",
        json={"reason": "Updated reason", "duration_days": 3},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["reason"] == "Updated reason"


@pytest.mark.asyncio
async def test_delete_draft(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "leaveuser6", "leaveuser6@test.com")
    await seed_workflow(db_session, "Leave Approval", LEAVE_DEFINITION)
    token = await login(client, "leaveuser6")

    created = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "personal", "start_date": "2026-10-01", "end_date": "2026-10-01", "duration_days": 1, "reason": "X"},
        headers={"Authorization": f"Bearer {token}"},
    )
    leave_id = created.json()["id"]

    resp = await client.delete(f"/api/v1/leaves/{leave_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204

    resp2 = await client.get(f"/api/v1/leaves/{leave_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_cannot_edit_non_draft(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "leaveuser7", "leaveuser7@test.com")
    await seed_workflow(db_session, "Leave Approval", LEAVE_DEFINITION)
    token = await login(client, "leaveuser7")

    created = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "sick", "start_date": "2026-06-10", "end_date": "2026-06-10", "duration_days": 1, "reason": "Cold"},
        headers={"Authorization": f"Bearer {token}"},
    )
    leave_id = created.json()["id"]

    await client.post(f"/api/v1/leaves/{leave_id}/submit", headers={"Authorization": f"Bearer {token}"})

    resp = await client.put(
        f"/api/v1/leaves/{leave_id}",
        json={"reason": "Changed"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_cannot_delete_non_draft(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "leaveuser8", "leaveuser8@test.com")
    await seed_workflow(db_session, "Leave Approval", LEAVE_DEFINITION)
    token = await login(client, "leaveuser8")

    created = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "annual", "start_date": "2026-07-01", "end_date": "2026-07-01", "duration_days": 1, "reason": "X"},
        headers={"Authorization": f"Bearer {token}"},
    )
    leave_id = created.json()["id"]

    await client.post(f"/api/v1/leaves/{leave_id}/submit", headers={"Authorization": f"Bearer {token}"})

    resp = await client.delete(f"/api/v1/leaves/{leave_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 400


# -- Submit & Cancel --


@pytest.mark.asyncio
async def test_submit_creates_workflow_instance(client: AsyncClient, db_session: AsyncSession):
    manager = await create_user(db_session, "mgr1", "mgr1@test.com")
    employee = await create_user(db_session, "emp1", "emp1@test.com", manager_id=manager.id)
    await seed_workflow(db_session, "Leave Approval", LEAVE_DEFINITION)
    user_token = await login(client, "emp1")

    created = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "annual", "start_date": "2026-08-01", "end_date": "2026-08-05", "duration_days": 5, "reason": "Summer break"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    leave_id = created.json()["id"]

    resp = await client.post(f"/api/v1/leaves/{leave_id}/submit", headers={"Authorization": f"Bearer {user_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "submitted"
    assert data["workflow_instance_id"] is not None

    # Verify manager has a pending task
    mgr_token = await login(client, "mgr1")
    tasks = await client.get("/api/v1/workflow/tasks", headers={"Authorization": f"Bearer {mgr_token}"})
    assert tasks.json()["total"] == 1


@pytest.mark.asyncio
async def test_submit_without_workflow_def_returns_500(client: AsyncClient, db_session: AsyncSession):
    """If no 'Leave Approval' workflow definition exists, submit returns 500."""
    employee = await create_user(db_session, "emp2", "emp2@test.com")
    # Do NOT seed the workflow definition
    token = await login(client, "emp2")

    created = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "annual", "start_date": "2026-05-25", "end_date": "2026-05-27", "duration_days": 3, "reason": "Holiday"},
        headers={"Authorization": f"Bearer {token}"},
    )
    leave_id = created.json()["id"]

    resp = await client.post(f"/api/v1/leaves/{leave_id}/submit", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 500


@pytest.mark.asyncio
async def test_cannot_submit_non_draft(client: AsyncClient, db_session: AsyncSession):
    employee = await create_user(db_session, "emp3", "emp3@test.com")
    await seed_workflow(db_session, "Leave Approval", LEAVE_DEFINITION)
    token = await login(client, "emp3")

    created = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "sick", "start_date": "2026-06-01", "end_date": "2026-06-01", "duration_days": 1, "reason": "X"},
        headers={"Authorization": f"Bearer {token}"},
    )
    leave_id = created.json()["id"]

    await client.post(f"/api/v1/leaves/{leave_id}/submit", headers={"Authorization": f"Bearer {token}"})
    resp = await client.post(f"/api/v1/leaves/{leave_id}/submit", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_cancel_submitted_leave(client: AsyncClient, db_session: AsyncSession):
    employee = await create_user(db_session, "emp4", "emp4@test.com")
    await seed_workflow(db_session, "Leave Approval", LEAVE_DEFINITION)
    token = await login(client, "emp4")

    created = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "personal", "start_date": "2026-05-30", "end_date": "2026-05-30", "duration_days": 1, "reason": "Appointment"},
        headers={"Authorization": f"Bearer {token}"},
    )
    leave_id = created.json()["id"]

    await client.post(f"/api/v1/leaves/{leave_id}/submit", headers={"Authorization": f"Bearer {token}"})

    resp = await client.post(f"/api/v1/leaves/{leave_id}/cancel", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cannot_cancel_non_self(client: AsyncClient, db_session: AsyncSession):
    emp_a = await create_user(db_session, "emp_a", "emp_a@test.com")
    emp_b = await create_user(db_session, "emp_b", "emp_b@test.com")
    await seed_workflow(db_session, "Leave Approval", LEAVE_DEFINITION)
    token_a = await login(client, "emp_a")
    token_b = await login(client, "emp_b")

    created = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "other", "start_date": "2026-05-22", "end_date": "2026-05-22", "duration_days": 1, "reason": "X"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    leave_id = created.json()["id"]

    await client.post(f"/api/v1/leaves/{leave_id}/submit", headers={"Authorization": f"Bearer {token_a}"})

    resp = await client.post(f"/api/v1/leaves/{leave_id}/cancel", headers={"Authorization": f"Bearer {token_b}"})
    assert resp.status_code == 403


# -- Full flow: draft → submit → approve → status synced --


@pytest.mark.asyncio
async def test_full_approval_flow(client: AsyncClient, db_session: AsyncSession):
    """End-to-end: create draft → submit → manager approves → leave status reflects approval."""
    manager = await create_user(db_session, "fullmgr", "fullmgr@test.com")
    employee = await create_user(db_session, "fullemp", "fullemp@test.com", manager_id=manager.id)
    await seed_workflow(db_session, "Leave Approval", LEAVE_DEFINITION)
    emp_token = await login(client, "fullemp")
    mgr_token = await login(client, "fullmgr")

    # 1. Create draft
    created = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "annual", "start_date": "2026-12-20", "end_date": "2026-12-25", "duration_days": 5, "reason": "Christmas holiday"},
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    leave_id = created.json()["id"]

    # 2. Submit
    submit_resp = await client.post(f"/api/v1/leaves/{leave_id}/submit", headers={"Authorization": f"Bearer {emp_token}"})
    assert submit_resp.status_code == 200
    instance_id = submit_resp.json()["workflow_instance_id"]

    # 3. Manager fetches pending tasks
    tasks = await client.get("/api/v1/workflow/tasks", headers={"Authorization": f"Bearer {mgr_token}"})
    task = tasks.json()["items"][0]
    assert task["instance_id"] == instance_id
    assert task["assignee_id"] == manager.id

    # 4. Manager approves
    approve = await client.post(
        f"/api/v1/workflow/tasks/{task['id']}/approve",
        json={"comment": "Enjoy your holiday"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert approve.status_code == 200

    # 5. Verify leave status synced to approved
    leave_resp = await client.get(f"/api/v1/leaves/{leave_id}", headers={"Authorization": f"Bearer {emp_token}"})
    assert leave_resp.status_code == 200
    assert leave_resp.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_full_rejection_flow(client: AsyncClient, db_session: AsyncSession):
    """End-to-end: create draft → submit → self-approve rejection → leave status reflects rejection."""
    employee = await create_user(db_session, "selfemp", "selfemp@test.com")
    await seed_workflow(db_session, "Leave Approval", SELF_APPROVE_DEFINITION)
    token = await login(client, "selfemp")

    # 1. Create and submit
    created = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "personal", "start_date": "2026-06-10", "end_date": "2026-06-10", "duration_days": 1, "reason": "Test"},
        headers={"Authorization": f"Bearer {token}"},
    )
    leave_id = created.json()["id"]
    await client.post(f"/api/v1/leaves/{leave_id}/submit", headers={"Authorization": f"Bearer {token}"})

    # 2. Find task and reject it
    tasks = await client.get("/api/v1/workflow/tasks", headers={"Authorization": f"Bearer {token}"})
    task = tasks.json()["items"][0]

    await client.post(
        f"/api/v1/workflow/tasks/{task['id']}/reject",
        json={"comment": "Not approved"},
        headers={"Authorization": f"Bearer {token}"},
    )

    # 3. Verify leave status
    leave_resp = await client.get(f"/api/v1/leaves/{leave_id}", headers={"Authorization": f"Bearer {token}"})
    assert leave_resp.json()["status"] == "rejected"


@pytest.mark.asyncio
async def test_end_date_before_start_rejected(client: AsyncClient, db_session: AsyncSession):
    await create_user(db_session, "dateuser", "dateuser@test.com")
    await seed_workflow(db_session, "Leave Approval", LEAVE_DEFINITION)
    token = await login(client, "dateuser")

    resp = await client.post(
        "/api/v1/leaves",
        json={"leave_type": "annual", "start_date": "2026-06-10", "end_date": "2026-06-05", "duration_days": 1, "reason": "Bad dates"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
