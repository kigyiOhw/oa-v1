from datetime import timedelta

from app.utils.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)


def test_password_hash_roundtrip():
    plain = "secret123"
    hashed = get_password_hash(plain)
    assert verify_password(plain, hashed) is True
    assert verify_password("wrong", hashed) is False


def test_access_token_create_and_decode():
    token = create_access_token({"sub": "1"})
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "1"
    assert payload["type"] == "access"


def test_refresh_token_create_and_decode():
    token = create_refresh_token({"sub": "1"})
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "1"
    assert payload["type"] == "refresh"


def test_decode_invalid_token():
    assert decode_token("invalid.token.here") is None
