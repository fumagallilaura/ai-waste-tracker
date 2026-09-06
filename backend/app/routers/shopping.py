from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.units import ingredient_cost
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import (
    IngredientStock,
    Production,
    RecipeIngredient,
    ShoppingListItem,
    User,
)
from app.schemas import ShoppingListItemResponse, ShoppingListUpdateItem

router = APIRouter()


async def _load_production(
    db: AsyncSession, production_id: uuid.UUID, user: User
) -> Production:
    result = await db.execute(
        select(Production)
        .where(Production.id == production_id, Production.user_id == user.id)
        .options(selectinload(Production.production_recipes))
    )
    production = result.scalar_one_or_none()
    if production is None:
        raise HTTPException(status_code=404, detail="Production not found")
    return production


async def _stock_map(db: AsyncSession, user_id: uuid.UUID) -> dict[str, IngredientStock]:
    result = await db.execute(
        select(IngredientStock).where(IngredientStock.user_id == user_id)
    )
    items = result.scalars().all()
    return {item.ingrediente.lower(): item for item in items}


async def _generate_shopping_list(
    db: AsyncSession, production: Production, user_id: uuid.UUID | None
) -> list[ShoppingListItem]:
    """Aggregate ingredients and compute the requisition against current stock.

    Visitantes (user_id None) não têm estoque — a lista pede tudo.
    """
    ingredient_totals: dict[tuple[str, str], tuple[float, float]] = {}

    for pr in production.production_recipes:
        if pr.recipe_id:
            result = await db.execute(
                select(RecipeIngredient).where(RecipeIngredient.recipe_id == pr.recipe_id)
            )
            ingredients = result.scalars().all()
            for ing in ingredients:
                key = (ing.ingrediente, ing.unidade_base)
                scaled_qtd = float(ing.unidade_base_qtd) * float(pr.escala_fator)
                if key in ingredient_totals:
                    old_qtd, old_price = ingredient_totals[key]
                    ingredient_totals[key] = (old_qtd + scaled_qtd, old_price)
                else:
                    ingredient_totals[key] = (scaled_qtd, float(ing.preco_unitario))
        elif pr.item_nome:
            key = (pr.item_nome, pr.item_unidade or "unidade")
            qtd = float(pr.item_quantidade_base or 0) * float(pr.escala_fator)
            if key in ingredient_totals:
                old_qtd, old_price = ingredient_totals[key]
                ingredient_totals[key] = (old_qtd + qtd, old_price)
            else:
                ingredient_totals[key] = (qtd, 0)

    stock_map = await _stock_map(db, user_id) if user_id else {}
    items: list[ShoppingListItem] = []
    for (ingrediente, unidade_base), (qtd_total, preco_unitario) in ingredient_totals.items():
        stock_item = stock_map.get(ingrediente.lower())
        em_estoque = (
            float(stock_item.quantidade)
            if stock_item is not None and stock_item.unidade_base == unidade_base
            else 0
        )
        a_comprar = max(0, qtd_total - em_estoque)
        items.append(
            ShoppingListItem(
                production_id=production.id,
                ingrediente=ingrediente,
                quantidade_total=qtd_total,
                unidade_base=unidade_base,
                quantidade_estoque=em_estoque,
                quantidade_a_comprar=a_comprar,
                preco_unitario=preco_unitario,
                preco_estimado=ingredient_cost(
                    a_comprar, unidade_base, preco_unitario
                ),
            )
        )
    return items


@router.get("/{production_id}/shopping-list", response_model=list[ShoppingListItemResponse])
async def get_shopping_list(
    production_id: uuid.UUID,
    regenerate: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get (or generate) the requisition list for a production.

    `regenerate=true` recalculates quantities and stock snapshot (prices stay).
    """
    production = await _load_production(db, production_id, user)

    result = await db.execute(
        select(ShoppingListItem).where(ShoppingListItem.production_id == production_id)
    )
    existing_items = result.scalars().all()

    if existing_items and not regenerate:
        return existing_items

    if existing_items:
        for item in existing_items:
            await db.delete(item)
        await db.flush()

    items = await _generate_shopping_list(db, production, user.id)
    for item in items:
        db.add(item)
    await db.commit()

    result = await db.execute(
        select(ShoppingListItem).where(ShoppingListItem.production_id == production_id)
    )
    return result.scalars().all()


@router.put(
    "/{production_id}/shopping-list/{item_id}",
    response_model=ShoppingListItemResponse,
)
async def update_shopping_list_item(
    production_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ShoppingListUpdateItem,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Manually adjust how much of an item to requisition (e.g., pantry check)."""
    result = await db.execute(
        select(ShoppingListItem).where(
            ShoppingListItem.id == item_id,
            ShoppingListItem.production_id == production_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Shopping list item not found")

    item.quantidade_a_comprar = data.quantidade_a_comprar
    item.preco_estimado = ingredient_cost(
        data.quantidade_a_comprar, item.unidade_base, float(item.preco_unitario)
    )
    await db.commit()
    await db.refresh(item)
    return item
