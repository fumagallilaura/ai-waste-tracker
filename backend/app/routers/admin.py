"""Endpoints administrativos: métricas técnicas e de negócio.

Protegidos por APP_ADMIN_TOKEN (header X-Admin-Token). Sem token configurado,
respondem 403 — nada é exposto publicamente.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.observability import metrics_snapshot
from app.db.session import get_db
from app.models import AnalyticsEvent, Production, ShoppingListItem, User, WasteRecord

router = APIRouter()


def require_admin(x_admin_token: str = Header(default="")) -> None:
    settings = get_settings()
    if not settings.admin_token or x_admin_token != settings.admin_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito: configure APP_ADMIN_TOKEN e envie X-Admin-Token.",
        )


@router.get("/metrics")
async def get_metrics(_: None = Depends(require_admin)):
    """Métricas técnicas da API (requisições, status, latências)."""
    return metrics_snapshot()


@router.get("/metrics/business")
async def get_business_metrics(
    _: None = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Funil de produto e uso agregado — base para análise e monetização futura."""
    now = datetime.now(UTC)
    thirty_days_ago = now - timedelta(days=30)

    users_total = (
        await db.execute(select(func.count(User.id)))
    ).scalar_one()
    users_last_30d = (
        await db.execute(
            select(func.count(User.id)).where(User.created_at >= thirty_days_ago)
        )
    ).scalar_one()

    productions_total = (
        await db.execute(select(func.count(Production.id)))
    ).scalar_one()
    productions_finalized = (
        await db.execute(
            select(func.count(Production.id)).where(Production.status == "finalizado")
        )
    ).scalar_one()
    productions_last_30d = (
        await db.execute(
            select(func.count(Production.id)).where(Production.data >= thirty_days_ago)
        )
    ).scalar_one()

    guest_trials = (
        await db.execute(
            select(func.count(func.distinct(Production.guest_identifier_hash)))
        )
    ).scalar_one()

    waste_total = (
        await db.execute(select(func.sum(WasteRecord.custo_desperdicio)))
    ).scalar_one() or 0

    compras_total = (
        await db.execute(select(func.sum(ShoppingListItem.preco_estimado)))
    ).scalar_one() or 0

    # funil: eventos de produto registrados (últimos 30 dias e total)
    funnel: dict[str, dict] = {}
    rows = await db.execute(
        select(
            AnalyticsEvent.name,
            func.count(AnalyticsEvent.id),
            func.sum(
                case((AnalyticsEvent.created_at >= thirty_days_ago, 1), else_=0)
            ),
        ).group_by(AnalyticsEvent.name)
    )
    for name, total, last30 in rows.all():
        funnel[name] = {"total": total, "last_30d": int(last30 or 0)}

    conversion_rate = (
        round(100 * funnel["trial_converted"]["total"] / funnel["guest_trial_created"]["total"], 1)
        if funnel.get("guest_trial_created", {}).get("total")
        and funnel.get("trial_converted", {}).get("total") is not None
        else None
    )

    return {
        "users": {"total": users_total, "novos_30d": users_last_30d},
        "productions": {
            "total": productions_total,
            "finalizadas": productions_finalized,
            "ultimos_30d": productions_last_30d,
        },
        "guest": {"trials_distintos": guest_trials, "conversao_pct": conversion_rate},
        "dinheiro": {
            "compras_estimadas_total": round(float(compras_total), 2),
            "desperdicio_registrado_total": round(float(waste_total), 2),
        },
        "funil": funnel,
    }
