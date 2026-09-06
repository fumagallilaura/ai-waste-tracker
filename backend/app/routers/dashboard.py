from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import Client, Production, ShoppingListItem, User, WasteRecord
from app.schemas import DashboardHistoryItem, DashboardMetrics

router = APIRouter()


def _period_start(periodo: str) -> date:
    today = date.today()
    if periodo == "ultimos_30_dias":
        return today - timedelta(days=30)
    return today.replace(day=1)


@router.get("/metrics", response_model=DashboardMetrics)
async def get_dashboard_metrics(
    periodo: str = Query(default="mes_atual"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Real cost metrics: requisition value vs. discarded value."""
    start_date = _period_start(periodo)

    result = await db.execute(
        select(Production.id).where(
            Production.user_id == user.id,
            Production.data >= start_date,
            Production.status == "finalizado",
        )
    )
    production_ids = [row[0] for row in result.all()]

    total_compras = 0.0
    if production_ids:
        result = await db.execute(
            select(func.sum(ShoppingListItem.preco_estimado)).where(
                ShoppingListItem.production_id.in_(production_ids)
            )
        )
        total_compras = float(result.scalar_one() or 0)

        result = await db.execute(
            select(func.sum(WasteRecord.custo_desperdicio)).where(
                WasteRecord.production_id.in_(production_ids)
            )
        )
        desperdicio_total = float(result.scalar_one() or 0)
    else:
        desperdicio_total = 0.0

    num_productions = len(production_ids)
    taxa = (desperdicio_total / total_compras * 100) if total_compras > 0 else 0.0

    return DashboardMetrics(
        total_compras=round(total_compras, 2),
        desperdicio_total=round(desperdicio_total, 2),
        taxa_desperdicio=round(taxa, 1),
        eventos_realizados=num_productions,
        desperdicio_medio_por_evento=(
            round(desperdicio_total / num_productions, 2) if num_productions > 0 else 0
        ),
        periodo=periodo,
    )


@router.get("/history", response_model=list[DashboardHistoryItem])
async def get_dashboard_history(
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get production history for the dashboard."""
    result = await db.execute(
        select(Production, Client.nome)
        .outerjoin(Client, Production.client_id == Client.id)
        .where(Production.user_id == user.id)
        .order_by(Production.data.desc())
        .limit(limit)
    )
    rows = result.all()

    items = []
    for production, client_nome in rows:
        result = await db.execute(
            select(func.sum(ShoppingListItem.preco_estimado)).where(
                ShoppingListItem.production_id == production.id
            )
        )
        custo_compras = float(result.scalar_one() or 0)

        result = await db.execute(
            select(func.sum(WasteRecord.custo_desperdicio)).where(
                WasteRecord.production_id == production.id
            )
        )
        custo_desperdicio = float(result.scalar_one() or 0)

        # % consumido sobre o que foi registrado no balanço (produzido ou consumido)
        result = await db.execute(
            select(
                func.sum(WasteRecord.quantidade_consumida),
                func.sum(WasteRecord.quantidade_descartada),
                func.sum(WasteRecord.quantidade_devolvida),
            ).where(WasteRecord.production_id == production.id)
        )
        consumido, descartado, devolvido = result.one()
        consumido = float(consumido or 0)
        descartado = float(descartado or 0)
        devolvido = float(devolvido or 0)
        registrado = consumido + descartado + devolvido
        consumo_pct = (consumido / registrado * 100) if registrado > 0 else 0.0

        items.append(
            DashboardHistoryItem(
                id=production.id,
                nome=production.nome,
                tipo=production.tipo,
                data=production.data.date(),
                status=production.status,
                cliente=client_nome,
                custo_compras=round(custo_compras, 2),
                custo_desperdicio=round(custo_desperdicio, 2),
                consumo_total=round(consumo_pct, 1),
            )
        )

    return items
