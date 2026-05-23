import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import AssetCategory
from app.models.user import User
from app.utils.security import get_password_hash


async def register_user(client: AsyncClient, username: str, email: str, full_name: str = "") -> tuple[dict, str]:
    resp = await client.post("/api/v1/auth/register", json={
        "username": username, "email": email, "password": "password123", "full_name": full_name,
    })
    assert resp.status_code == 201
    data = resp.json()
    return data["user"], data["access_token"]


async def login_user(client: AsyncClient, username: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={
        "username": username, "password": "password123",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]


async def create_user_direct(db_session: AsyncSession, username: str, email: str, **kwargs) -> User:
    user = User(username=username, email=email, hashed_password=get_password_hash("password123"), **kwargs)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# ── Category CRUD ──

@pytest.mark.asyncio
async def test_create_category(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "cat_admin", "cat_admin@test.com", is_superuser=True)
    token = await login_user(client, "cat_admin")

    resp = await client.post(
        "/api/v1/asset-categories",
        json={"name": "Electronics", "description": "All electronics"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Electronics"
    assert data["parent_id"] is None


@pytest.mark.asyncio
async def test_create_subcategory(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "cat_admin2", "cat_admin2@test.com", is_superuser=True)
    token = await login_user(client, "cat_admin2")

    resp = await client.post(
        "/api/v1/asset-categories",
        json={"name": "IT Equipment"},
        headers={"Authorization": f"Bearer {token}"},
    )
    parent_id = resp.json()["id"]

    resp2 = await client.post(
        "/api/v1/asset-categories",
        json={"name": "Laptops", "parent_id": parent_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 201
    assert resp2.json()["parent_id"] == parent_id


@pytest.mark.asyncio
async def test_list_categories_tree(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "cat_admin3", "cat_admin3@test.com", is_superuser=True)
    token = await login_user(client, "cat_admin3")

    # Create tree
    p = await client.post("/api/v1/asset-categories", json={"name": "Parent"}, headers={"Authorization": f"Bearer {token}"})
    pid = p.json()["id"]
    await client.post("/api/v1/asset-categories", json={"name": "Child", "parent_id": pid}, headers={"Authorization": f"Bearer {token}"})

    resp = await client.get("/api/v1/asset-categories", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    # Root categories should have children array
    root = next((c for c in data if c["name"] == "Parent"), None)
    assert root is not None
    assert len(root["children"]) == 1
    assert root["children"][0]["name"] == "Child"


@pytest.mark.asyncio
async def test_update_category(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "cat_admin4", "cat_admin4@test.com", is_superuser=True)
    token = await login_user(client, "cat_admin4")

    resp = await client.post("/api/v1/asset-categories", json={"name": "OldName"}, headers={"Authorization": f"Bearer {token}"})
    cat_id = resp.json()["id"]

    resp2 = await client.put(
        f"/api/v1/asset-categories/{cat_id}",
        json={"name": "NewName", "description": "Updated"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["name"] == "NewName"
    assert resp2.json()["description"] == "Updated"


@pytest.mark.asyncio
async def test_delete_category(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "cat_admin5", "cat_admin5@test.com", is_superuser=True)
    token = await login_user(client, "cat_admin5")

    resp = await client.post("/api/v1/asset-categories", json={"name": "ToDelete"}, headers={"Authorization": f"Bearer {token}"})
    cat_id = resp.json()["id"]

    resp2 = await client.delete(f"/api/v1/asset-categories/{cat_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp2.status_code == 204


# ── Asset CRUD ──

@pytest.mark.asyncio
async def test_create_asset(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "asset_admin", "asset_admin@test.com", is_superuser=True)
    token = await login_user(client, "asset_admin")

    # Create category first
    cat = await client.post("/api/v1/asset-categories", json={"name": "Laptops"}, headers={"Authorization": f"Bearer {token}"})
    cat_id = cat.json()["id"]

    resp = await client.post(
        "/api/v1/assets",
        json={"name": "ThinkPad X1", "category_id": cat_id, "purchase_price": 9999.00, "supplier": "Lenovo"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "ThinkPad X1"
    assert data["asset_code"]  # auto-generated
    assert data["status"] == "idle"


@pytest.mark.asyncio
async def test_list_assets_paginated(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "asset_admin2", "asset_admin2@test.com", is_superuser=True)
    token = await login_user(client, "asset_admin2")

    cat = await client.post("/api/v1/asset-categories", json={"name": "Furniture"}, headers={"Authorization": f"Bearer {token}"})
    cat_id = cat.json()["id"]

    for i in range(3):
        await client.post("/api/v1/assets", json={"name": f"Desk {i}", "category_id": cat_id}, headers={"Authorization": f"Bearer {token}"})

    resp = await client.get("/api/v1/assets", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 3
    assert len(data["items"]) >= 3


@pytest.mark.asyncio
async def test_list_assets_with_search(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "asset_admin3", "asset_admin3@test.com", is_superuser=True)
    token = await login_user(client, "asset_admin3")

    cat = await client.post("/api/v1/asset-categories", json={"name": "Monitors"}, headers={"Authorization": f"Bearer {token}"})
    cat_id = cat.json()["id"]
    await client.post("/api/v1/assets", json={"name": "Dell Monitor", "category_id": cat_id}, headers={"Authorization": f"Bearer {token}"})

    resp = await client.get("/api/v1/assets?search=Dell", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Dell Monitor"


@pytest.mark.asyncio
async def test_list_my_assets(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "asset_admin_my", "asset_admin_my@test.com", is_superuser=True)
    token = await login_user(client, "asset_admin_my")

    cat = await client.post("/api/v1/asset-categories", json={"name": "Phones"}, headers={"Authorization": f"Bearer {token}"})
    cat_id = cat.json()["id"]
    asset_resp = await client.post("/api/v1/assets", json={"name": "iPhone", "category_id": cat_id}, headers={"Authorization": f"Bearer {token}"})
    asset_id = asset_resp.json()["id"]

    # Assign to self
    await client.post(f"/api/v1/assets/{asset_id}/assign", json={"user_id": admin.id}, headers={"Authorization": f"Bearer {token}"})

    resp = await client.get("/api/v1/assets/my", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert any(a["id"] == asset_id for a in data)


@pytest.mark.asyncio
async def test_get_asset_detail(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "asset_admin4", "asset_admin4@test.com", is_superuser=True)
    token = await login_user(client, "asset_admin4")

    cat = await client.post("/api/v1/asset-categories", json={"name": "Printers"}, headers={"Authorization": f"Bearer {token}"})
    cat_id = cat.json()["id"]
    asset_resp = await client.post("/api/v1/assets", json={"name": "HP LaserJet", "category_id": cat_id, "supplier": "HP", "purchase_price": 2999}, headers={"Authorization": f"Bearer {token}"})
    asset_id = asset_resp.json()["id"]

    resp = await client.get(f"/api/v1/assets/{asset_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "HP LaserJet"
    assert data["supplier"] == "HP"
    assert data["purchase_price"] == 2999
    assert "assignments" in data


@pytest.mark.asyncio
async def test_update_asset(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "asset_admin5", "asset_admin5@test.com", is_superuser=True)
    token = await login_user(client, "asset_admin5")

    cat = await client.post("/api/v1/asset-categories", json={"name": "Tablets"}, headers={"Authorization": f"Bearer {token}"})
    cat_id = cat.json()["id"]
    asset_resp = await client.post("/api/v1/assets", json={"name": "iPad", "category_id": cat_id}, headers={"Authorization": f"Bearer {token}"})
    asset_id = asset_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/assets/{asset_id}",
        json={"name": "iPad Pro", "status": "repairing", "description": "Screen repair"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "iPad Pro"
    assert data["status"] == "repairing"
    assert data["description"] == "Screen repair"


@pytest.mark.asyncio
async def test_delete_asset(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "asset_admin6", "asset_admin6@test.com", is_superuser=True)
    token = await login_user(client, "asset_admin6")

    cat = await client.post("/api/v1/asset-categories", json={"name": "Misc"}, headers={"Authorization": f"Bearer {token}"})
    cat_id = cat.json()["id"]
    asset_resp = await client.post("/api/v1/assets", json={"name": "Old Item", "category_id": cat_id}, headers={"Authorization": f"Bearer {token}"})
    asset_id = asset_resp.json()["id"]

    resp = await client.delete(f"/api/v1/assets/{asset_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204


# ── Asset Assign / Return ──

@pytest.mark.asyncio
async def test_assign_asset(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "assign_admin", "assign_admin@test.com", is_superuser=True)
    target = await create_user_direct(db_session, "assign_target", "assign_target@test.com")
    token = await login_user(client, "assign_admin")

    cat = await client.post("/api/v1/asset-categories", json={"name": "Keyboards"}, headers={"Authorization": f"Bearer {token}"})
    cat_id = cat.json()["id"]
    asset_resp = await client.post("/api/v1/assets", json={"name": "Mechanical KB", "category_id": cat_id}, headers={"Authorization": f"Bearer {token}"})
    asset_id = asset_resp.json()["id"]

    resp = await client.post(f"/api/v1/assets/{asset_id}/assign", json={"user_id": target.id}, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "in_use"
    assert data["current_user_id"] == target.id
    assert len(data["assignments"]) >= 1
    assert data["assignments"][0]["action"] == "assign"


@pytest.mark.asyncio
async def test_return_asset(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "return_admin", "return_admin@test.com", is_superuser=True)
    target = await create_user_direct(db_session, "return_target", "return_target@test.com")
    token = await login_user(client, "return_admin")

    cat = await client.post("/api/v1/asset-categories", json={"name": "Mice"}, headers={"Authorization": f"Bearer {token}"})
    cat_id = cat.json()["id"]
    asset_resp = await client.post("/api/v1/assets", json={"name": "MX Master", "category_id": cat_id}, headers={"Authorization": f"Bearer {token}"})
    asset_id = asset_resp.json()["id"]

    await client.post(f"/api/v1/assets/{asset_id}/assign", json={"user_id": target.id}, headers={"Authorization": f"Bearer {token}"})

    resp = await client.post(f"/api/v1/assets/{asset_id}/return", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "idle"
    assert data["current_user_id"] is None
    assert len(data["assignments"]) == 2
    # Latest record should be a return
    assert data["assignments"][-1]["action"] == "return"


# ── Permission checks ──

@pytest.mark.asyncio
async def test_non_admin_cannot_create_asset(client: AsyncClient, db_session: AsyncSession):
    await register_user(client, "normal_asset", "normal_asset@test.com")
    token = await login_user(client, "normal_asset")

    resp = await client.post("/api/v1/assets", json={"name": "Test", "category_id": 1}, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
