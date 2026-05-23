"""Tests for Phase 8: Admin hierarchy and role types."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import AdminScope, get_admin_scope, is_super_admin
from app.models.user import Role, User


def test_admin_scope_superuser():
    user = User(id=1, username="admin", email="a@t.com", hashed_password="x", is_superuser=True)
    user.roles = []
    scope = get_admin_scope(user)
    assert scope.scope == "global"


def test_admin_scope_super_admin_role():
    user = User(id=1, username="admin", email="a@t.com", hashed_password="x")
    role = Role(id=1, name="super_admin", role_type="super_admin", admin_scope="global")
    user.roles = [role]
    scope = get_admin_scope(user)
    assert scope.scope == "global"


def test_admin_scope_module_admin_global():
    user = User(id=1, username="mod", email="m@t.com", hashed_password="x")
    role = Role(id=1, name="hr_admin", role_type="module_admin", admin_scope="global")
    user.roles = [role]
    scope = get_admin_scope(user)
    assert scope.scope == "global"


def test_admin_scope_module_admin_department():
    user = User(id=1, username="mod", email="m@t.com", hashed_password="x", department_id=5)
    role = Role(id=1, name="dept_asset", role_type="module_admin", admin_scope="department")
    user.roles = [role]
    scope = get_admin_scope(user)
    assert scope.scope == "department"
    assert scope.dept_id == 5


def test_admin_scope_dept_admin():
    user = User(id=1, username="dept", email="d@t.com", hashed_password="x", department_id=3)
    role = Role(id=1, name="dept_admin", role_type="dept_admin", admin_scope="department")
    user.roles = [role]
    scope = get_admin_scope(user)
    assert scope.scope == "department"
    assert scope.dept_id == 3


def test_admin_scope_dept_admin_no_department():
    user = User(id=1, username="dept", email="d@t.com", hashed_password="x", department_id=None)
    role = Role(id=1, name="dept_admin", role_type="dept_admin", admin_scope="department")
    user.roles = [role]
    scope = get_admin_scope(user)
    assert scope.scope == "self"


def test_admin_scope_regular_user():
    user = User(id=1, username="user", email="u@t.com", hashed_password="x")
    role = Role(id=1, name="user", role_type="user")
    user.roles = [role]
    scope = get_admin_scope(user)
    assert scope.scope == "self"


def test_admin_scope_prioritizes_super_admin():
    user = User(id=1, username="multi", email="m@t.com", hashed_password="x", department_id=5)
    sa = Role(id=1, name="super_admin", role_type="super_admin", admin_scope="global")
    da = Role(id=2, name="dept_admin", role_type="dept_admin", admin_scope="department")
    user.roles = [sa, da]
    scope = get_admin_scope(user)
    assert scope.scope == "global"


def test_is_super_admin_with_is_superuser():
    user = User(id=1, username="admin", email="a@t.com", hashed_password="x", is_superuser=True)
    user.roles = []
    assert is_super_admin(user) is True


def test_is_super_admin_with_super_admin_role():
    user = User(id=1, username="admin", email="a@t.com", hashed_password="x")
    role = Role(id=1, name="super_admin", role_type="super_admin")
    user.roles = [role]
    assert is_super_admin(user) is True


def test_is_super_admin_with_module_admin_role():
    user = User(id=1, username="mod", email="m@t.com", hashed_password="x")
    role = Role(id=1, name="hr", role_type="module_admin")
    user.roles = [role]
    assert is_super_admin(user) is False


def test_is_super_admin_regular_user():
    user = User(id=1, username="user", email="u@t.com", hashed_password="x")
    role = Role(id=1, name="user", role_type="user")
    user.roles = [role]
    assert is_super_admin(user) is False


@pytest.mark.asyncio
async def test_role_types_endpoint(client: AsyncClient):
    """Test GET /roles/types returns the enum values."""
    resp = await client.get("/api/v1/roles/types")
    assert resp.status_code == 200
    types = resp.json()
    assert len(types) == 4
    values = {t["value"] for t in types}
    assert values == {"super_admin", "module_admin", "dept_admin", "user"}
