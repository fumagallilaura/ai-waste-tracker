from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import httpx
import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.rate_limit import LOGIN_RATE_LIMIT, limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import RefreshToken, User
from app.schemas import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter()


def _hash_token(token: str) -> str:
    """Hash a refresh token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def _issue_tokens(db: AsyncSession, user: User) -> TokenResponse:
    """Create access + refresh tokens and persist the refresh token."""
    access_token = create_access_token(user.id, user.email, user.plan)
    refresh_token, expires_at = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=_hash_token(refresh_token),
            expires_at=expires_at,
        )
    )
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


async def _claim_guest_productions(
    db: AsyncSession, user: User, request: Request, response
) -> None:
    """Associate the visitor's trial production(s) with the new account.

    The guest cookie (dz_guest) identifies productions created without login;
    after claiming, the cookie is removed so the quota restarts for the account.
    """
    from app.models import Production
    from app.routers.guest import GUEST_COOKIE

    guest_id = request.cookies.get(GUEST_COOKIE)
    if not guest_id:
        return
    guest_hash = hashlib.sha256(guest_id.encode()).hexdigest()
    result = await db.execute(
        select(Production).where(
            Production.guest_identifier_hash == guest_hash,
            Production.user_id.is_(None),
        )
    )
    claimed = result.scalars().all()
    for production in claimed:
        production.user_id = user.id
    if claimed:
        response.delete_cookie(GUEST_COOKIE)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(LOGIN_RATE_LIMIT)
async def register(
    request: Request,
    response: Response,
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new user account."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create user
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        plan="free",
    )
    db.add(user)
    await db.flush()

    tokens = _issue_tokens(db, user)
    await _claim_guest_productions(db, user, request, response)
    await db.commit()

    return tokens


@router.post("/login", response_model=TokenResponse)
@limiter.limit(LOGIN_RATE_LIMIT)
async def login(
    request: Request,
    response: Response,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate and return tokens."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    tokens = _issue_tokens(db, user)
    await _claim_guest_productions(db, user, request, response)
    await db.commit()

    return tokens


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Rotate refresh token and return new access + refresh tokens."""
    refresh_token = request.refresh_token

    try:
        payload = decode_token(refresh_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from None

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = uuid.UUID(payload["sub"])
    token_hash = _hash_token(refresh_token)

    # Find and validate refresh token
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
    )
    stored_token = result.scalar_one_or_none()

    if stored_token is None or stored_token.expires_at < datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Revoke old token (rotation)
    stored_token.revoked_at = datetime.now(UTC)

    # Get user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()

    # Create new tokens
    new_access_token = create_access_token(user.id, user.email, user.plan)
    new_refresh_token, expires_at = create_refresh_token(user.id)

    # Store new refresh token
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=_hash_token(new_refresh_token),
            expires_at=expires_at,
        )
    )
    await db.commit()

    return TokenResponse(access_token=new_access_token, refresh_token=new_refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Revoke a refresh token."""
    refresh_token = request.refresh_token
    try:
        payload = decode_token(refresh_token)
    except Exception:
        # Token is already invalid, just return 204
        return None

    user_id = uuid.UUID(payload["sub"])
    token_hash = _hash_token(refresh_token)

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.token_hash == token_hash,
        )
    )
    stored_token = result.scalar_one_or_none()

    if stored_token:
        stored_token.revoked_at = datetime.now(UTC)
        await db.commit()

    return None


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get current user profile."""
    return UserResponse(
        id=user.id,
        email=user.email,
        plan=user.plan,
        plan_expires_at=user.plan_expires_at,
        created_at=user.created_at,
    )


# ─── Google OAuth ───────────────────────────────────────────────

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def _oauth_state_token() -> str:
    """Short-lived signed state (CSRF protection) reusing the JWT keypair."""
    from pathlib import Path

    from app.core.security import settings as security_settings

    private_key = Path(security_settings.jwt_private_key_path).read_bytes()
    now = datetime.now(UTC)
    return pyjwt.encode(
        {
            "nonce": secrets.token_urlsafe(16),
            "iat": now,
            "exp": now + timedelta(minutes=10),
            "type": "oauth_state",
        },
        private_key,
        algorithm="RS256",
    )


def _validate_oauth_state(state: str) -> None:
    from app.core.security import decode_token

    try:
        payload = decode_token(state)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Estado inválido ou expirado. Tente entrar novamente.",
        ) from None
    if payload.get("type") != "oauth_state":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Estado inválido. Tente entrar novamente.",
        )


async def _google_exchange_code(code: str, settings) -> str:
    """Exchange the authorization code for a Google access token."""
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google recusou o login. Tente novamente.",
        )
    return response.json()["access_token"]


async def _google_userinfo(access_token: str) -> dict:
    """Fetch the verified Google profile (email, name)."""
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível ler seu perfil do Google.",
        )
    return response.json()


@router.get("/google/url")
async def google_authorization_url():
    """Return the Google consent URL the browser must be redirected to."""
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Login com Google ainda não configurado: preencha GOOGLE_CLIENT_ID e "
                "GOOGLE_CLIENT_SECRET no .env e rode docker compose up -d backend "
                "(veja o README)."
            ),
        )
    params = httpx.QueryParams(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": _oauth_state_token(),
            "prompt": "select_account",
        }
    )
    return {"authorization_url": f"{GOOGLE_AUTH_URL}?{params}"}


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str = "",
    state: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Google redirects here; upsert the user and hand tokens to the frontend."""
    settings = get_settings()
    if not code or not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Resposta inválida do Google."
        )
    _validate_oauth_state(state)

    access_token = await _google_exchange_code(code, settings)
    userinfo = await _google_userinfo(access_token)

    email = (userinfo.get("email") or "").strip().lower()
    if not email or not userinfo.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google não retornou um email verificado para esta conta.",
        )

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        # Contas Google não têm senha; recebe hash aleatório inutilizável.
        user = User(
            email=email,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            plan="free",
        )
        db.add(user)
        await db.flush()

    tokens = _issue_tokens(db, user)
    redirect_url = (
        f"{settings.frontend_url}/auth/callback"
        f"#access_token={tokens.access_token}&refresh_token={tokens.refresh_token}"
    )
    redirect_response = RedirectResponse(
        url=redirect_url, status_code=status.HTTP_303_SEE_OTHER
    )
    await _claim_guest_productions(db, user, request, redirect_response)
    await db.commit()
    return redirect_response
