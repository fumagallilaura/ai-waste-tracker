"""Registro de eventos de produto (funil/uso). Fire-and-forget na mesma sessão."""

from __future__ import annotations

import contextlib
import json
import uuid
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.units import UNIT_CONVERSIONS
from app.models import AnalyticsEvent

# nomes canônicos para evitar string espalhada
SIGNUP_EMAIL = "signup_email"
SIGNUP_GOOGLE = "signup_google"
GUEST_TRIAL_CREATED = "guest_trial_created"
TRIAL_CONVERTED = "trial_converted"
PRODUCTION_CREATED = "production_created"
WASTE_REGISTERED = "waste_registered"


def balance_percentages(records) -> tuple[float, float]:
    """Calcula percentuais por item, sem misturar unidades incompatíveis."""
    grouped: dict[tuple[str, str], list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])
    for record in records:
        produced = float(record.quantidade_produzida)
        if produced <= 0:
            continue
        conversion = UNIT_CONVERSIONS[record.unidade]
        key = (record.item.strip().lower(), str(conversion["base"]))
        factor = float(conversion["factor"])
        grouped[key][0] += produced * factor
        grouped[key][1] += float(record.quantidade_consumida) * factor
        grouped[key][2] += float(record.quantidade_descartada) * factor

    if not grouped:
        return 0.0, 0.0
    consumo = sum(values[1] / values[0] for values in grouped.values())
    descarte = sum(values[2] / values[0] for values in grouped.values())
    count = len(grouped)
    return round(100 * consumo / count, 1), round(100 * descarte / count, 1)


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
