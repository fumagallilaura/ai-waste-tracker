"""API tests for the auth flow (register, login, refresh rotation, logout)."""

from __future__ import annotations

from tests.conftest import register_user


class TestRegister:
    async def test_register_returns_tokens(self, client):
        response = await client.post(
            "/api/auth/register",
            json={"email": "new@b.com", "password": "secret123"},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["access_token"]
        assert body["refresh_token"]
        assert body["token_type"] == "bearer"

    async def test_register_duplicate_email_conflict(self, client):
        await register_user(client, "dup@b.com")
        response = await client.post(
            "/api/auth/register",
            json={"email": "dup@b.com", "password": "secret123"},
        )
        assert response.status_code == 409

    async def test_register_rejects_short_password(self, client):
        response = await client.post(
            "/api/auth/register",
            json={"email": "x@b.com", "password": "123"},
        )
        assert response.status_code == 422


class TestLogin:
    async def test_login_success(self, client):
        await register_user(client, "li@b.com", password="secret123")
        response = await client.post(
            "/api/auth/login",
            json={"email": "li@b.com", "password": "secret123"},
        )
        assert response.status_code == 200
        assert response.json()["access_token"]

    async def test_login_wrong_password(self, client):
        await register_user(client, "li2@b.com", password="secret123")
        response = await client.post(
            "/api/auth/login",
            json={"email": "li2@b.com", "password": "nope-nope"},
        )
        assert response.status_code == 401

    async def test_login_unknown_user(self, client):
        response = await client.post(
            "/api/auth/login",
            json={"email": "ghost@b.com", "password": "whatever1"},
        )
        assert response.status_code == 401


class TestMe:
    async def test_me_authenticated(self, client):
        auth = await register_user(client, "me@b.com")
        response = await client.get("/api/auth/me", headers=auth["headers"])
        assert response.status_code == 200
        body = response.json()
        assert body["email"] == "me@b.com"
        assert body["plan"] == "free"

    async def test_me_without_token(self, client):
        response = await client.get("/api/auth/me")
        assert response.status_code == 401

    async def test_me_with_invalid_token(self, client):
        response = await client.get(
            "/api/auth/me", headers={"Authorization": "Bearer garbage"}
        )
        assert response.status_code == 401


class TestRefreshRotation:
    async def test_refresh_returns_new_pair(self, client):
        auth = await register_user(client, "rot@b.com")
        old_refresh = auth["tokens"]["refresh_token"]

        response = await client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
        assert response.status_code == 200
        new_tokens = response.json()
        assert new_tokens["refresh_token"] != old_refresh

    async def test_old_refresh_token_revoked_after_rotation(self, client):
        auth = await register_user(client, "rot2@b.com")
        old_refresh = auth["tokens"]["refresh_token"]

        first = await client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
        assert first.status_code == 200

        replay = await client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
        assert replay.status_code == 401

    async def test_refresh_with_invalid_token(self, client):
        response = await client.post("/api/auth/refresh", json={"refresh_token": "garbage"})
        assert response.status_code == 401


class TestLogout:
    async def test_logout_revokes_refresh_token(self, client):
        auth = await register_user(client, "lo@b.com")
        refresh = auth["tokens"]["refresh_token"]

        response = await client.post("/api/auth/logout", json={"refresh_token": refresh})
        assert response.status_code == 204

        replay = await client.post("/api/auth/refresh", json={"refresh_token": refresh})
        assert replay.status_code == 401
