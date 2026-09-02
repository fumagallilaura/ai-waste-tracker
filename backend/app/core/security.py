from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()

# Password hashing
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using argon2id."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its argon2 hash."""
    return pwd_context.verify(plain_password, hashed_password)


def _load_private_key() -> bytes:
    """Load JWT RSA private key from file or SSM."""
    path = Path(settings.jwt_private_key_path)
    if path.exists():
        return path.read_bytes()
    # In production, load from SSM Parameter Store
    import boto3
    ssm = boto3.client("ssm")
    response = ssm.get_parameter(
        Name=f"/{settings.app_name.lower().replace(' ', '-')}/jwt/private_key",
        WithDecryption=True,
    )
    return response["Parameter"]["Value"].encode()


def _load_public_key() -> bytes:
    """Load JWT RSA public key from file or SSM."""
    path = Path(settings.jwt_public_key_path)
    if path.exists():
        return path.read_bytes()
    # In production, load from SSM Parameter Store
    import boto3
    ssm = boto3.client("ssm")
    response = ssm.get_parameter(
        Name=f"/{settings.app_name.lower().replace(' ', '-')}/jwt/public_key",
        WithDecryption=True,
    )
    return response["Parameter"]["Value"].encode()


def create_access_token(
    user_id: uuid.UUID,
    email: str,
    plan: str,
) -> str:
    """Create a JWT access token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "plan": plan,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_access_token_expire_minutes),
        "type": "access",
    }
    private_key = _load_private_key()
    return jwt.encode(payload, private_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: uuid.UUID) -> tuple[str, datetime]:
    """Create a JWT refresh token and return (token, expires_at)."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.jwt_refresh_token_expire_days)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": expires_at,
        "type": "refresh",
        "jti": str(uuid.uuid4()),  # Unique ID for rotation
    }
    private_key = _load_private_key()
    token = jwt.encode(payload, private_key, algorithm=settings.jwt_algorithm)
    return token, expires_at


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    public_key = _load_public_key()
    return jwt.decode(token, public_key, algorithms=[settings.jwt_algorithm])


def generate_rsa_key_pair() -> tuple[str, str]:
    """Generate an RSA key pair for development."""
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    return private_pem.decode(), public_pem.decode()
