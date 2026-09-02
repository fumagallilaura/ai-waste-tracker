from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import Production, ProductionRecipe, RecipeIngredient, ShoppingListItem, User
from app.schemas import ShoppingListItemResponse, ShoppingListUpdateItem

router = APIRouter()


@router.get("/{production_id}/shopping-list", response_model=list[ShoppingListItemResponse])
async def get_shopping_list(
    production_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get or generate the shopping list for a production."""
    # Verify ownership
    result = await db.execute(
        select(Production)
        .where(Production.id == production_id, Production.user_id == user.id)
        .options(selectinload(Production.production_recipes))
    )
    production = result.scalar_one_or_none()
    if production is None:
        raise HTTPException(status_code=404, detail="Production not found")

    # Check if shopping list already exists
    result = await db.execute(
        select(ShoppingListItem).where(ShoppingListItem.production_id == production_id)
    )
    existing_items = result.scalars().all()

    if existing_items:
        return existing_items

    # Generate shopping list
    ingredient_totals: dict[tuple[str, str], tuple[float, float]] = {}

    for pr in production.production_recipes:
        if pr.recipe_id:
            # Fluxo A: formal recipe
            result = await db.execute(
                select(RecipeIngredient).where(RecipeIngredient.recipe_id == pr.recipe_id)
            )
            ingredients = result.scalars().all()
            for ing in ingredients:
                key = (ing.ingrediente, ing.unidade_base)
                scaled_qtd = float(ing.unidade_base_qtd) * float(pr.escala_fator)
                scaled_price = float(ing.preco_unitario) * float(pr.escala_fator)
                if key in ingredient_totals:
                    old_qtd, old_price = ingredient_totals[key]
                    ingredient_totals[key] = (old_qtd + scaled_qtd, old_price + scaled_price)
                else:
                    ingredient_totals[key] = (scaled_qtd, scaled_price)
        elif pr.item_nome:
            # Fluxo B: avulso item
            key = (pr.item_nome, pr.item_unidade or "unidade")
            qtd = float(pr.item_quantidade_base or 0) * float(pr.escala_fator)
            if key in ingredient_totals:
                old_qtd, old_price = ingredient_totals[key]
                ingredient_totals[key] = (old_qtd + qtd, old_price)
            else:
                ingredient_totals[key] = (qtd, 0)

    # Create shopping list items
    for (ingrediente, unidade_base), (qtd_total, preco) in ingredient_totals.items():
        db.add(
            ShoppingListItem(
                production_id=production_id,
                ingrediente=ingrediente,
                quantidade_total=qtd_total,
                unidade_base=unidade_base,
                preco_estimado=preco,
                ja_tem_estoque=False,
            )
        )

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
    """Update a shopping list item (mark as 'already have')."""
    result = await db.execute(
        select(ShoppingListItem).where(
            ShoppingListItem.id == item_id,
            ShoppingListItem.production_id == production_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Shopping list item not found")

    item.ja_tem_estoque = data.ja_tem_estoque
    await db.commit()
    await db.refresh(item)
    return item
