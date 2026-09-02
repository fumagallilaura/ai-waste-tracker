from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import Production, User, WasteRecord
from app.schemas import DashboardHistoryItem, DashboardMetrics

router = APIRouter()


@router.get("/metrics", response_model=DashboardMetrics)
async def get_dashboard_metrics(
    periodo: str = Query(default="mes_atual"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get dashboard metrics for the current user."""
    # Determine date range
    today = date.today()
    if periodo == "mes_atual":
        start_date = today.replace(day=1)
    elif periodo == "ultimos_30_dias":
        start_date = today - timedelta(days=30)
    else:
        start_date = today.replace(day=1)

    # Get productions in range
    result = await db.execute(
        select(Production).where(
            Production.user_id == user.id,
            Production.data >= start_date,
            Production.status == "finalizado",
        )
    )
    productions = result.scalars().all()

    # Get waste records for those productions
    production_ids = [p.id for p in productions]
    if production_ids:
        result = await db.execute(
            select(
                func.sum(WasteRecord.custo_desperdicio),
                func.count(WasteRecord.id),
            ).where(WasteRecord.production_id.in_(production_ids))
        )
        row = result.one()
        desperdicio_total = float(row[0] or 0)
    else:
        desperdicio_total = 0

    # Estimated savings placeholder: real formula needs purchase costs (D006).
    # Until purchases are registered, economia is reported as 0.
    economia_total: float = 0

    num_productions = len(productions)

    return DashboardMetrics(
        economia_total=round(economia_total, 2),
        desperdicio_total=round(desperdicio_total, 2),
        eventos_realizados=num_productions,
        desperdicio_medio_por_evento=(
            round(desperdicio_total / num_productions, 2) if num_productions > 0 else 0
        ),
        economia_medio_por_evento=(
            round(economia_total / num_productions, 2) if num_productions > 0 else 0
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
        select(Production)
        .where(Production.user_id == user.id)
        .order_by(Production.data.desc())
        .limit(limit)
    )
    productions = result.scalars().all()

    items = []
    for p in productions:
        # Get waste for this production
        waste_result = await db.execute(
            select(func.sum(WasteRecord.custo_desperdicio)).where(
                WasteRecord.production_id == p.id
            )
        )
        custo_desperdicio = float(waste_result.scalar_one() or 0)

        # Simplified: custo_compras = desperdicio / 0.113 (inverse of average waste)
        custo_compras = custo_desperdicio / 0.113 if custo_desperdicio > 0 else 0
        economia = max(0, custo_compras * 0.113 - custo_desperdicio)

        items.append(
            DashboardHistoryItem(
                id=p.id,
                nome=p.nome,
                tipo=p.tipo,
                data=p.data.date(),
                status=p.status,
                custo_compras=round(custo_compras, 2),
                custo_desperdicio=round(custo_desperdicio, 2),
                economia=round(economia, 2),
            )
        )

    return items
