import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.employee import EmployeeProfile
from app.models.user import Permission, Role, User
from app.models.workflow import WorkflowDef, WorkflowInstance, WorkflowTask
from app.utils.security import get_password_hash

# ── Helpers ──

async def register_user(client: AsyncClient, username: str, email: str, full_name: str = "") -> tuple[dict, str]:
    """Register a user through API. Returns (user_dict, access_token)."""
    resp = await client.post("/api/v1/auth/register", json={
        "username": username,
        "email": email,
        "password": "password123",
        "full_name": full_name,
    })
    assert resp.status_code == 201
    data = resp.json()
    return data["user"], data["access_token"]


async def login_user(client: AsyncClient, username: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={
        "username": username,
        "password": "password123",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]


async def create_user_direct(db_session: AsyncSession, username: str, email: str, **kwargs) -> User:
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


# ── 1. Auto-creation of profile on registration ──

@pytest.mark.asyncio
async def test_profile_auto_created_on_register(client: AsyncClient, db_session: AsyncSession):
    await register_user(client, "emp_reg1", "emp_reg1@test.com", "Test Employee")
    token = await login_user(client, "emp_reg1")

    resp = await client.get("/api/v1/employees/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    profile = resp.json()
    assert profile["user_id"] is not None
    assert profile["onboarding_complete"] is False
    assert profile["employment_status"] == "active"


# ── 2. Self-service: update contact info ──

@pytest.mark.asyncio
async def test_update_my_profile(client: AsyncClient, db_session: AsyncSession):
    await register_user(client, "emp_reg2", "emp_reg2@test.com")
    token = await login_user(client, "emp_reg2")

    resp = await client.put(
        "/api/v1/employees/me",
        json={"phone": "13800138000", "address": "Beijing"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["phone"] == "13800138000"
    assert data["address"] == "Beijing"


# ── 3. Onboarding flow ──

@pytest.mark.asyncio
async def test_complete_onboarding(client: AsyncClient, db_session: AsyncSession):
    await register_user(client, "emp_reg3", "emp_reg3@test.com")
    token = await login_user(client, "emp_reg3")

    resp = await client.post(
        "/api/v1/employees/me/onboarding",
        json={
            "phone": "13900139000",
            "address": "Shanghai",
            "birthday": "1990-01-15",
            "work_experience": "5 years at Tech Corp",
            "graduation_school": "Tsinghua University",
            "education_level": "bachelor",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["onboarding_complete"] is True
    assert data["birthday"] == "1990-01-15"
    assert data["education_level"] == "bachelor"


@pytest.mark.asyncio
async def test_onboarding_cannot_be_repeated(client: AsyncClient, db_session: AsyncSession):
    await register_user(client, "emp_reg4", "emp_reg4@test.com")
    token = await login_user(client, "emp_reg4")

    resp = await client.post(
        "/api/v1/employees/me/onboarding",
        json={"phone": "13800000000", "birthday": "1990-01-01"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200

    resp2 = await client.post(
        "/api/v1/employees/me/onboarding",
        json={"phone": "13800000001"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 400
    assert "already completed" in resp2.json()["detail"]


# ── 4. Admin: list with search and filter ──

@pytest.mark.asyncio
async def test_admin_list_employees(client: AsyncClient, db_session: AsyncSession):
    await register_user(client, "adm_list1", "adm_list1@test.com", "User A")
    await register_user(client, "adm_list2", "adm_list2@test.com", "User B")

    # Create superuser admin
    admin_user = await create_user_direct(db_session, "adm_list_admin", "adm_list_admin@test.com", is_superuser=True)
    token = await login_user(client, "adm_list_admin")

    resp = await client.get("/api/v1/employees", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2


@pytest.mark.asyncio
async def test_admin_search_employees(client: AsyncClient, db_session: AsyncSession):
    await register_user(client, "emp_search1", "search1@test.com", "Alice")
    await register_user(client, "emp_search2", "search2@test.com", "Bob")

    admin = await create_user_direct(db_session, "adm_search", "adm_search@test.com", is_superuser=True)
    token = await login_user(client, "adm_search")

    resp = await client.get("/api/v1/employees?search=Alice", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["full_name"] == "Alice"


@pytest.mark.asyncio
async def test_admin_filter_by_status(client: AsyncClient, db_session: AsyncSession):
    await register_user(client, "emp_filter1", "filter1@test.com")
    await register_user(client, "emp_filter2", "filter2@test.com")

    admin = await create_user_direct(db_session, "adm_filter", "adm_filter@test.com", is_superuser=True)
    token = await login_user(client, "adm_filter")

    resp = await client.get("/api/v1/employees?employment_status=active", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    for item in data["items"]:
        assert item["employment_status"] == "active"


# ── 5. Admin: get detail ──

@pytest.mark.asyncio
async def test_admin_get_employee_detail(client: AsyncClient, db_session: AsyncSession):
    user_data, _ = await register_user(client, "emp_detail1", "emp_detail1@test.com", "Detail User")
    admin = await create_user_direct(db_session, "adm_detail", "adm_detail@test.com", is_superuser=True)
    token = await login_user(client, "adm_detail")

    # Find profile_id by listing
    list_resp = await client.get("/api/v1/employees?search=emp_detail1", headers={"Authorization": f"Bearer {token}"})
    profile_id = list_resp.json()["items"][0]["id"]

    resp = await client.get(f"/api/v1/employees/{profile_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "emp_detail1"
    assert data["full_name"] == "Detail User"


# ── 6. Admin: update ──

@pytest.mark.asyncio
async def test_admin_update_employee(client: AsyncClient, db_session: AsyncSession):
    await register_user(client, "emp_upd1", "emp_upd1@test.com")
    admin = await create_user_direct(db_session, "adm_upd", "adm_upd@test.com", is_superuser=True)
    token = await login_user(client, "adm_upd")

    list_resp = await client.get("/api/v1/employees?search=emp_upd1", headers={"Authorization": f"Bearer {token}"})
    profile_id = list_resp.json()["items"][0]["id"]

    resp = await client.put(
        f"/api/v1/employees/{profile_id}",
        json={
            "phone": "13700137000",
            "birthday": "1985-06-15",
            "education_level": "master",
            "employment_status": "active",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["phone"] == "13700137000"
    assert data["birthday"] == "1985-06-15"
    assert data["education_level"] == "master"


# ── 7. Admin: delete ──

@pytest.mark.asyncio
async def test_admin_delete_employee(client: AsyncClient, db_session: AsyncSession):
    await register_user(client, "emp_del1", "emp_del1@test.com")
    admin = await create_user_direct(db_session, "adm_del", "adm_del@test.com", is_superuser=True)
    token = await login_user(client, "adm_del")

    list_resp = await client.get("/api/v1/employees?search=emp_del1", headers={"Authorization": f"Bearer {token}"})
    profile_id = list_resp.json()["items"][0]["id"]

    resp = await client.delete(f"/api/v1/employees/{profile_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204

    # Verify deleted
    get_resp = await client.get(f"/api/v1/employees/{profile_id}", headers={"Authorization": f"Bearer {token}"})
    assert get_resp.status_code == 404


# ── 8. Resign flow ──

@pytest.mark.asyncio
async def test_resign_transfer_subordinates(client: AsyncClient, db_session: AsyncSession):
    """When an employee resigns, their subordinates are reassigned to the successor."""
    # Create manager and subordinate
    mgr = await create_user_direct(db_session, "mgr_resign", "mgr_resign@test.com", full_name="Manager")
    sub = await create_user_direct(db_session, "sub_resign", "sub_resign@test.com", full_name="Subordinate", manager_id=mgr.id)
    successor = await create_user_direct(db_session, "succ_resign", "succ_resign@test.com", full_name="Successor")

    # Create employee profiles manually for direct-DB users
    for u in [mgr, sub, successor]:
        db_session.add(EmployeeProfile(user_id=u.id))
    await db_session.commit()

    admin = await create_user_direct(db_session, "adm_resign1", "adm_resign1@test.com", is_superuser=True)
    token = await login_user(client, "adm_resign1")

    # Get manager's profile
    list_resp = await client.get("/api/v1/employees?search=mgr_resign", headers={"Authorization": f"Bearer {token}"})
    mgr_profile_id = list_resp.json()["items"][0]["id"]

    # Resign the manager
    resp = await client.post(
        f"/api/v1/employees/{mgr_profile_id}/resign",
        json={"successor_id": successor.id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["employment_status"] == "resigned"
    assert data["resignation_date"] is not None

    # Verify subordinate was reassigned
    await db_session.refresh(sub)
    assert sub.manager_id == successor.id


@pytest.mark.asyncio
async def test_resign_transfer_pending_tasks(client: AsyncClient, db_session: AsyncSession):
    """When an employee resigns, their pending workflow tasks are reassigned."""
    # Create users
    assignee = await create_user_direct(db_session, "task_assignee", "task_assignee@test.com")
    successor = await create_user_direct(db_session, "task_successor", "task_successor@test.com")

    # Create profiles + workflow
    for u in [assignee, successor]:
        db_session.add(EmployeeProfile(user_id=u.id))

    wf = WorkflowDef(name="Test WF", definition={"nodes": [], "transitions": []})
    db_session.add(wf)
    await db_session.flush()

    instance = WorkflowInstance(
        workflow_def_id=wf.id,
        title="Test Instance",
        initiator_id=assignee.id,
        current_node_id="start",
    )
    db_session.add(instance)
    await db_session.flush()

    task = WorkflowTask(
        instance_id=instance.id,
        node_id="approve",
        assignee_id=assignee.id,
        status="pending",
    )
    db_session.add(task)
    await db_session.commit()

    admin = await create_user_direct(db_session, "adm_resign2", "adm_resign2@test.com", is_superuser=True)
    token = await login_user(client, "adm_resign2")

    list_resp = await client.get("/api/v1/employees?search=task_assignee", headers={"Authorization": f"Bearer {token}"})
    profile_id = list_resp.json()["items"][0]["id"]

    resp = await client.post(
        f"/api/v1/employees/{profile_id}/resign",
        json={"successor_id": successor.id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200

    # Verify task was reassigned
    await db_session.refresh(task)
    assert task.assignee_id == successor.id


@pytest.mark.asyncio
async def test_resign_cannot_resign_self(client: AsyncClient, db_session: AsyncSession):
    """Cannot set successor to the resigning employee themselves."""
    user = await create_user_direct(db_session, "self_resign", "self_resign@test.com")
    db_session.add(EmployeeProfile(user_id=user.id))
    await db_session.commit()

    admin = await create_user_direct(db_session, "adm_resign3", "adm_resign3@test.com", is_superuser=True)
    token = await login_user(client, "adm_resign3")

    list_resp = await client.get("/api/v1/employees?search=self_resign", headers={"Authorization": f"Bearer {token}"})
    profile_id = list_resp.json()["items"][0]["id"]

    resp = await client.post(
        f"/api/v1/employees/{profile_id}/resign",
        json={"successor_id": user.id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "Cannot transfer work to self" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_resign_cannot_resign_twice(client: AsyncClient, db_session: AsyncSession):
    """An already resigned employee cannot be resigned again."""
    user = await create_user_direct(db_session, "twice_resign", "twice_resign@test.com")
    successor = await create_user_direct(db_session, "twice_succ", "twice_succ@test.com")
    for u in [user, successor]:
        db_session.add(EmployeeProfile(user_id=u.id))
    await db_session.commit()

    admin = await create_user_direct(db_session, "adm_resign4", "adm_resign4@test.com", is_superuser=True)
    token = await login_user(client, "adm_resign4")

    list_resp = await client.get("/api/v1/employees?search=twice_resign", headers={"Authorization": f"Bearer {token}"})
    profile_id = list_resp.json()["items"][0]["id"]

    # First resign
    resp1 = await client.post(
        f"/api/v1/employees/{profile_id}/resign",
        json={"successor_id": successor.id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp1.status_code == 200

    # Second resign
    resp2 = await client.post(
        f"/api/v1/employees/{profile_id}/resign",
        json={"successor_id": successor.id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 400
    assert "already resigned" in resp2.json()["detail"]


# ── 9. Permission checks ──

@pytest.mark.asyncio
async def test_non_admin_cannot_list_employees(client: AsyncClient, db_session: AsyncSession):
    """Regular users without employee:read should not access the admin list endpoint."""
    await register_user(client, "normal_user1", "normal_user1@test.com")
    token = await login_user(client, "normal_user1")

    resp = await client.get("/api/v1/employees", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_self_service_works_without_admin_perm(client: AsyncClient, db_session: AsyncSession):
    """Self-service endpoints should work without admin permissions."""
    await register_user(client, "self_user1", "self_user1@test.com")
    token = await login_user(client, "self_user1")

    resp = await client.get("/api/v1/employees/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
