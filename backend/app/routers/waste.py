from __future__ import annotations

import contextlib
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import Production, User, WasteRecord
from app.schemas import WasteRecordCreate, WasteRecordResponse, WasteRecordUpdate
from app.services.notification_service import send_waste_reminder

router = APIRouter()


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
    """Register waste for a production."""
    # Verify ownership
    result = await db.execute(
        select(Production).where(
            Production.id == production_id, Production.user_id == user.id
        )
    )
    production = result.scalar_one_or_none()
    if production is None:
        raise HTTPException(status_code=404, detail="Production not found")

    waste_record = WasteRecord(
        production_id=production_id,
        ingrediente_ou_prato=data.ingrediente_ou_prato,
        quantidade_sobrou=data.quantidade_sobrou,
        unidade=data.unidade,
        motivo=data.motivo,
        custo_desperdicio=data.custo_desperdicio,
    )
    db.add(waste_record)
    await db.commit()
    await db.refresh(waste_record)

    # Update production status to finalizado if not already
    was_new = production.status != "finalizado"
    if was_new:
        production.status = "finalizado"
        await db.commit()

        # Send reminder email (first waste record = event finished).
        # Don't fail the request if email fails.
        with contextlib.suppress(Exception):
            await send_waste_reminder(
                user_email=user.email,
                production_nome=production.nome,
                production_data=production.data.strftime("%d/%m/%Y"),
            )

    return waste_record


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
    """Update a waste record (only within 24h)."""
    result = await db.execute(
        select(WasteRecord).where(
            WasteRecord.id == record_id,
            WasteRecord.production_id == production_id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Waste record not found")

    # Check 24h window
    if record.created_at < datetime.now(UTC) - timedelta(hours=24):
        raise HTTPException(
            status_code=403,
            detail="Waste records can only be edited within 24 hours",
        )

    if data.quantidade_sobrou is not None:
        record.quantidade_sobrou = data.quantidade_sobrou
    if data.custo_desperdicio is not None:
        record.custo_desperdicio = data.custo_desperdicio

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
    """Delete a waste record (only within 24h)."""
    result = await db.execute(
        select(WasteRecord).where(
            WasteRecord.id == record_id,
            WasteRecord.production_id == production_id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Waste record not found")

    # Check 24h window
    if record.created_at < datetime.now(UTC) - timedelta(hours=24):
        raise HTTPException(
            status_code=403,
            detail="Waste records can only be deleted within 24 hours",
        )

    await db.delete(record)
    await db.commit()
