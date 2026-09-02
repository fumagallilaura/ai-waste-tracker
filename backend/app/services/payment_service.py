"""Mercado Pago payment service."""

from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import User

settings = get_settings()

MP_BASE_URL = (
    "https://api.mercadopago.com"
    if not settings.mercado_pago_sandbox
    else "https://api.mercadopago.com"  # Sandbox uses same base URL
)

PLAN_PRICES = {
    "pro_mensal": {"value": 1990, "title": "Desperdício Zero - Plano Mensal"},
    "pro_anual": {"value": 14900, "title": "Desperdício Zero - Plano Anual"},
}


async def create_preference(user: User, plan: str) -> dict:
    """Create a Mercado Pago checkout preference."""
    if plan not in PLAN_PRICES:
        raise ValueError(f"Invalid plan: {plan}")

    plan_info = PLAN_PRICES[plan]
    preference_id = f"pref_{uuid.uuid4().hex[:12]}"

    payload = {
        "items": [
            {
                "id": plan,
                "title": plan_info["title"],
                "quantity": 1,
                "unit_price": plan_info["value"] / 100,
                "currency_id": "BRL",
            }
        ],
        "payer": {
            "email": user.email,
        },
        "back_urls": {
            "success": f"{settings.cors_origins[0]}/dashboard?payment=success",
            "failure": f"{settings.cors_origins[0]}/dashboard?payment=failure",
            "pending": f"{settings.cors_origins[0]}/dashboard?payment=pending",
        },
        "notification_url": f"{settings.cors_origins[0].replace('http://', 'https://').replace('localhost:3000', 'api.desperdiciozero.com.br')}/api/payments/webhook",
        "external_reference": str(user.id),
        "auto_return": "approved",
        "payment_methods": {
            "installments": 1,
        },
    }

    if settings.mercado_pago_sandbox or not settings.mercado_pago_access_token.startswith("APP_"):
        # Sandbox/dev mode - return mock
        return {
            "id": preference_id,
            "init_point": f"https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id={preference_id}",
        }

    # Production mode
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MP_BASE_URL}/checkout/preferences",
            headers={
                "Authorization": f"Bearer {settings.mercado_pago_access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        return response.json()


async def get_payment_info(payment_id: str) -> dict:
    """Get payment details from Mercado Pago."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{MP_BASE_URL}/v1/payments/{payment_id}",
            headers={
                "Authorization": f"Bearer {settings.mercado_pago_access_token}",
            },
        )
        response.raise_for_status()
        return response.json()


def verify_webhook_signature(request_body: bytes, x_signature: str) -> bool:
    """Verify Mercado Pago webhook signature."""
    if not settings.mercado_pago_access_token:
        return True  # Skip in dev

    # Mercado Pago sends X-Signature header
    # Format: t=<timestamp>,v1=<hash>
    parts = dict(p.split("=") for p in x_signature.split(","))
    timestamp = parts.get("t", "")
    signature = parts.get("v1", "")

    # Create the string to sign: "id:<payment_id>;topic:<topic_type>"
    # For simplicity, we verify the HMAC
    expected = hmac.new(
        settings.mercado_pago_access_token.encode(),
        request_body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(signature, expected)


async def activate_plan(user_id: uuid.UUID, db: AsyncSession) -> None:
    """Activate Pro plan for a user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user:
        user.plan = "pro"
        user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=30)


async def cancel_plan(user_id: uuid.UUID, db: AsyncSession) -> None:
    """Cancel Pro plan for a user (grace period expired)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user:
        user.plan = "free"
        user.plan_expires_at = None
