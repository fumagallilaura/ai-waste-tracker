"""Shared test fixtures.

Backend tests run against an in-memory SQLite database (aiosqlite) so no
PostgreSQL instance is needed. Models use portable SQLAlchemy types (Uuid,
DateTime(timezone=True)) which work on both SQLite and PostgreSQL.
"""

from __future__ import annotations

import os

os.environ.setdefault("APP_DEBUG", "false")
os.environ["APP_RATE_LIMIT_LOGIN_PER_MINUTE"] = "100000"

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.security import generate_rsa_key_pair  # noqa: E402
from app.core.security import settings as security_settings
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


@pytest.fixture(scope="session")
def jwt_keys(tmp_path_factory) -> None:
    """Generate RSA keys for JWT once per test session."""
    private_pem, public_pem = generate_rsa_key_pair()
    priv = tmp_path_factory.mktemp("keys") / "private_key.pem"
    pub = tmp_path_factory.mktemp("keys") / "public_key.pem"
    priv.write_text(private_pem)
    pub.write_text(public_pem)
    security_settings.jwt_private_key_path = str(priv)
    security_settings.jwt_public_key_path = str(pub)


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(db_engine):
    return async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session(session_factory) -> AsyncSession:
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_engine, session_factory, jwt_keys) -> AsyncClient:

    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def register_user(client: AsyncClient, email: str, password: str = "secret123") -> dict:
    """Register a user and return {tokens, headers}."""
    response = await client.post(
        "/api/auth/register",
        json={"email": email, "password": password},
    )
    assert response.status_code == 201, response.text
    tokens = response.json()
    return {
        "tokens": tokens,
        "headers": {"Authorization": f"Bearer {tokens['access_token']}"},
    }
