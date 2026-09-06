"""Trial sem login: 1 produção + 1 balanço por visitante.

Identificação: cookie first-party de longa duração (dz_guest) cujo valor é
hasheado antes de tocar o banco; o IP chega apenas como hash (LGPD: minimização).
No login/registro, as produções do visitante são associadas à conta (claim).
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.core.rate_limit import limiter
from app.core.units import to_base_unit
from app.db.session import get_db
from app.models import Production, ProductionRecipe, ShoppingListItem, WasteRecord
from app.routers.shopping import _generate_shopping_list
from app.schemas import ProductionCreate, WasteRecordCreate

router = APIRouter()

GUEST_COOKIE = "dz_guest"
GUEST_QUOTA_MESSAGE = (
    "Você já criou sua produção grátis sem cadastro. "
    "Crie uma conta (leva 1 minuto) para continuar usando o app."
)
GUEST_BALANCE_MESSAGE = (
    "O balanço deste evento já foi registrado. Crie uma conta para acompanhar "
    "seus números e registrar novos eventos."
)


def _hash_value(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _guest_hash(request: Request, response: Response) -> str:
    """Read (or create) the guest cookie and return its DB-safe hash."""
    settings = get_settings()
    guest_id = request.cookies.get(GUEST_COOKIE)
    if not guest_id or len(guest_id) > 64:
        guest_id = uuid.uuid4().hex
        response.set_cookie(
            GUEST_COOKIE,
            guest_id,
            max_age=60 * 60 * 24 * 365 * 2,
            httponly=True,
            samesite="lax",
            secure=settings.cookie_secure,
        )
    return _hash_value(guest_id)


async def _load_guest_production(
    db: AsyncSession, production_id: uuid.UUID, guest_hash: str
) -> Production:
    result = await db.execute(
        select(Production)
        .where(
            Production.id == production_id,
            Production.guest_identifier_hash == guest_hash,
            Production.user_id.is_(None),
        )
        .options(selectinload(Production.production_recipes))
    )
    production = result.scalar_one_or_none()
    if production is None:
        raise HTTPException(status_code=404, detail="Produção não encontrada")
    return production


def _detail(production: Production) -> dict:
    return {
        "id": production.id,
        "nome": production.nome,
        "tipo": production.tipo,
        "data": production.data.date(),
        "convidados": production.convidados,
        "client_id": None,
        "status": production.status,
        "created_at": production.created_at,
        "updated_at": production.updated_at,
        "recipes": [
            {
                "id": pr.id,
                "recipe_id": None,
                "escala_fator": pr.escala_fator,
                "item_nome": pr.item_nome,
            }
            for pr in production.production_recipes
        ],
        "shopping_list": [
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
        "waste_records": [
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
    }


@router.post("/productions", status_code=status.HTTP_201_CREATED)
@limiter.limit(f"{get_settings().rate_limit_guest_per_minute}/minute")
async def create_guest_production(
    request: Request,
    response: Response,
    data: ProductionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create the single free production for an unauthenticated visitor."""
    guest_hash = _guest_hash(request, response)

    result = await db.execute(
        select(func.count(Production.id)).where(
            Production.guest_identifier_hash == guest_hash,
            Production.user_id.is_(None),
        )
    )
    if (result.scalar_one() or 0) >= 1:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=GUEST_QUOTA_MESSAGE)

    if any(item.recipe_id is not None for item in data.recipes):
        raise HTTPException(
            status_code=422,
            detail="No modo visitante, informe os itens manualmente (sem receitas cadastradas).",
        )

    production = Production(
        user_id=None,
        guest_identifier_hash=guest_hash,
        ip_hash=_hash_value(_client_ip(request)),
        nome=data.nome.strip()[:255],
        tipo=data.tipo or "outro",
        data=datetime.combine(data.data, datetime.min.time()),
        convidados=data.convidados,
        client_id=None,
        status="planejado",
    )
    db.add(production)
    await db.flush()

    for item in data.recipes:
        if not item.item_nome:
            continue
        qtd, base_unit = to_base_unit(
            item.item_quantidade_base or 0, item.item_unidade or "unidade"
        )
        db.add(
            ProductionRecipe(
                production_id=production.id,
                recipe_id=None,
                escala_fator=1,
                item_nome=item.item_nome.strip()[:255],
                item_quantidade_base=qtd,
                item_unidade=base_unit,
            )
        )

    await db.commit()

    result = await db.execute(
        select(Production)
        .where(Production.id == production.id)
        .options(
            selectinload(Production.production_recipes),
            selectinload(Production.shopping_list),
            selectinload(Production.waste_records),
        )
    )
    return _detail(result.scalar_one())


@router.get("/productions/{production_id}")
async def get_guest_production(
    production_id: uuid.UUID,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Get the guest's own production (cookie must match)."""
    guest_hash = _guest_hash(request, response)
    result = await db.execute(
        select(Production)
        .where(Production.id == production_id)
        .options(
            selectinload(Production.production_recipes),
            selectinload(Production.shopping_list),
            selectinload(Production.waste_records),
        )
    )
    production = result.scalar_one_or_none()
    if (
        production is None
        or production.user_id is not None
        or production.guest_identifier_hash != guest_hash
    ):
        raise HTTPException(status_code=404, detail="Produção não encontrada")
    return _detail(production)


@router.get("/productions/{production_id}/shopping-list")
async def get_guest_shopping_list(
    production_id: uuid.UUID,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Get (or generate) the requisition list for the guest production."""
    guest_hash = _guest_hash(request, response)
    production = await _load_guest_production(db, production_id, guest_hash)

    result = await db.execute(
        select(ShoppingListItem).where(ShoppingListItem.production_id == production_id)
    )
    existing = result.scalars().all()
    if existing:
        return [_detail_shopping_item(sl) for sl in existing]

    items = await _generate_shopping_list(db, production, user_id=None)
    for item in items:
        db.add(item)
    await db.commit()

    result = await db.execute(
        select(ShoppingListItem).where(ShoppingListItem.production_id == production_id)
    )
    return [_detail_shopping_item(sl) for sl in result.scalars().all()]


def _detail_shopping_item(sl: ShoppingListItem) -> dict:
    return {
        "id": sl.id,
        "ingrediente": sl.ingrediente,
        "quantidade_total": sl.quantidade_total,
        "unidade_base": sl.unidade_base,
        "quantidade_estoque": sl.quantidade_estoque,
        "quantidade_a_comprar": sl.quantidade_a_comprar,
        "preco_unitario": sl.preco_unitario,
        "preco_estimado": sl.preco_estimado,
    }


@router.post("/productions/{production_id}/waste")
@limiter.limit(f"{get_settings().rate_limit_guest_per_minute}/minute")
async def create_guest_waste(
    production_id: uuid.UUID,
    request: Request,
    response: Response,
    data: WasteRecordCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register the single post-event balance for the guest production."""
    guest_hash = _guest_hash(request, response)
    production = await _load_guest_production(db, production_id, guest_hash)

    result = await db.execute(
        select(func.count(WasteRecord.id)).where(
            WasteRecord.production_id == production_id
        )
    )
    if (result.scalar_one() or 0) >= 1:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=GUEST_BALANCE_MESSAGE)

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
    production.status = "finalizado"
    await db.commit()
    await db.refresh(record)
    return {
        "id": record.id,
        "item": record.item,
        "quantidade_produzida": record.quantidade_produzida,
        "quantidade_consumida": record.quantidade_consumida,
        "quantidade_descartada": record.quantidade_descartada,
        "quantidade_devolvida": record.quantidade_devolvida,
        "unidade": record.unidade,
        "custo_desperdicio": record.custo_desperdicio,
        "created_at": record.created_at,
    }
