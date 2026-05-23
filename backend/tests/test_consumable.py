import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

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


# ── Consumable CRUD ──

@pytest.mark.asyncio
async def test_create_consumable(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "cons_admin", "cons_admin@test.com", is_superuser=True)
    token = await login_user(client, "cons_admin")

    resp = await client.post(
        "/api/v1/consumables",
        json={"name": "A4 Paper", "unit": "box", "current_stock": 100, "safety_stock": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "A4 Paper"
    assert data["unit"] == "box"
    assert data["current_stock"] == 100
    assert data["safety_stock"] == 10


@pytest.mark.asyncio
async def test_list_consumables(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "cons_admin2", "cons_admin2@test.com", is_superuser=True)
    token = await login_user(client, "cons_admin2")

    await client.post("/api/v1/consumables", json={"name": "Toner", "unit": "pc", "current_stock": 50, "safety_stock": 5}, headers={"Authorization": f"Bearer {token}"})
    await client.post("/api/v1/consumables", json={"name": "Staples", "unit": "box", "current_stock": 200, "safety_stock": 20}, headers={"Authorization": f"Bearer {token}"})

    resp = await client.get("/api/v1/consumables", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2
    assert len(data["items"]) >= 2


@pytest.mark.asyncio
async def test_list_consumables_search(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "cons_admin3", "cons_admin3@test.com", is_superuser=True)
    token = await login_user(client, "cons_admin3")

    await client.post("/api/v1/consumables", json={"name": "Pen", "unit": "pc", "current_stock": 500, "safety_stock": 50}, headers={"Authorization": f"Bearer {token}"})
    await client.post("/api/v1/consumables", json={"name": "Notebook", "unit": "pc", "current_stock": 100, "safety_stock": 20}, headers={"Authorization": f"Bearer {token}"})

    resp = await client.get("/api/v1/consumables?search=Pen", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Pen"


@pytest.mark.asyncio
async def test_get_consumable_detail(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "cons_admin4", "cons_admin4@test.com", is_superuser=True)
    token = await login_user(client, "cons_admin4")

    create_resp = await client.post("/api/v1/consumables", json={"name": "Ink Cartridge", "unit": "pc", "current_stock": 30, "safety_stock": 5, "description": "HP 56A"}, headers={"Authorization": f"Bearer {token}"})
    item_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/consumables/{item_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Ink Cartridge"
    assert data["description"] == "HP 56A"
    assert "records" in data


@pytest.mark.asyncio
async def test_update_consumable(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "cons_admin5", "cons_admin5@test.com", is_superuser=True)
    token = await login_user(client, "cons_admin5")

    create_resp = await client.post("/api/v1/consumables", json={"name": "Envelope", "unit": "pc", "current_stock": 1000, "safety_stock": 100}, headers={"Authorization": f"Bearer {token}"})
    item_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/consumables/{item_id}",
        json={"name": "Large Envelope", "safety_stock": 200, "description": "A4 size"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Large Envelope"
    assert data["safety_stock"] == 200
    assert data["description"] == "A4 size"


# ── Stock In / Out ──

@pytest.mark.asyncio
async def test_stock_in(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "stock_admin1", "stock_admin1@test.com", is_superuser=True)
    token = await login_user(client, "stock_admin1")

    create_resp = await client.post("/api/v1/consumables", json={"name": "Glue Stick", "unit": "pc", "current_stock": 10, "safety_stock": 5}, headers={"Authorization": f"Bearer {token}"})
    item_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/consumables/{item_id}/stock-in",
        json={"quantity": 20, "notes": "Monthly purchase"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_stock"] == 30
    assert len(data["records"]) >= 1
    record = data["records"][-1]
    assert record["type"] == "in"
    assert record["quantity"] == 20
    assert record["notes"] == "Monthly purchase"


@pytest.mark.asyncio
async def test_stock_out(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "stock_admin2", "stock_admin2@test.com", is_superuser=True)
    token = await login_user(client, "stock_admin2")

    create_resp = await client.post("/api/v1/consumables", json={"name": "Tape", "unit": "roll", "current_stock": 50, "safety_stock": 5}, headers={"Authorization": f"Bearer {token}"})
    item_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/consumables/{item_id}/stock-out",
        json={"quantity": 3, "notes": "Office supply"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_stock"] == 47
    assert len(data["records"]) >= 1
    record = data["records"][-1]
    assert record["type"] == "out"
    assert record["quantity"] == 3


@pytest.mark.asyncio
async def test_stock_out_insufficient(client: AsyncClient, db_session: AsyncSession):
    admin = await create_user_direct(db_session, "stock_admin3", "stock_admin3@test.com", is_superuser=True)
    token = await login_user(client, "stock_admin3")

    create_resp = await client.post("/api/v1/consumables", json={"name": "Sticky Notes", "unit": "pad", "current_stock": 2, "safety_stock": 1}, headers={"Authorization": f"Bearer {token}"})
    item_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/consumables/{item_id}/stock-out",
        json={"quantity": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "insufficient" in resp.json()["detail"].lower()


# ── Delete validations ──

@pytest.mark.asyncio
async def test_delete_consumable_with_stock(client: AsyncClient, db_session: AsyncSession):
    """Cannot delete a consumable that still has stock."""
    admin = await create_user_direct(db_session, "del_admin1", "del_admin1@test.com", is_superuser=True)
    token = await login_user(client, "del_admin1")

    create_resp = await client.post("/api/v1/consumables", json={"name": "Printer Paper", "unit": "ream", "current_stock": 50, "safety_stock": 10}, headers={"Authorization": f"Bearer {token}"})
    item_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/consumables/{item_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 400
    assert "stock" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_delete_consumable_zero_stock(client: AsyncClient, db_session: AsyncSession):
    """Can delete a consumable with zero stock after stocking out completely."""
    admin = await create_user_direct(db_session, "del_admin2", "del_admin2@test.com", is_superuser=True)
    token = await login_user(client, "del_admin2")

    create_resp = await client.post("/api/v1/consumables", json={"name": "Old Item", "unit": "pc", "current_stock": 0, "safety_stock": 0}, headers={"Authorization": f"Bearer {token}"})
    item_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/consumables/{item_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204


# ── Permission checks ──

@pytest.mark.asyncio
async def test_non_admin_cannot_create_consumable(client: AsyncClient, db_session: AsyncSession):
    await register_user(client, "normal_cons", "normal_cons@test.com")
    token = await login_user(client, "normal_cons")

    resp = await client.post("/api/v1/consumables", json={"name": "Test", "unit": "pc"}, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
