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


class TestGoogleOAuth:
    async def test_url_not_configured_returns_503(self, client):
        response = await client.get("/api/auth/google/url")
        assert response.status_code == 503

    async def test_url_returns_consent_url(self, client, monkeypatch):
        from app.config import get_settings

        monkeypatch.setattr(get_settings(), "google_client_id", "test-client-id")
        monkeypatch.setattr(get_settings(), "google_client_secret", "test-secret")
        response = await client.get("/api/auth/google/url")
        assert response.status_code == 200
        url = response.json()["authorization_url"]
        assert "accounts.google.com" in url
        assert "test-client-id" in url
        assert "state=" in url

    async def test_callback_rejects_invalid_state(self, client):
        response = await client.get(
            "/api/auth/google/callback",
            params={"code": "abc", "state": "forged"},
            follow_redirects=False,
        )
        assert response.status_code == 400

    async def test_callback_creates_user_and_redirects(self, client, monkeypatch):
        import app.routers.auth as auth_router
        from app.config import get_settings

        monkeypatch.setattr(get_settings(), "frontend_url", "http://localhost:3000")

        async def fake_exchange(code, settings):
            return "google-access-token"

        async def fake_userinfo(token):
            return {
                "email": "google.user@gmail.com",
                "email_verified": True,
                "name": "Google User",
            }

        monkeypatch.setattr(auth_router, "_google_exchange_code", fake_exchange)
        monkeypatch.setattr(auth_router, "_google_userinfo", fake_userinfo)

        state = auth_router._oauth_state_token()

        response = await client.get(
            "/api/auth/google/callback",
            params={"code": "real-code", "state": state},
            follow_redirects=False,
        )
        assert response.status_code == 303
        location = response.headers["location"]
        assert location.startswith("http://localhost:3000/auth/callback#")
        fragment = location.split("#")[1]
        params = dict(p.split("=", 1) for p in fragment.split("&"))
        assert params["access_token"]
        assert params["refresh_token"]

        me = await client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {params['access_token']}"}
        )
        assert me.status_code == 200
        assert me.json()["email"] == "google.user@gmail.com"

    async def test_callback_reuses_existing_email(self, client, monkeypatch, session_factory):
        from sqlalchemy import select

        import app.routers.auth as auth_router
        from app.models import User

        await register_user(client, "existing@gmail.com")

        async def fake_exchange(code, settings):
            return "google-access-token"

        async def fake_userinfo(token):
            return {"email": "existing@gmail.com", "email_verified": True}

        monkeypatch.setattr(auth_router, "_google_exchange_code", fake_exchange)
        monkeypatch.setattr(auth_router, "_google_userinfo", fake_userinfo)

        state = auth_router._oauth_state_token()

        response = await client.get(
            "/api/auth/google/callback",
            params={"code": "code", "state": state},
            follow_redirects=False,
        )
        assert response.status_code == 303

        async with session_factory() as session:
            result = await session.execute(
                select(User).where(User.email == "existing@gmail.com")
            )
            assert len(result.scalars().all()) == 1

    async def test_callback_requires_verified_email(self, client, monkeypatch):
        import app.routers.auth as auth_router

        async def fake_exchange(code, settings):
            return "google-access-token"

        async def fake_userinfo(token):
            return {"email": "unverified@gmail.com", "email_verified": False}

        monkeypatch.setattr(auth_router, "_google_exchange_code", fake_exchange)
        monkeypatch.setattr(auth_router, "_google_userinfo", fake_userinfo)

        state = auth_router._oauth_state_token()

        response = await client.get(
            "/api/auth/google/callback",
            params={"code": "code", "state": state},
            follow_redirects=False,
        )
        assert response.status_code == 400
