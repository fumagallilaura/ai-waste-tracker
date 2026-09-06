from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.units import to_base_unit
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import IngredientStock, Production, User, WasteRecord
from app.schemas import WasteRecordCreate, WasteRecordResponse, WasteRecordUpdate
from app.services import analytics

router = APIRouter()


async def _load_production(
    db: AsyncSession, production_id: uuid.UUID, user: User
) -> Production:
    result = await db.execute(
        select(Production).where(
            Production.id == production_id, Production.user_id == user.id
        )
    )
    production = result.scalar_one_or_none()
    if production is None:
        raise HTTPException(status_code=404, detail="Production not found")
    return production


async def _credit_returned_to_stock(
    db: AsyncSession, user_id: uuid.UUID, record: WasteRecord
) -> None:
    """Devolvido (não exposto) volta para o estoque."""
    if record.quantidade_devolvida <= 0:
        return
    qtd, base_unit = to_base_unit(record.quantidade_devolvida, record.unidade)
    result = await db.execute(
        select(IngredientStock).where(
            IngredientStock.user_id == user_id,
            func.lower(IngredientStock.ingrediente) == record.item.strip().lower(),
        )
    )
    stock_item = result.scalar_one_or_none()
    if stock_item is None:
        stock_item = IngredientStock(
            user_id=user_id,
            ingrediente=record.item.strip(),
            unidade_base=base_unit,
            quantidade=qtd,
        )
        db.add(stock_item)
    elif stock_item.unidade_base == base_unit:
        stock_item.quantidade = float(stock_item.quantidade) + qtd


def _finalize(production: Production, db: AsyncSession) -> None:
    """Primeiro balanço registrado encerra a produção."""
    if production.status != "finalizado":
        production.status = "finalizado"
        db.add(production)


@router.post(
    "/{production_id}/waste",
    response_model=WasteRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_waste_record(
    production_id: uuid.UUID,
    data: WasteRecordCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Register the post-event balance for one item.

    Consumido + descartado (exposto) + devolvido (não exposto). O devolvido
    é creditado de volta no estoque. O primeiro balanço finaliza a produção.
    """
    production = await _load_production(db, production_id, user)

    record = WasteRecord(
        production_id=production_id,
        item=data.item,
        quantidade_produzida=data.quantidade_produzida,
        quantidade_consumida=data.quantidade_consumida,
        quantidade_descartada=data.quantidade_descartada,
        quantidade_devolvida=data.quantidade_devolvida,
        unidade=data.unidade,
        custo_desperdicio=data.custo_desperdicio,
    )
    db.add(record)
    await db.flush()

    await _credit_returned_to_stock(db, user.id, record)
    _finalize(production, db)
    await db.commit()
    await analytics.track(
        db,
        analytics.WASTE_REGISTERED,
        user.id,
        descartada=float(record.quantidade_descartada),
    )
    await db.refresh(record)
    return record


@router.put(
    "/{production_id}/waste/{record_id}",
    response_model=WasteRecordResponse,
)
async def update_waste_record(
    production_id: uuid.UUID,
    record_id: uuid.UUID,
    data: WasteRecordUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a balance record (only within 24h). Stock deltas are not reverted."""
    result = await db.execute(
        select(WasteRecord).where(
            WasteRecord.id == record_id,
            WasteRecord.production_id == production_id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Waste record not found")

    if record.created_at < datetime.now(UTC) - timedelta(hours=24):
        raise HTTPException(
            status_code=403,
            detail="Waste records can only be edited within 24 hours",
        )

    for field in (
        "quantidade_produzida",
        "quantidade_consumida",
        "quantidade_descartada",
        "quantidade_devolvida",
        "custo_desperdicio",
    ):
        value = getattr(data, field)
        if value is not None:
            setattr(record, field, value)

    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{production_id}/waste/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_waste_record(
    production_id: uuid.UUID,
    record_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a balance record (only within 24h). Stock deltas are not reverted."""
    result = await db.execute(
        select(WasteRecord).where(
            WasteRecord.id == record_id,
            WasteRecord.production_id == production_id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Waste record not found")

    if record.created_at < datetime.now(UTC) - timedelta(hours=24):
        raise HTTPException(
            status_code=403,
            detail="Waste records can only be deleted within 24 hours",
        )

    await db.delete(record)
    await db.commit()
