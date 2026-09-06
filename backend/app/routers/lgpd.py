"""LGPD compliance endpoints: data export and account deletion."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import Client, IngredientStock, Production, Recipe, User

router = APIRouter()


@router.get("/export")
async def export_user_data(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export all user data (LGPD Article 18)."""
    # Fetch all recipes
    recipes_result = await db.execute(
        select(Recipe)
        .where(Recipe.user_id == user.id)
        .options(selectinload(Recipe.ingredients))
    )
    recipes = recipes_result.scalars().all()

    # Fetch all productions
    productions_result = await db.execute(
        select(Production)
        .where(Production.user_id == user.id)
        .options(
            selectinload(Production.production_recipes),
            selectinload(Production.shopping_list),
            selectinload(Production.waste_records),
        )
    )
    productions = productions_result.scalars().all()

    # Fetch clients and stock
    clients_result = await db.execute(select(Client).where(Client.user_id == user.id))
    clients = clients_result.scalars().all()
    stock_result = await db.execute(
        select(IngredientStock).where(IngredientStock.user_id == user.id)
    )
    stock_items = stock_result.scalars().all()

    # Build export data
    export_data = {
        "exported_at": datetime.now(UTC).isoformat(),
        "user": {
            "id": str(user.id),
            "email": user.email,
            "plan": user.plan,
            "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
            "created_at": user.created_at.isoformat(),
        },
        "recipes": [
            {
                "id": str(r.id),
                "nome": r.nome,
                "rendimento_base": r.rendimento_base,
                "tipo": r.tipo,
                "created_at": r.created_at.isoformat(),
                "ingredients": [
                    {
                        "ingrediente": i.ingrediente,
                        "quantidade": float(i.quantidade),
                        "unidade": i.unidade,
                        "preco_unitario": float(i.preco_unitario),
                        "unidade_base": i.unidade_base,
                        "unidade_base_qtd": float(i.unidade_base_qtd),
                    }
                    for i in r.ingredients
                ],
            }
            for r in recipes
        ],
        "productions": [
            {
                "id": str(p.id),
                "nome": p.nome,
                "tipo": p.tipo,
                "data": p.data.isoformat(),
                "convidados": p.convidados,
                "status": p.status,
                "created_at": p.created_at.isoformat(),
                "recipes": [
                    {
                        "recipe_id": str(pr.recipe_id) if pr.recipe_id else None,
                        "escala_fator": float(pr.escala_fator),
                        "item_nome": pr.item_nome,
                    }
                    for pr in p.production_recipes
                ],
                "shopping_list": [
                    {
                        "ingrediente": sl.ingrediente,
                        "quantidade_total": float(sl.quantidade_total),
                        "unidade_base": sl.unidade_base,
                        "quantidade_estoque": float(sl.quantidade_estoque),
                        "quantidade_a_comprar": float(sl.quantidade_a_comprar),
                        "preco_unitario": float(sl.preco_unitario),
                        "preco_estimado": float(sl.preco_estimado),
                    }
                    for sl in p.shopping_list
                ],
                "waste_records": [
                    {
                        "item": wr.item,
                        "quantidade_produzida": float(wr.quantidade_produzida),
                        "quantidade_consumida": float(wr.quantidade_consumida),
                        "quantidade_descartada": float(wr.quantidade_descartada),
                        "quantidade_devolvida": float(wr.quantidade_devolvida),
                        "unidade": wr.unidade,
                        "custo_desperdicio": float(wr.custo_desperdicio),
                        "created_at": wr.created_at.isoformat(),
                    }
                    for wr in p.waste_records
                ],
            }
            for p in productions
        ],
        "clients": [
            {
                "id": str(c.id),
                "nome": c.nome,
                "tipo": c.tipo,
                "fator_producao": float(c.fator_producao),
                "observacoes": c.observacoes,
            }
            for c in clients
        ],
        "stock": [
            {
                "ingrediente": s.ingrediente,
                "unidade_base": s.unidade_base,
                "quantidade": float(s.quantidade),
                "preco_unitario": float(s.preco_unitario),
            }
            for s in stock_items
        ],
    }

    return export_data


@router.post("/delete-account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete user account and all associated data (LGPD Article 18)."""
    # Delete all related data (CASCADE handles recipes, productions, etc.)
    await db.delete(user)
    await db.commit()

    return None
