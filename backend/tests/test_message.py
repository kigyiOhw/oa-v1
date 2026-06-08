"""Tests for message (P2P messaging) API endpoints."""
import pytest
from httpx import AsyncClient


async def register_user(client: AsyncClient, username: str, email: str, full_name: str = "Test") -> None:
    resp = await client.post("/api/v1/auth/login", json={
        "username": username, "password": "password123",
    })
    if resp.status_code != 200:
        resp = await client.post("/api/v1/auth/register", json={
            "username": username, "email": email,
            "password": "password123", "full_name": full_name,
        })
        assert resp.status_code == 201


async def login(client: AsyncClient, username: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={
        "username": username, "password": "password123",
    })
    return resp.json()["access_token"]


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_send_and_receive_message(client: AsyncClient):
    """User A sends a message to User B, B sees it in inbox."""
    await register_user(client, "msg_sender", "sender@test.com")
    await register_user(client, "msg_recipient", "recipient@test.com")

    sender_token = await login(client, "msg_sender")
    recipient_token = await login(client, "msg_recipient")

    # Get recipient's user ID
    users_resp = await client.get("/api/v1/contacts", params={"search": "msg_recipient"}, headers=auth_header(sender_token))
    users = users_resp.json()["items"]
    assert len(users) > 0
    recipient_id = users[0]["id"]

    # Send message
    send_resp = await client.post("/api/v1/messages", json={
        "recipient_id": recipient_id,
        "subject": "Hello",
        "body": "Test message body",
    }, headers=auth_header(sender_token))
    assert send_resp.status_code == 201
    msg = send_resp.json()
    assert msg["subject"] == "Hello"
    assert msg["sender_id"] != msg["recipient_id"]

    # Recipient sees it in inbox
    inbox_resp = await client.get("/api/v1/messages/inbox", headers=auth_header(recipient_token))
    assert inbox_resp.status_code == 200
    inbox = inbox_resp.json()
    assert inbox["total"] >= 1


@pytest.mark.asyncio
async def test_mark_read(client: AsyncClient):
    """Recipient can mark a message as read."""
    await register_user(client, "read_sender", "reads@test.com")
    await register_user(client, "read_recip", "readr@test.com")

    sender_token = await login(client, "read_sender")
    recipient_token = await login(client, "read_recip")

    users_resp = await client.get("/api/v1/contacts", params={"search": "read_recip"}, headers=auth_header(sender_token))
    recipient_id = users_resp.json()["items"][0]["id"]

    # Send
    send_resp = await client.post("/api/v1/messages", json={
        "recipient_id": recipient_id,
        "subject": "Read Test",
        "body": "Body",
    }, headers=auth_header(sender_token))
    msg_id = send_resp.json()["id"]

    # Mark read
    read_resp = await client.post(f"/api/v1/messages/{msg_id}/read", headers=auth_header(recipient_token))
    assert read_resp.status_code == 200
    assert read_resp.json()["is_read"] is True
    assert read_resp.json()["read_at"] is not None


@pytest.mark.asyncio
async def test_cannot_send_to_self(client: AsyncClient):
    """Cannot send message to yourself."""
    await register_user(client, "self_msg", "self@test.com")
    token = await login(client, "self_msg")

    users_resp = await client.get("/api/v1/contacts", params={"search": "self_msg"}, headers=auth_header(token))
    my_id = users_resp.json()["items"][0]["id"]

    resp = await client.post("/api/v1/messages", json={
        "recipient_id": my_id,
        "subject": "Self",
        "body": "Should fail",
    }, headers=auth_header(token))
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_delete_message(client: AsyncClient):
    """User can soft-delete a message."""
    await register_user(client, "del_sender", "dels@test.com")
    await register_user(client, "del_recip", "delr@test.com")

    sender_token = await login(client, "del_sender")
    recipient_token = await login(client, "del_recip")

    users_resp = await client.get("/api/v1/contacts", params={"search": "del_recip"}, headers=auth_header(sender_token))
    recipient_id = users_resp.json()["items"][0]["id"]

    send_resp = await client.post("/api/v1/messages", json={
        "recipient_id": recipient_id,
        "subject": "Delete Test",
        "body": "Body",
    }, headers=auth_header(sender_token))
    msg_id = send_resp.json()["id"]

    # Recipient deletes
    del_resp = await client.delete(f"/api/v1/messages/{msg_id}", headers=auth_header(recipient_token))
    assert del_resp.status_code == 200

    # Sender still sees it (soft delete only affects deleting user)
    sender_inbox = await client.get("/api/v1/messages/sent", headers=auth_header(sender_token))
    assert sender_inbox.json()["total"] >= 1


@pytest.mark.asyncio
async def test_cannot_access_others_message(client: AsyncClient):
    """User C cannot read a message between A and B."""
    await register_user(client, "msg_a", "msga@test.com")
    await register_user(client, "msg_b", "msgb@test.com")
    await register_user(client, "msg_c", "msgc@test.com")

    token_a = await login(client, "msg_a")
    token_c = await login(client, "msg_c")

    users_resp = await client.get("/api/v1/contacts", params={"search": "msg_b"}, headers=auth_header(token_a))
    b_id = users_resp.json()["items"][0]["id"]

    send_resp = await client.post("/api/v1/messages", json={
        "recipient_id": b_id,
        "subject": "Private",
        "body": "Secret",
    }, headers=auth_header(token_a))
    msg_id = send_resp.json()["id"]

    # User C tries to read
    resp = await client.get(f"/api/v1/messages/{msg_id}", headers=auth_header(token_c))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_unread_count(client: AsyncClient):
    """Unread message count endpoint works."""
    await register_user(client, "count_user", "count@test.com")
    token = await login(client, "count_user")

    resp = await client.get("/api/v1/messages/unread-count", headers=auth_header(token))
    assert resp.status_code == 200
    assert resp.json()["count"] == 0
