from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.units import to_base_unit
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import Recipe, RecipeIngredient, User
from app.schemas import RecipeCreate, RecipeResponse, RecipeUpdate

router = APIRouter()


@router.get("/", response_model=list[RecipeResponse])
async def list_recipes(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all recipes for the current user."""
    result = await db.execute(
        select(Recipe)
        .where(Recipe.user_id == user.id)
        .options(selectinload(Recipe.ingredients))
        .order_by(Recipe.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    data: RecipeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new recipe."""
    recipe = Recipe(
        user_id=user.id,
        nome=data.nome,
        rendimento_base=data.rendimento_base,
        tipo=data.tipo,
    )
    db.add(recipe)
    await db.flush()

    for ing in data.ingredients:
        base_qtd, base_unit = to_base_unit(ing.quantidade, ing.unidade)
        recipe.ingredients.append(
            RecipeIngredient(
                ingrediente=ing.ingrediente,
                quantidade=ing.quantidade,
                unidade=ing.unidade,
                preco_unitario=ing.preco_unitario,
                unidade_base=base_unit,
                unidade_base_qtd=base_qtd,
            )
        )

    await db.commit()
    await db.refresh(recipe)
    return recipe


@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(
    recipe_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a recipe by ID."""
    result = await db.execute(
        select(Recipe)
        .where(Recipe.id == recipe_id, Recipe.user_id == user.id)
        .options(selectinload(Recipe.ingredients))
    )
    recipe = result.scalar_one_or_none()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.put("/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(
    recipe_id: uuid.UUID,
    data: RecipeUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a recipe."""
    result = await db.execute(
        select(Recipe)
        .where(Recipe.id == recipe_id, Recipe.user_id == user.id)
        .options(selectinload(Recipe.ingredients))
    )
    recipe = result.scalar_one_or_none()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    if data.nome is not None:
        recipe.nome = data.nome
    if data.rendimento_base is not None:
        recipe.rendimento_base = data.rendimento_base
    if data.tipo is not None:
        recipe.tipo = data.tipo
    if data.ingredients is not None:
        # Replace all ingredients
        recipe.ingredients.clear()
        for ing in data.ingredients:
            base_qtd, base_unit = to_base_unit(ing.quantidade, ing.unidade)
            recipe.ingredients.append(
                RecipeIngredient(
                    ingrediente=ing.ingrediente,
                    quantidade=ing.quantidade,
                    unidade=ing.unidade,
                    preco_unitario=ing.preco_unitario,
                    unidade_base=base_unit,
                    unidade_base_qtd=base_qtd,
                )
            )

    await db.commit()
    await db.refresh(recipe)
    return recipe


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a recipe."""
    result = await db.execute(
        select(Recipe).where(Recipe.id == recipe_id, Recipe.user_id == user.id)
    )
    recipe = result.scalar_one_or_none()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    await db.delete(recipe)
    await db.commit()


@router.post("/{recipe_id}/duplicate", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_recipe(
    recipe_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Duplicate a recipe."""
    result = await db.execute(
        select(Recipe)
        .where(Recipe.id == recipe_id, Recipe.user_id == user.id)
        .options(selectinload(Recipe.ingredients))
    )
    original = result.scalar_one_or_none()
    if original is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    recipe = Recipe(
        user_id=user.id,
        nome=f"{original.nome} (cópia)",
        rendimento_base=original.rendimento_base,
        tipo=original.tipo,
    )
    db.add(recipe)
    await db.flush()

    for ing in original.ingredients:
        recipe.ingredients.append(
            RecipeIngredient(
                ingrediente=ing.ingrediente,
                quantidade=ing.quantidade,
                unidade=ing.unidade,
                preco_unitario=ing.preco_unitario,
                unidade_base=ing.unidade_base,
                unidade_base_qtd=ing.unidade_base_qtd,
            )
        )

    await db.commit()
    await db.refresh(recipe)
    return recipe
