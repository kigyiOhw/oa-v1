import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.security import get_password_hash

SAMPLE_DEFINITION = {
    "nodes": [
        {"id": "start", "type": "start", "label": "Submit"},
        {"id": "approve", "type": "approval", "label": "Manager Approval", "assignee_type": "initiator"},
        {"id": "end_approved", "type": "end", "label": "Approved", "outcome": "approved"},
        {"id": "end_rejected", "type": "end", "label": "Rejected", "outcome": "rejected"},
    ],
    "transitions": [
        {"from": "start", "action": "submit", "to": "approve"},
        {"from": "approve", "action": "approve", "to": "end_approved"},
        {"from": "approve", "action": "reject", "to": "end_rejected"},
    ],
}

MANAGER_DEFINITION = {
    "nodes": [
        {"id": "start", "type": "start", "label": "Submit"},
        {"id": "approve", "type": "approval", "label": "Manager Approval", "assignee_type": "manager"},
        {"id": "end_approved", "type": "end", "label": "Approved", "outcome": "approved"},
        {"id": "end_rejected", "type": "end", "label": "Rejected", "outcome": "rejected"},
    ],
    "transitions": [
        {"from": "start", "action": "submit", "to": "approve"},
        {"from": "approve", "action": "approve", "to": "end_approved"},
        {"from": "approve", "action": "reject", "to": "end_rejected"},
    ],
}


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


async def login(client: AsyncClient, username: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={
        "username": username,
        "password": "password123",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]


# -- Definition CRUD --


@pytest.mark.asyncio
async def test_create_definition(client: AsyncClient, db_session: AsyncSession):
    await create_superuser(db_session, "wfadmin1", "wfadmin1@test.com")
    token = await login(client, "wfadmin1")

    resp = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "Leave Workflow", "description": "Leave approval", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Leave Workflow"
    assert data["version"] == 1
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_create_definition_invalid_json(client: AsyncClient, db_session: AsyncSession):
    await create_superuser(db_session, "wfadmin2", "wfadmin2@test.com")
    token = await login(client, "wfadmin2")

    resp = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "Bad", "description": "x", "definition": {"nodes": []}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_list_definitions(client: AsyncClient, db_session: AsyncSession):
    await create_superuser(db_session, "wfadmin3", "wfadmin3@test.com")
    token = await login(client, "wfadmin3")

    await client.post(
        "/api/v1/workflow-defs",
        json={"name": "WF1", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.get("/api/v1/workflow-defs", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_get_definition(client: AsyncClient, db_session: AsyncSession):
    await create_superuser(db_session, "wfadmin4", "wfadmin4@test.com")
    token = await login(client, "wfadmin4")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "WF2", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {token}"},
    )
    def_id = created.json()["id"]
    resp = await client.get(f"/api/v1/workflow-defs/{def_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "WF2"


@pytest.mark.asyncio
async def test_delete_definition(client: AsyncClient, db_session: AsyncSession):
    await create_superuser(db_session, "wfadmin5", "wfadmin5@test.com")
    token = await login(client, "wfadmin5")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "WF3", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {token}"},
    )
    def_id = created.json()["id"]
    resp = await client.delete(f"/api/v1/workflow-defs/{def_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204

    resp2 = await client.get(f"/api/v1/workflow-defs/{def_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp2.status_code == 404


# -- Instance Lifecycle --


@pytest.mark.asyncio
async def test_start_instance_success(client: AsyncClient, db_session: AsyncSession):
    su = await create_superuser(db_session, "wfsu1", "wfsu1@test.com")
    token = await login(client, "wfsu1")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "Simple", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {token}"},
    )
    def_id = created.json()["id"]

    # Create a regular user to start the instance
    regular = await create_user(db_session, "starter1", "starter1@test.com")
    user_token = await login(client, "starter1")

    resp = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "My leave request"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My leave request"
    assert data["status"] == "pending"
    assert data["initiator_id"] == regular.id


@pytest.mark.asyncio
async def test_start_instance_inactive_def(client: AsyncClient, db_session: AsyncSession):
    su = await create_superuser(db_session, "wfsu2", "wfsu2@test.com")
    regular = await create_user(db_session, "starter2", "starter2@test.com")
    token = await login(client, "wfsu2")
    user_token = await login(client, "starter2")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "InactiveWF", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {token}"},
    )
    def_id = created.json()["id"]
    await client.put(
        f"/api/v1/workflow-defs/{def_id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "Should fail"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_start_instance_not_found(client: AsyncClient, db_session: AsyncSession):
    regular = await create_user(db_session, "starter3", "starter3@test.com")
    token = await login(client, "starter3")

    resp = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": 99999, "title": "Nope"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


# -- Task Processing --


@pytest.mark.asyncio
async def test_approve_task_completes_instance(client: AsyncClient, db_session: AsyncSession):
    """With assignee_type=initiator, the starter approves their own task, completing the flow."""
    su = await create_superuser(db_session, "wfta1", "wfta1@test.com")
    regular = await create_user(db_session, "approver1", "approver1@test.com")
    admin_token = await login(client, "wfta1")
    user_token = await login(client, "approver1")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "Self Approve", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    instance = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "Test"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    instance_id = instance.json()["id"]

    # Find the pending task for this instance
    tasks_resp = await client.get("/api/v1/workflow/tasks", headers={"Authorization": f"Bearer {user_token}"})
    tasks = tasks_resp.json()["items"]
    task = [t for t in tasks if t["instance_id"] == instance_id][0]

    # Approve
    approve_resp = await client.post(
        f"/api/v1/workflow/tasks/{task['id']}/approve",
        json={"comment": "Looks good"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert approve_resp.status_code == 200

    # Check task status
    assert approve_resp.json()["status"] == "approve"
    assert approve_resp.json()["comment"] == "Looks good"

    # Check instance is now approved
    instance_resp = await client.get(
        f"/api/v1/workflow/instances/{instance_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert instance_resp.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_reject_task_completes_instance(client: AsyncClient, db_session: AsyncSession):
    su = await create_superuser(db_session, "wftr1", "wftr1@test.com")
    regular = await create_user(db_session, "rejector1", "rejector1@test.com")
    admin_token = await login(client, "wftr1")
    user_token = await login(client, "rejector1")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "Reject WF", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "Rejection Test"},
        headers={"Authorization": f"Bearer {user_token}"},
    )

    tasks_resp = await client.get("/api/v1/workflow/tasks", headers={"Authorization": f"Bearer {user_token}"})
    task = tasks_resp.json()["items"][0]

    resp = await client.post(
        f"/api/v1/workflow/tasks/{task['id']}/reject",
        json={"comment": "Denied"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "reject"


@pytest.mark.asyncio
async def test_non_assignee_cannot_approve(client: AsyncClient, db_session: AsyncSession):
    su = await create_superuser(db_session, "wftna1", "wftna1@test.com")
    user_a = await create_user(db_session, "userA1", "userA1@test.com")
    user_b = await create_user(db_session, "userB1", "userB1@test.com")
    admin_token = await login(client, "wftna1")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "NonAssign", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "Test"},
        headers={"Authorization": f"Bearer {await login(client, 'userA1')}"},
    )

    tasks_resp = await client.get(
        "/api/v1/workflow/tasks",
        headers={"Authorization": f"Bearer {await login(client, 'userA1')}"},
    )
    task = tasks_resp.json()["items"][0]

    # user B tries to approve
    resp = await client.post(
        f"/api/v1/workflow/tasks/{task['id']}/approve",
        json={},
        headers={"Authorization": f"Bearer {await login(client, 'userB1')}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_cannot_approve_twice(client: AsyncClient, db_session: AsyncSession):
    su = await create_superuser(db_session, "wfttw1", "wfttw1@test.com")
    regular = await create_user(db_session, "twice1", "twice1@test.com")
    admin_token = await login(client, "wfttw1")
    user_token = await login(client, "twice1")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "Twice", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "Test"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    tasks = await client.get("/api/v1/workflow/tasks", headers={"Authorization": f"Bearer {user_token}"})
    task = tasks.json()["items"][0]

    await client.post(
        f"/api/v1/workflow/tasks/{task['id']}/approve",
        json={},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    resp = await client.post(
        f"/api/v1/workflow/tasks/{task['id']}/approve",
        json={},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 400


# -- Cancellation --


@pytest.mark.asyncio
async def test_cancel_instance_by_initiator(client: AsyncClient, db_session: AsyncSession):
    su = await create_superuser(db_session, "wfcan1", "wfcan1@test.com")
    regular = await create_user(db_session, "canceller1", "canceller1@test.com")
    admin_token = await login(client, "wfcan1")
    user_token = await login(client, "canceller1")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "CancelWF", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]
    instance = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "To Cancel"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    instance_id = instance.json()["id"]

    resp = await client.post(
        f"/api/v1/workflow/instances/{instance_id}/cancel",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_non_initiator_cannot_cancel(client: AsyncClient, db_session: AsyncSession):
    su = await create_superuser(db_session, "wfcan2", "wfcan2@test.com")
    user_a = await create_user(db_session, "cancellerA", "cancellerA@test.com")
    user_b = await create_user(db_session, "cancellerB", "cancellerB@test.com")
    admin_token = await login(client, "wfcan2")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "CancelWF2", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]
    instance = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "Test"},
        headers={"Authorization": f"Bearer {await login(client, 'cancellerA')}"},
    )
    instance_id = instance.json()["id"]

    resp = await client.post(
        f"/api/v1/workflow/instances/{instance_id}/cancel",
        headers={"Authorization": f"Bearer {await login(client, 'cancellerB')}"},
    )
    assert resp.status_code == 403


# -- Assignee Resolution --


@pytest.mark.asyncio
async def test_manager_assignee_type(client: AsyncClient, db_session: AsyncSession):
    """With assignee_type=manager, task goes to initiator's manager."""
    su = await create_superuser(db_session, "wfmg1", "wfmg1@test.com")
    manager = await create_user(db_session, "manager1", "manager1@test.com")
    employee = await create_user(db_session, "employee1", "employee1@test.com", manager_id=manager.id)
    admin_token = await login(client, "wfmg1")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "ManagerWF", "definition": MANAGER_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "Manager Test"},
        headers={"Authorization": f"Bearer {await login(client, 'employee1')}"},
    )

    # Task should be assigned to the manager
    tasks = await client.get(
        "/api/v1/workflow/tasks",
        headers={"Authorization": f"Bearer {await login(client, 'manager1')}"},
    )
    assert len(tasks.json()["items"]) == 1
    task = tasks.json()["items"][0]
    assert task["assignee_id"] == manager.id


@pytest.mark.asyncio
async def test_manager_missing_raises_error(client: AsyncClient, db_session: AsyncSession):
    """Initiator without a manager should get 400 when using manager assignee_type."""
    su = await create_superuser(db_session, "wfmg2", "wfmg2@test.com")
    employee = await create_user(db_session, "nomgr1", "nomgr1@test.com")  # no manager_id
    admin_token = await login(client, "wfmg2")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "ManagerWF2", "definition": MANAGER_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    resp = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "No Manager"},
        headers={"Authorization": f"Bearer {await login(client, 'nomgr1')}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_my_instances_list(client: AsyncClient, db_session: AsyncSession):
    su = await create_superuser(db_session, "wflist1", "wflist1@test.com")
    regular = await create_user(db_session, "lister1", "lister1@test.com")
    admin_token = await login(client, "wflist1")
    user_token = await login(client, "lister1")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "ListWF", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "My Instance"},
        headers={"Authorization": f"Bearer {user_token}"},
    )

    resp = await client.get(
        "/api/v1/workflow/instances",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "My Instance"


@pytest.mark.asyncio
async def test_instance_detail_with_history(client: AsyncClient, db_session: AsyncSession):
    su = await create_superuser(db_session, "wfdet1", "wfdet1@test.com")
    regular = await create_user(db_session, "detailer1", "detailer1@test.com")
    admin_token = await login(client, "wfdet1")
    user_token = await login(client, "detailer1")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "DetailWF", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    instance = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "Detail Test"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    instance_id = instance.json()["id"]

    resp = await client.get(
        f"/api/v1/workflow/instances/{instance_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["history"]) >= 1
    assert data["history"][0]["action"] == "submit"
    assert len(data["tasks"]) >= 1
