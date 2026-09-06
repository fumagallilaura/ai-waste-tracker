from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import Client, Production, ProductionRecipe, ShoppingListItem, User
from app.schemas import (
    ProductionCreate,
    ProductionDetailResponse,
    ProductionResponse,
    ProductionUpdate,
)
from app.services import analytics

router = APIRouter()


async def _validate_client(
    db: AsyncSession, client_id: uuid.UUID | None, user: User
) -> uuid.UUID | None:
    if client_id is None:
        return None
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.user_id == user.id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client_id


@router.get("/", response_model=list[ProductionResponse])
async def list_productions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all productions for the current user."""
    result = await db.execute(
        select(Production)
        .where(Production.user_id == user.id)
        .order_by(Production.data.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=ProductionResponse, status_code=status.HTTP_201_CREATED)
async def create_production(
    data: ProductionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new production (event or daily shift)."""
    client_id = await _validate_client(db, data.client_id, user)
    production = Production(
        user_id=user.id,
        client_id=client_id,
        nome=data.nome,
        tipo=data.tipo,
        data=datetime.combine(data.data, datetime.min.time()),
        convidados=data.convidados,
        status="planejado",
    )
    db.add(production)
    await db.flush()

    for item in data.recipes:
        db.add(
            ProductionRecipe(
                production_id=production.id,
                recipe_id=item.recipe_id,
                escala_fator=item.escala_fator,
                item_nome=item.item_nome,
                item_quantidade_base=item.item_quantidade_base,
                item_unidade=item.item_unidade,
            )
        )

    await db.commit()
    await analytics.track(
        db, analytics.PRODUCTION_CREATED, user.id, tipo=production.tipo
    )
    await db.refresh(production)
    return production


@router.get("/{production_id}", response_model=ProductionDetailResponse)
async def get_production(
    production_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a production by ID with details."""
    result = await db.execute(
        select(Production)
        .where(Production.id == production_id, Production.user_id == user.id)
        .options(
            selectinload(Production.production_recipes),
            selectinload(Production.shopping_list),
            selectinload(Production.waste_records),
        )
    )
    production = result.scalar_one_or_none()
    if production is None:
        raise HTTPException(status_code=404, detail="Production not found")

    return ProductionDetailResponse(
        id=production.id,
        nome=production.nome,
        tipo=production.tipo,
        data=production.data.date(),
        convidados=production.convidados,
        client_id=production.client_id,
        status=production.status,
        created_at=production.created_at,
        updated_at=production.updated_at,
        recipes=[
            {
                "id": pr.id,
                "recipe_id": pr.recipe_id,
                "escala_fator": pr.escala_fator,
                "item_nome": pr.item_nome,
            }
            for pr in production.production_recipes
        ],
        shopping_list=[
            {
                "id": sl.id,
                "ingrediente": sl.ingrediente,
                "quantidade_total": sl.quantidade_total,
                "unidade_base": sl.unidade_base,
                "quantidade_estoque": sl.quantidade_estoque,
                "quantidade_a_comprar": sl.quantidade_a_comprar,
                "preco_unitario": sl.preco_unitario,
                "preco_estimado": sl.preco_estimado,
            }
            for sl in production.shopping_list
        ],
        waste_records=[
            {
                "id": wr.id,
                "item": wr.item,
                "quantidade_produzida": wr.quantidade_produzida,
                "quantidade_consumida": wr.quantidade_consumida,
                "quantidade_descartada": wr.quantidade_descartada,
                "quantidade_devolvida": wr.quantidade_devolvida,
                "unidade": wr.unidade,
                "custo_desperdicio": wr.custo_desperdicio,
                "created_at": wr.created_at,
            }
            for wr in production.waste_records
        ],
    )


@router.put("/{production_id}", response_model=ProductionResponse)
async def update_production(
    production_id: uuid.UUID,
    data: ProductionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a production."""
    result = await db.execute(
        select(Production).where(
            Production.id == production_id, Production.user_id == user.id
        )
    )
    production = result.scalar_one_or_none()
    if production is None:
        raise HTTPException(status_code=404, detail="Production not found")

    if data.nome is not None:
        production.nome = data.nome
    if data.tipo is not None:
        production.tipo = data.tipo
    if data.data is not None:
        production.data = datetime.combine(data.data, datetime.min.time())
    if data.convidados is not None:
        production.convidados = data.convidados
    if "client_id" in data.model_fields_set:
        # permite desvincular (null) além de trocar de cliente
        production.client_id = await _validate_client(db, data.client_id, user)
    if data.status is not None:
        production.status = data.status
    if data.recipes is not None:
        # edição completa da lista de receitas/itens (query explícita: lazy-load
        # fora do contexto async levanta MissingGreenlet)
        result = await db.execute(
            select(ProductionRecipe).where(ProductionRecipe.production_id == production.id)
        )
        for old_pr in result.scalars().all():
            await db.delete(old_pr)
        await db.flush()
        for item in data.recipes:
            db.add(
                ProductionRecipe(
                    production_id=production.id,
                    recipe_id=item.recipe_id,
                    escala_fator=item.escala_fator,
                    item_nome=item.item_nome,
                    item_quantidade_base=item.item_quantidade_base,
                    item_unidade=item.item_unidade,
                )
            )
        # a lista antiga de compras não é mais válida: regenera na próxima consulta
        result = await db.execute(
            select(ShoppingListItem).where(ShoppingListItem.production_id == production.id)
        )
        for old_item in result.scalars().all():
            await db.delete(old_item)

    await db.commit()
    await db.refresh(production)
    return production


@router.delete("/{production_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_production(
    production_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a production."""
    result = await db.execute(
        select(Production).where(
            Production.id == production_id, Production.user_id == user.id
        )
    )
    production = result.scalar_one_or_none()
    if production is None:
        raise HTTPException(status_code=404, detail="Production not found")

    await db.delete(production)
    await db.commit()


@router.post(
    "/{production_id}/duplicate",
    response_model=ProductionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def duplicate_production(
    production_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Duplicate a production."""
    result = await db.execute(
        select(Production)
        .where(Production.id == production_id, Production.user_id == user.id)
        .options(selectinload(Production.production_recipes))
    )
    original = result.scalar_one_or_none()
    if original is None:
        raise HTTPException(status_code=404, detail="Production not found")

    production = Production(
        user_id=user.id,
        nome=f"{original.nome} (cópia)",
        tipo=original.tipo,
        data=original.data,
        convidados=original.convidados,
        client_id=original.client_id,
        status="planejado",
    )
    db.add(production)
    await db.flush()

    for pr in original.production_recipes:
        db.add(
            ProductionRecipe(
                production_id=production.id,
                recipe_id=pr.recipe_id,
                escala_fator=pr.escala_fator,
                item_nome=pr.item_nome,
                item_quantidade_base=pr.item_quantidade_base,
                item_unidade=pr.item_unidade,
            )
        )

    await db.commit()
    await db.refresh(production)
    return production
