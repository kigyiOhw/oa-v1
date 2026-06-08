"""Tests for expense request API."""
import pytest
from httpx import AsyncClient


async def register_and_login(client: AsyncClient, username: str, email: str) -> str:
    resp = await client.post("/api/v1/auth/register", json={
        "username": username, "email": email,
        "password": "password123", "full_name": "Test",
    })
    if resp.status_code != 201:
        pass
    resp = await client.post("/api/v1/auth/login", json={
        "username": username, "password": "password123",
    })
    return resp.json()["access_token"]


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_draft(client: AsyncClient):
    """User can create an expense draft."""
    token = await register_and_login(client, "exp_user", "exp@test.com")
    resp = await client.post("/api/v1/expenses", json={
        "expense_type": "travel",
        "amount": 150.00,
        "description": "Flight ticket",
    }, headers=auth_header(token))
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "draft"
    assert data["amount"] == 150.0


@pytest.mark.asyncio
async def test_list_my_expenses(client: AsyncClient):
    """User can list their own expenses."""
    token = await register_and_login(client, "exp_list", "el@test.com")
    resp = await client.get("/api/v1/expenses", headers=auth_header(token))
    assert resp.status_code == 200
    assert "items" in resp.json()


@pytest.mark.asyncio
async def test_delete_draft(client: AsyncClient):
    """User can delete their own draft."""
    token = await register_and_login(client, "exp_del", "ed@test.com")

    # Create draft
    create_resp = await client.post("/api/v1/expenses", json={
        "expense_type": "office",
        "amount": 50.00,
        "description": "Paper",
    }, headers=auth_header(token))
    expense_id = create_resp.json()["id"]

    # Delete draft
    del_resp = await client.delete(f"/api/v1/expenses/{expense_id}", headers=auth_header(token))
    assert del_resp.status_code == 200


@pytest.mark.asyncio
async def test_cannot_delete_others_expense(client: AsyncClient):
    """User cannot delete another user's expense."""
    token_a = await register_and_login(client, "exp_owner", "eo@test.com")
    token_b = await register_and_login(client, "exp_thief", "et@test.com")

    create_resp = await client.post("/api/v1/expenses", json={
        "expense_type": "other",
        "amount": 10.00,
        "description": "Mine",
    }, headers=auth_header(token_a))
    expense_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/expenses/{expense_id}", headers=auth_header(token_b))
    assert resp.status_code in (403, 404)


@pytest.mark.asyncio
async def test_amount_validation(client: AsyncClient):
    """Amount must be positive and within reasonable range."""
    token = await register_and_login(client, "exp_amt", "ea@test.com")

    # Negative amount
    resp = await client.post("/api/v1/expenses", json={
        "expense_type": "travel",
        "amount": -50,
        "description": "Negative",
    }, headers=auth_header(token))
    assert resp.status_code == 422

    # Amount exceeds upper limit (backlog #3)
    resp = await client.post("/api/v1/expenses", json={
        "expense_type": "travel",
        "amount": 2_000_000,
        "description": "Too much",
    }, headers=auth_header(token))
    assert resp.status_code == 422
