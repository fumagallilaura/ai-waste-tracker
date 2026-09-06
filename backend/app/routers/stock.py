from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.units import to_base_unit
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import IngredientStock, User
from app.schemas import StockAdjustRequest, StockItemResponse, StockSetRequest

router = APIRouter()


async def _find_stock_item(
    db: AsyncSession, user_id: uuid.UUID, ingrediente: str
) -> IngredientStock | None:
    result = await db.execute(
        select(IngredientStock).where(
            IngredientStock.user_id == user_id,
            func.lower(IngredientStock.ingrediente) == ingrediente.strip().lower(),
        )
    )
    return result.scalar_one_or_none()


async def _get_stock_item(
    db: AsyncSession, item_id: uuid.UUID, user: User
) -> IngredientStock:
    result = await db.execute(
        select(IngredientStock).where(
            IngredientStock.id == item_id, IngredientStock.user_id == user.id
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Stock item not found")
    return item


def _check_unit(item: IngredientStock, base_unit: str) -> None:
    if item.unidade_base != base_unit:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unidade incompatível: '{item.ingrediente}' é controlado em "
                f"{item.unidade_base}, não em {base_unit}"
            ),
        )


@router.get("/", response_model=list[StockItemResponse])
async def list_stock(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List current ingredient stock (base units: g/ml/unidade)."""
    result = await db.execute(
        select(IngredientStock)
        .where(IngredientStock.user_id == user.id)
        .order_by(IngredientStock.ingrediente)
    )
    return result.scalars().all()


@router.post("/", response_model=StockItemResponse, status_code=status.HTTP_201_CREATED)
async def adjust_stock(
    data: StockAdjustRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Move stock: positive delta = entrada, negative = saída. Creates the item if new."""
    delta, base_unit = to_base_unit(data.quantidade_delta, data.unidade)
    item = await _find_stock_item(db, user.id, data.ingrediente)
    if item is None:
        if delta < 0:
            raise HTTPException(
                status_code=404,
                detail=f"Ingrediente '{data.ingrediente}' não está no estoque",
            )
        item = IngredientStock(
            user_id=user.id,
            ingrediente=data.ingrediente.strip(),
            unidade_base=base_unit,
            quantidade=max(0, delta),
            preco_unitario=data.preco_unitario,
        )
        db.add(item)
    else:
        _check_unit(item, base_unit)
        item.quantidade = max(0, float(item.quantidade) + delta)
        if data.preco_unitario > 0:
            item.preco_unitario = data.preco_unitario
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/{item_id}", response_model=StockItemResponse)
async def set_stock(
    item_id: uuid.UUID,
    data: StockSetRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Set the absolute quantity of a stock item."""
    item = await _get_stock_item(db, item_id, user)
    quantidade, base_unit = to_base_unit(data.quantidade, data.unidade)
    _check_unit(item, base_unit)
    item.quantidade = quantidade
    if data.preco_unitario > 0:
        item.preco_unitario = data.preco_unitario
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stock_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Remove an ingredient from stock tracking."""
    item = await _get_stock_item(db, item_id, user)
    await db.delete(item)
    await db.commit()
