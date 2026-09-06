"""Registro de eventos de produto (funil/uso). Fire-and-forget na mesma sessão."""

from __future__ import annotations

import contextlib
import json
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AnalyticsEvent

# nomes canônicos para evitar string espalhada
SIGNUP_EMAIL = "signup_email"
SIGNUP_GOOGLE = "signup_google"
GUEST_TRIAL_CREATED = "guest_trial_created"
TRIAL_CONVERTED = "trial_converted"
PRODUCTION_CREATED = "production_created"
WASTE_REGISTERED = "waste_registered"


async def track(
    db: AsyncSession,
    name: str,
    user_id: uuid.UUID | None = None,
    **meta,
) -> None:
    """Insere um evento de produto. Falha de tracking nunca derruba a request."""
    with contextlib.suppress(Exception):  # observabilidade não pode quebrar fluxo
        db.add(
            AnalyticsEvent(
                name=name,
                user_id=user_id,
                metadata_json=json.dumps(meta, default=str)[:1000],
            )
        )
