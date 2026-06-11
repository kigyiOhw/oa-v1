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


# -- Conditional Routing --

CONDITION_DEFINITION = {
    "nodes": [
        {"id": "start", "type": "start", "label": "Submit"},
        {"id": "amount_check", "type": "condition", "label": "Amount Check"},
        {"id": "manager_approve", "type": "approval", "label": "Manager Approval", "assignee_type": "manager"},
        {"id": "director_approve", "type": "approval", "label": "Director Approval", "assignee_type": "role", "assignee_value": "director"},
        {"id": "end_approved", "type": "end", "label": "Approved", "outcome": "approved"},
        {"id": "end_rejected", "type": "end", "label": "Rejected", "outcome": "rejected"},
    ],
    "transitions": [
        {"from": "start", "action": "submit", "to": "amount_check"},
        {"from": "amount_check", "action": "default", "to": "manager_approve", "conditions": [{"field": "amount", "operator": "<=", "value": 5000}]},
        {"from": "amount_check", "action": "default", "to": "director_approve", "conditions": [{"field": "amount", "operator": ">", "value": 5000}]},
        {"from": "manager_approve", "action": "approve", "to": "end_approved"},
        {"from": "manager_approve", "action": "reject", "to": "end_rejected"},
        {"from": "director_approve", "action": "approve", "to": "end_approved"},
        {"from": "director_approve", "action": "reject", "to": "end_rejected"},
    ],
}


@pytest.mark.asyncio
async def test_conditional_routing_low_amount(client: AsyncClient, db_session: AsyncSession):
    """Amount <= 5000 routes to manager approval."""
    su = await create_superuser(db_session, "wfcond1", "wfcond1@test.com")
    manager = await create_user(db_session, "condmgr1", "condmgr1@test.com")
    employee = await create_user(db_session, "condemp1", "condemp1@test.com", manager_id=manager.id)
    admin_token = await login(client, "wfcond1")
    emp_token = await login(client, "condemp1")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "CondWF", "definition": CONDITION_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    instance = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "Low Amount", "form_data": {"amount": 3000}},
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    instance_id = instance.json()["id"]

    # Task should go to manager
    tasks = await client.get("/api/v1/workflow/tasks", headers={"Authorization": f"Bearer {await login(client, 'condmgr1')}"})
    assert len(tasks.json()["items"]) == 1
    task = tasks.json()["items"][0]
    assert task["node_id"] == "manager_approve"


@pytest.mark.asyncio
async def test_conditional_routing_high_amount(client: AsyncClient, db_session: AsyncSession):
    """Amount > 5000 routes to director approval."""
    su = await create_superuser(db_session, "wfcond2", "wfcond2@test.com")
    manager = await create_user(db_session, "condmgr2", "condmgr2@test.com")
    employee = await create_user(db_session, "condemp2", "condemp2@test.com", manager_id=manager.id)
    # Create director role user
    from app.models.user import Role
    role = Role(name="director", description="Director")
    db_session.add(role)
    await db_session.commit()
    director = await create_user(db_session, "conddir", "conddir@test.com")
    await db_session.refresh(director, ["roles"])
    director.roles.append(role)
    await db_session.commit()

    admin_token = await login(client, "wfcond2")
    emp_token = await login(client, "condemp2")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "CondWF2", "definition": CONDITION_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    instance = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "High Amount", "form_data": {"amount": 8000}},
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    instance_id = instance.json()["id"]

    # Task should go to director
    dir_token = await login(client, "conddir")
    tasks = await client.get("/api/v1/workflow/tasks", headers={"Authorization": f"Bearer {dir_token}"})
    assert len(tasks.json()["items"]) == 1
    task = tasks.json()["items"][0]
    assert task["node_id"] == "director_approve"


@pytest.mark.asyncio
async def test_conditional_routing_no_match(client: AsyncClient, db_session: AsyncSession):
    """No matching condition should raise 400."""
    su = await create_superuser(db_session, "wfcond3", "wfcond3@test.com")
    employee = await create_user(db_session, "condemp3", "condemp3@test.com")
    admin_token = await login(client, "wfcond3")
    emp_token = await login(client, "condemp3")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "CondWF3", "definition": CONDITION_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    # Missing amount field → no condition matches
    resp = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "No Amount", "form_data": {}},
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    assert resp.status_code == 400


# -- Multi-level Approval Chain --

CHAIN_DEFINITION = {
    "nodes": [
        {"id": "start", "type": "start", "label": "Submit"},
        {"id": "chain_approval", "type": "approval", "label": "Manager Chain", "assignee_type": "chain", "assignee_chain": [
            {"type": "manager"},
            {"type": "role", "value": "director"},
        ]},
        {"id": "end_approved", "type": "end", "label": "Approved", "outcome": "approved"},
        {"id": "end_rejected", "type": "end", "label": "Rejected", "outcome": "rejected"},
    ],
    "transitions": [
        {"from": "start", "action": "submit", "to": "chain_approval"},
        {"from": "chain_approval", "action": "approve", "to": "end_approved"},
        {"from": "chain_approval", "action": "reject", "to": "end_rejected"},
    ],
}


@pytest.mark.asyncio
async def test_approval_chain_full_approve(client: AsyncClient, db_session: AsyncSession):
    """Chain [manager, director]: both approve → instance approved."""
    su = await create_superuser(db_session, "wfch1", "wfch1@test.com")
    from app.models.user import Role
    role = Role(name="director", description="Director")
    db_session.add(role)
    await db_session.commit()
    manager = await create_user(db_session, "chmgr1", "chmgr1@test.com")
    director = await create_user(db_session, "chdir1", "chdir1@test.com")
    await db_session.refresh(director, ["roles"])
    director.roles.append(role)
    await db_session.commit()
    employee = await create_user(db_session, "chemp1", "chemp1@test.com", manager_id=manager.id)
    admin_token = await login(client, "wfch1")
    emp_token = await login(client, "chemp1")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "ChainWF", "definition": CHAIN_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    instance = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "Chain Test"},
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    instance_id = instance.json()["id"]

    # First task goes to manager
    mgr_token = await login(client, "chmgr1")
    tasks = await client.get("/api/v1/workflow/tasks", headers={"Authorization": f"Bearer {mgr_token}"})
    assert len(tasks.json()["items"]) == 1
    task1 = tasks.json()["items"][0]
    assert task1["chain_index"] == 0

    # Manager approves
    await client.post(
        f"/api/v1/workflow/tasks/{task1['id']}/approve",
        json={"comment": "Manager OK"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )

    # Second task goes to director
    dir_token = await login(client, "chdir1")
    tasks = await client.get("/api/v1/workflow/tasks", headers={"Authorization": f"Bearer {dir_token}"})
    assert len(tasks.json()["items"]) == 1
    task2 = tasks.json()["items"][0]
    assert task2["chain_index"] == 1

    # Director approves → instance complete
    await client.post(
        f"/api/v1/workflow/tasks/{task2['id']}/approve",
        json={"comment": "Director OK"},
        headers={"Authorization": f"Bearer {dir_token}"},
    )

    instance_resp = await client.get(
        f"/api/v1/workflow/instances/{instance_id}",
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    assert instance_resp.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_approval_chain_reject_at_first_level(client: AsyncClient, db_session: AsyncSession):
    """Chain reject at first level → instance rejected."""
    su = await create_superuser(db_session, "wfch2", "wfch2@test.com")
    manager = await create_user(db_session, "chmgr2", "chmgr2@test.com")
    employee = await create_user(db_session, "chemp2", "chemp2@test.com", manager_id=manager.id)
    admin_token = await login(client, "wfch2")
    emp_token = await login(client, "chemp2")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "ChainWF2", "definition": CHAIN_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    instance = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "Chain Reject"},
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    instance_id = instance.json()["id"]

    mgr_token = await login(client, "chmgr2")
    tasks = await client.get("/api/v1/workflow/tasks", headers={"Authorization": f"Bearer {mgr_token}"})
    task1 = tasks.json()["items"][0]

    await client.post(
        f"/api/v1/workflow/tasks/{task1['id']}/reject",
        json={"comment": "Manager rejects"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )

    instance_resp = await client.get(
        f"/api/v1/workflow/instances/{instance_id}",
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    assert instance_resp.json()["status"] == "rejected"


# -- Validation --


@pytest.mark.asyncio
async def test_validate_definition_endpoint(client: AsyncClient, db_session: AsyncSession):
    su = await create_superuser(db_session, "wfval1", "wfval1@test.com")
    token = await login(client, "wfval1")

    # Valid definition
    resp = await client.post(
        "/api/v1/workflow-defs/validate",
        json={"definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is True
    assert resp.json()["errors"] == []

    # Dead loop
    loop_def = {
        "nodes": [
            {"id": "start", "type": "start", "label": "S"},
            {"id": "a", "type": "approval", "label": "A", "assignee_type": "initiator"},
            {"id": "end", "type": "end", "label": "E", "outcome": "approved"},
        ],
        "transitions": [
            {"from": "start", "action": "submit", "to": "a"},
            {"from": "a", "action": "approve", "to": "a"},
        ],
    }
    resp = await client.post(
        "/api/v1/workflow-defs/validate",
        json={"definition": loop_def},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is False
    assert "Dead loop" in resp.json()["errors"][0]

    # Orphaned node
    orphan_def = {
        "nodes": [
            {"id": "start", "type": "start", "label": "S"},
            {"id": "a", "type": "approval", "label": "A", "assignee_type": "initiator"},
            {"id": "orphan", "type": "end", "label": "O", "outcome": "approved"},
            {"id": "end", "type": "end", "label": "E", "outcome": "approved"},
        ],
        "transitions": [
            {"from": "start", "action": "submit", "to": "a"},
            {"from": "a", "action": "approve", "to": "end"},
        ],
    }
    resp = await client.post(
        "/api/v1/workflow-defs/validate",
        json={"definition": orphan_def},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is False
    assert "Orphaned" in resp.json()["errors"][0]

    # Condition node with < 2 outgoing edges
    bad_cond_def = {
        "nodes": [
            {"id": "start", "type": "start", "label": "S"},
            {"id": "cond", "type": "condition", "label": "C"},
            {"id": "end", "type": "end", "label": "E", "outcome": "approved"},
        ],
        "transitions": [
            {"from": "start", "action": "submit", "to": "cond"},
            {"from": "cond", "action": "default", "to": "end"},
        ],
    }
    resp = await client.post(
        "/api/v1/workflow-defs/validate",
        json={"definition": bad_cond_def},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is False
    assert "at least 2" in resp.json()["errors"][0]


NESTED_CONDITION_DEFINITION = {
    "nodes": [
        {"id": "start", "type": "start", "label": "Submit"},
        {"id": "amount_check", "type": "condition", "label": "Amount Check"},
        {"id": "manager_approve", "type": "approval", "label": "Manager Approval", "assignee_type": "manager"},
        {"id": "director_approve", "type": "approval", "label": "Director Approval", "assignee_type": "role", "assignee_value": "director"},
        {"id": "end_approved", "type": "end", "label": "Approved", "outcome": "approved"},
        {"id": "end_rejected", "type": "end", "label": "Rejected", "outcome": "rejected"},
    ],
    "transitions": [
        {"from": "start", "action": "submit", "to": "amount_check"},
        {
            "from": "amount_check",
            "action": "default",
            "to": "director_approve",
            "conditions": {
                "operator": "AND",
                "rules": [
                    {"field": "amount", "operator": ">", "value": 5000},
                    {
                        "operator": "OR",
                        "rules": [
                            {"field": "department", "operator": "==", "value": "IT"},
                            {"field": "department", "operator": "==", "value": "Finance"},
                        ],
                    },
                ],
            },
        },
        {"from": "amount_check", "action": "default", "to": "manager_approve"},
        {"from": "manager_approve", "action": "approve", "to": "end_approved"},
        {"from": "manager_approve", "action": "reject", "to": "end_rejected"},
        {"from": "director_approve", "action": "approve", "to": "end_approved"},
        {"from": "director_approve", "action": "reject", "to": "end_rejected"},
    ],
}


@pytest.mark.asyncio
async def test_nested_conditions_and_or(client: AsyncClient, db_session: AsyncSession):
    """Nested AND/OR: amount > 5000 AND (department == IT OR department == Finance) → director."""
    su = await create_superuser(db_session, "wfnest1", "wfnest1@test.com")
    from app.models.user import Role
    role = Role(name="director", description="Director")
    db_session.add(role)
    await db_session.commit()
    manager = await create_user(db_session, "nestmgr1", "nestmgr1@test.com")
    director = await create_user(db_session, "nestdir1", "nestdir1@test.com")
    await db_session.refresh(director, ["roles"])
    director.roles.append(role)
    await db_session.commit()
    employee = await create_user(db_session, "nestemp1", "nestemp1@test.com", manager_id=manager.id)
    admin_token = await login(client, "wfnest1")
    emp_token = await login(client, "nestemp1")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "NestedCondWF", "definition": NESTED_CONDITION_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    # Case 1: amount=8000, dept=IT → matches nested AND/OR → director
    instance = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "Nested OK", "form_data": {"amount": 8000, "department": "IT"}},
        headers={"Authorization": f"Bearer {emp_token}"},
    )
    dir_token = await login(client, "nestdir1")
    tasks = await client.get("/api/v1/workflow/tasks", headers={"Authorization": f"Bearer {dir_token}"})
    assert len(tasks.json()["items"]) == 1
    assert tasks.json()["items"][0]["node_id"] == "director_approve"

    # Case 2: amount=8000, dept=HR → fails OR branch → falls through to manager
    employee2 = await create_user(db_session, "nestemp2", "nestemp2@test.com", manager_id=manager.id)
    emp2_token = await login(client, "nestemp2")
    instance2 = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "Nested Fail", "form_data": {"amount": 8000, "department": "HR"}},
        headers={"Authorization": f"Bearer {emp2_token}"},
    )
    mgr_token = await login(client, "nestmgr1")
    tasks2 = await client.get("/api/v1/workflow/tasks", headers={"Authorization": f"Bearer {mgr_token}"})
    # Manager gets only the second instance's task (first went to director)
    assert len(tasks2.json()["items"]) == 1
    assert tasks2.json()["items"][0]["node_id"] == "manager_approve"


# -- Backward Compatibility --


@pytest.mark.asyncio
async def test_old_definition_still_works(client: AsyncClient, db_session: AsyncSession):
    """Definitions without conditions or assignee_chain continue to work."""
    su = await create_superuser(db_session, "wfbc1", "wfbc1@test.com")
    regular = await create_user(db_session, "bccuser1", "bccuser1@test.com")
    admin_token = await login(client, "wfbc1")
    user_token = await login(client, "bccuser1")

    created = await client.post(
        "/api/v1/workflow-defs",
        json={"name": "BC WF", "definition": SAMPLE_DEFINITION},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    def_id = created.json()["id"]

    instance = await client.post(
        "/api/v1/workflow/instances",
        json={"workflow_def_id": def_id, "title": "BC Test"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert instance.status_code == 201

    tasks = await client.get("/api/v1/workflow/tasks", headers={"Authorization": f"Bearer {user_token}"})
    task = tasks.json()["items"][0]
    assert task.get("chain_index") is None

    await client.post(
        f"/api/v1/workflow/tasks/{task['id']}/approve",
        json={},
        headers={"Authorization": f"Bearer {user_token}"},
    )

    instance_resp = await client.get(
        f"/api/v1/workflow/instances/{instance.json()['id']}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    data = instance_resp.json()
    assert data["status"] == "approved"
    assert len(data["tasks"]) >= 1


# -- Password Change --


@pytest.mark.asyncio
async def test_change_password_success(client: AsyncClient, db_session: AsyncSession):
    user = await create_user(db_session, "pwduser1", "pwd1@test.com")
    token = await login(client, "pwduser1")

    resp = await client.put(
        "/api/v1/auth/me/password",
        json={"old_password": "password123", "new_password": "newpass99", "confirm_password": "newpass99"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200

    # Old password no longer works
    resp_old = await client.post("/api/v1/auth/login", json={"username": "pwduser1", "password": "password123"})
    assert resp_old.status_code == 401

    # New password works
    resp_new = await client.post("/api/v1/auth/login", json={"username": "pwduser1", "password": "newpass99"})
    assert resp_new.status_code == 200


@pytest.mark.asyncio
async def test_change_password_wrong_old(client: AsyncClient, db_session: AsyncSession):
    user = await create_user(db_session, "pwduser2", "pwd2@test.com")
    token = await login(client, "pwduser2")

    resp = await client.put(
        "/api/v1/auth/me/password",
        json={"old_password": "wrongpass", "new_password": "newpass99", "confirm_password": "newpass99"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_change_password_mismatch(client: AsyncClient, db_session: AsyncSession):
    user = await create_user(db_session, "pwduser3", "pwd3@test.com")
    token = await login(client, "pwduser3")

    resp = await client.put(
        "/api/v1/auth/me/password",
        json={"old_password": "password123", "new_password": "newpass99", "confirm_password": "different"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422
