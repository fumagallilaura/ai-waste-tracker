"""Unit tests for security primitives (passwords + JWT)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core import security
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_rsa_key_pair,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        hashed = hash_password("secret123")
        assert hashed != "secret123"
        assert hashed.startswith("$argon2")

    def test_verify_correct_password(self):
        hashed = hash_password("secret123")
        assert verify_password("secret123", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("secret123")
        assert verify_password("wrong-pass", hashed) is False

    def test_same_password_different_hash(self):
        assert hash_password("secret123") != hash_password("secret123")


class TestRSAKeyPair:
    def test_generate_returns_pem_strings(self):
        private_pem, public_pem = generate_rsa_key_pair()
        assert "BEGIN PRIVATE KEY" in private_pem
        assert "BEGIN PUBLIC KEY" in public_pem

    def test_keys_usable_by_jwt(self):
        private_pem, public_pem = generate_rsa_key_pair()
        token = jwt.encode({"sub": "x"}, private_pem, algorithm="RS256")
        assert jwt.decode(token, public_pem, algorithms=["RS256"])["sub"] == "x"


class TestTokens:
    def test_access_token_roundtrip(self, jwt_keys):
        user_id = uuid.uuid4()
        token = create_access_token(user_id, "a@b.com", "pro")
        payload = decode_token(token)
        assert payload["sub"] == str(user_id)
        assert payload["email"] == "a@b.com"
        assert payload["plan"] == "pro"
        assert payload["type"] == "access"

    def test_refresh_token_roundtrip(self, jwt_keys):
        user_id = uuid.uuid4()
        token, expires_at = create_refresh_token(user_id)
        payload = decode_token(token)
        assert payload["sub"] == str(user_id)
        assert payload["type"] == "refresh"
        assert "jti" in payload
        assert expires_at > datetime.now(UTC)

    def test_tampered_token_rejected(self, jwt_keys):
        token = create_access_token(uuid.uuid4(), "a@b.com", "free")
        with pytest.raises(jwt.InvalidTokenError):
            decode_token(token + "x")

    def test_expired_token_rejected(self, jwt_keys, monkeypatch):
        monkeypatch.setattr(security.settings, "jwt_access_token_expire_minutes", -5)
        token = create_access_token(uuid.uuid4(), "a@b.com", "free")
        with pytest.raises(jwt.ExpiredSignatureError):
            decode_token(token)

    def test_other_key_pair_rejected(self, jwt_keys):
        token = create_access_token(uuid.uuid4(), "a@b.com", "free")
        other_private, other_public = generate_rsa_key_pair()
        forged = jwt.encode({"sub": "hack"}, other_private, algorithm="RS256")
        # Decoding with the attacker's own public key "works", but the app's
        # public key must reject the forged token.
        with pytest.raises(jwt.InvalidTokenError):
            decode_token(forged)
        assert decode_token(token) is not None


class TestTokenExpiry:
    def test_refresh_expiry_matches_settings(self, jwt_keys, monkeypatch):
        monkeypatch.setattr(security.settings, "jwt_refresh_token_expire_days", 2)
        _, expires_at = create_refresh_token(uuid.uuid4())
        delta = expires_at - datetime.now(UTC)
        assert timedelta(days=1, hours=23) < delta <= timedelta(days=2)
