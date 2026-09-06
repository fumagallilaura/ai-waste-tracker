from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.units import UNIT_CONVERSIONS, to_base_unit
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import Client, Production, User, WasteRecord
from app.schemas import (
    ClientCreate,
    ClientPatternItem,
    ClientPatternResponse,
    ClientResponse,
    ClientUpdate,
    ProductionSuggestionResponse,
    SuggestionItem,
)

router = APIRouter()

# Margem padrão sobre o consumo histórico ao sugerir produção (10%).
DEFAULT_MARGEM = 0.1


async def _get_client(
    db: AsyncSession, client_id: uuid.UUID, user: User
) -> Client:
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.user_id == user.id)
    )
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.get("/", response_model=list[ClientResponse])
async def list_clients(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all clients/buffets."""
    result = await db.execute(
        select(Client)
        .where(Client.user_id == user.id)
        .order_by(Client.nome)
    )
    return result.scalars().all()


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    data: ClientCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a client or buffet."""
    client = Client(
        user_id=user.id,
        nome=data.nome,
        tipo=data.tipo,
        fator_producao=data.fator_producao,
        observacoes=data.observacoes,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a client by ID."""
    return await _get_client(db, client_id, user)


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: uuid.UUID,
    data: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a client."""
    client = await _get_client(db, client_id, user)
    if data.nome is not None:
        client.nome = data.nome
    if data.tipo is not None:
        client.tipo = data.tipo
    if data.fator_producao is not None:
        client.fator_producao = data.fator_producao
    if data.observacoes is not None:
        client.observacoes = data.observacoes
    await db.commit()
    await db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a client (productions keep going, unlinked)."""
    client = await _get_client(db, client_id, user)
    await db.delete(client)
    await db.commit()


async def _client_history(
    db: AsyncSession, client_id: uuid.UUID, user_id: uuid.UUID
) -> list[tuple[Production, list[WasteRecord]]]:
    """Finalized productions of this client with their waste balance records."""
    result = await db.execute(
        select(Production)
        .where(
            Production.client_id == client_id,
            Production.user_id == user_id,
            Production.status == "finalizado",
        )
        .order_by(Production.data)
    )
    productions = result.scalars().all()
    history: list[tuple[Production, list[WasteRecord]]] = []
    for production in productions:
        result = await db.execute(
            select(WasteRecord).where(WasteRecord.production_id == production.id)
        )
        records = result.scalars().all()
        history.append((production, records))
    return history


def _build_pattern(
    client: Client, history: list[tuple[Production, list[WasteRecord]]]
) -> ClientPatternResponse:
    """Aggregate the balance history into a per-item consumption pattern."""
    # item -> {unidade, producao, consumo, descarte, devolucao, guests, com_guests}
    stats: dict[str, dict[str, float | str | int]] = {}
    for production, records in history:
        for record in records:
            base_unit = str(UNIT_CONVERSIONS[record.unidade]["base"])
            entry = stats.setdefault(
                record.item,
                {
                    "unidade_base": base_unit,
                    "eventos": 0,
                    "produzida": 0.0,
                    "consumida": 0.0,
                    "descartada": 0.0,
                    "devolvida": 0.0,
                    "convidados": 0,
                    "eventos_com_convidados": 0,
                },
            )
            qtd_consumida, _ = to_base_unit(record.quantidade_consumida, record.unidade)
            qtd_descartada, _ = to_base_unit(record.quantidade_descartada, record.unidade)
            qtd_devolvida, _ = to_base_unit(record.quantidade_devolvida, record.unidade)
            qtd_produzida, _ = to_base_unit(record.quantidade_produzida, record.unidade)
            entry["eventos"] = int(entry["eventos"]) + 1
            entry["produzida"] = float(entry["produzida"]) + qtd_produzida
            entry["consumida"] = float(entry["consumida"]) + qtd_consumida
            entry["descartada"] = float(entry["descartada"]) + qtd_descartada
            entry["devolvida"] = float(entry["devolvida"]) + qtd_devolvida
            if production.convidados:
                entry["convidados"] = int(entry["convidados"]) + production.convidados
                entry["eventos_com_convidados"] = int(entry["eventos_com_convidados"]) + 1

    items: list[ClientPatternItem] = []
    for item, entry in sorted(stats.items()):
        eventos = int(entry["eventos"])
        com_convidados = int(entry["eventos_com_convidados"])
        consumo_por_convidado: float | None = None
        if com_convidados and int(entry["convidados"]) > 0:
            consumo_por_convidado = round(
                float(entry["consumida"]) / int(entry["convidados"]), 3
            )
        items.append(
            ClientPatternItem(
                item=item,
                unidade_base=str(entry["unidade_base"]),
                eventos=eventos,
                media_produzida=round(float(entry["produzida"]) / eventos, 3),
                media_consumida=round(float(entry["consumida"]) / eventos, 3),
                media_descartada=round(float(entry["descartada"]) / eventos, 3),
                media_devolvida=round(float(entry["devolvida"]) / eventos, 3),
                consumo_por_convidado=consumo_por_convidado,
            )
        )

    return ClientPatternResponse(
        client_id=client.id,
        nome=client.nome,
        fator_producao=float(client.fator_producao),
        eventos_analisados=len(history),
        itens=items,
    )


@router.get("/{client_id}/pattern", response_model=ClientPatternResponse)
async def get_client_pattern(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Consumption pattern of a client, aggregated from finished event balances."""
    client = await _get_client(db, client_id, user)
    history = await _client_history(db, client_id, user.id)
    return _build_pattern(client, history)


@router.get("/{client_id}/suggestion", response_model=ProductionSuggestionResponse)
async def get_production_suggestion(
    client_id: uuid.UUID,
    convidados: int = Query(gt=0),
    margem: float = Query(default=DEFAULT_MARGEM, ge=0, le=1),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Suggest how much of each item to produce for the next event.

    Base: average consumed per guest from the client's history, plus a safety
    margin (default 10%). Items without guest history are skipped.
    """
    client = await _get_client(db, client_id, user)
    history = await _client_history(db, client_id, user.id)
    pattern = _build_pattern(client, history)

    itens = [
        SuggestionItem(
            item=entry.item,
            unidade_base=entry.unidade_base,
            quantidade_sugerida=round(
                entry.consumo_por_convidado * convidados * (1 + margem), 2
            ),
            base_historica=round(entry.consumo_por_convidado * convidados, 2),
        )
        for entry in pattern.itens
        if entry.consumo_por_convidado is not None
    ]
    return ProductionSuggestionResponse(
        client_id=client.id,
        convidados=convidados,
        margem_aplicada=margem,
        itens=itens,
    )
