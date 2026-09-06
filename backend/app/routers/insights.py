"""Análises e inteligência: comparação entre eventos e padrão por dia da semana.

- /insights/events: para quem faz eventos — consumo e descarte de cada produção
  comparados com a média dos eventos parecidos (mesmo tipo).
- /insights/daily: para comércios (produções do tipo turno_diario) — padrão de
  consumo por item × dia da semana, com sinal de demanda perdida ("saiu tudo e
  ainda pediam") e sugestão de quanto produzir.

As sugestões são determinísticas e explicáveis; `ai_context` devolve o resumo
estruturado pronto para alimentar uma IA conversacional depois.
"""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import Production, User, WasteRecord

router = APIRouter()

DIAS_SEMANA = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


def _period_start(periodo: str) -> date:
    today = date.today()
    if periodo == "ultimos_90_dias":
        return today - timedelta(days=90)
    if periodo == "ultimos_30_dias":
        return today - timedelta(days=30)
    return today.replace(day=1)


async def _finalized_with_balance(
    db: AsyncSession, user: User, periodo: str, tipo: str | None
) -> list[tuple[Production, list[WasteRecord]]]:
    start = _period_start(periodo)
    query = (
        select(Production)
        .where(
            Production.user_id == user.id,
            Production.status == "finalizado",
            Production.data >= start,
        )
        .order_by(Production.data)
    )
    if tipo:
        query = query.where(Production.tipo == tipo)
    productions = (await db.execute(query)).scalars().all()

    result: list[tuple[Production, list[WasteRecord]]] = []
    for production in productions:
        records = (
            await db.execute(
                select(WasteRecord).where(WasteRecord.production_id == production.id)
            )
        ).scalars().all()
        if records:
            result.append((production, records))
    return result


def _balance_sums(records: list[WasteRecord]) -> tuple[float, float, float, float]:
    """Totais em unidade-base por produção (consumido, descartado, devolvido, produzido)."""
    from app.core.units import UNIT_CONVERSIONS

    base = {"consumida": 0.0, "descartada": 0.0, "devolvida": 0.0, "produzida": 0.0}
    for record in records:
        factor = float(UNIT_CONVERSIONS[record.unidade]["factor"])
        for key in base:
            value = getattr(record, f"quantidade_{key}")
            base[key] += float(value) * factor
    return (
        base["consumida"],
        base["descartada"],
        base["devolvida"],
        base["produzida"],
    )


@router.get("/events")
async def event_insights(
    periodo: str = Query(default="mes_atual"),
    tipo: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Compara cada evento finalizado com a média dos eventos parecidos."""
    history = await _finalized_with_balance(db, user, periodo, tipo)
    if not history:
        return {
            "tipo": tipo,
            "periodo": periodo,
            "eventos": [],
            "resumo": None,
            "sugestoes": [],
            "ai_context": {"eventos": 0},
        }

    entries = []
    for production, records in history:
        consumido, descartado, devolvido, produzido = _balance_sums(records)
        registrado = consumido + descartado + devolvido
        consumo_pct = round(100 * consumido / registrado, 1) if registrado else 0.0
        descarte_pct = round(100 * descartado / registrado, 1) if registrado else 0.0
        custo_desperdicio = sum(float(r.custo_desperdicio) for r in records)
        entries.append({
            "id": production.id,
            "nome": production.nome,
            "tipo": production.tipo,
            "data": production.data.date(),
            "convidados": production.convidados,
            "consumo_pct": consumo_pct,
            "descarte_pct": descarte_pct,
            "custo_desperdicio": round(custo_desperdicio, 2),
        })

    media_consumo = round(sum(e["consumo_pct"] for e in entries) / len(entries), 1)
    media_descarte = round(sum(e["descarte_pct"] for e in entries) / len(entries), 1)
    for entry in entries:
        entry["vs_media_consumo"] = round(entry["consumo_pct"] - media_consumo, 1)
        entry["vs_media_descarte"] = round(entry["descarte_pct"] - media_descarte, 1)

    sugestoes: list[str] = []
    pior = max(entries, key=lambda e: e["descarte_pct"])
    if pior["descarte_pct"] > media_descarte:
        sugestoes.append(
            f"“{pior['nome']}” desperdiçou {pior['descarte_pct']}% do registrado — "
            f"{abs(pior['vs_media_descarte'])} p.p. acima da sua média de "
            f"{media_descarte}%. Produza menos desse tipo ou reduza o fator de segurança."
        )
    melhor = min(entries, key=lambda e: e["descarte_pct"])
    if melhor["descarte_pct"] < media_descarte:
        sugestoes.append(
            f"“{melhor['nome']}” é seu melhor padrão ({melhor['descarte_pct']}% de descarte). "
            "Use esse evento como referência ao planejar os próximos."
        )
    if media_consumo >= 95:
        sugestoes.append(
            "Você está consumindo praticamente tudo (sem sobra de segurança). "
            "Produzir um pouco mais evita perder vendas."
        )
    if media_descarte <= 5 and len(entries) >= 3:
        sugestoes.append("Seu descarte está sob controle. Continue com esse padrão de produção.")
    if len(entries) < 2 and media_descarte >= 15:
        sugestoes.append(
            f"Neste evento {media_descarte}% do que foi registrado virou descarte. "
            "Continue registrando balanços: com 2+ eventos parecidos, o app passa a "
            "comparar e sugerir ajustes por tipo de evento."
        )

    return {
        "tipo": tipo,
        "periodo": periodo,
        "eventos": entries,
        "resumo": {
            "eventos_analisados": len(entries),
            "media_consumo_pct": media_consumo,
            "media_descarte_pct": media_descarte,
        },
        "sugestoes": sugestoes,
        "ai_context": {
            "eventos": len(entries),
            "media_consumo_pct": media_consumo,
            "media_descarte_pct": media_descarte,
            "pior_evento": {"nome": pior["nome"], "descarte_pct": pior["descarte_pct"]},
            "melhor_evento": {"nome": melhor["nome"], "descarte_pct": melhor["descarte_pct"]},
        },
    }


@router.get("/daily")
async def daily_insights(
    periodo: str = Query(default="ultimos_90_dias"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Padrão por item × dia da semana para comércios (produções turno_diario)."""
    history = await _finalized_with_balance(db, user, periodo, tipo="turno_diario")

    # item -> dia -> {eventos, produzida, consumida, descartada, esgotou}
    stats: dict[str, dict[int, dict]] = {}
    item_unit: dict[str, str] = {}
    for production, records in history:
        weekday = production.data.weekday()  # 0=segunda ... 6=domingo
        for record in records:
            from app.core.units import to_base_unit

            item = record.item
            if item not in stats:
                stats[item] = {}
            day_stats = stats[item].setdefault(
                weekday,
                {"eventos": 0, "produzida": 0.0, "consumida": 0.0, "descartada": 0.0, "esgotou": 0},
            )
            produzida, _ = to_base_unit(record.quantidade_produzida, record.unidade)
            consumida, base_unit = to_base_unit(record.quantidade_consumida, record.unidade)
            descartada, _ = to_base_unit(record.quantidade_descartada, record.unidade)
            item_unit.setdefault(item, base_unit)
            day_stats["eventos"] += 1
            day_stats["produzida"] += produzida
            day_stats["consumida"] += consumida
            day_stats["descartada"] += descartada
            if produzida > 0 and consumida >= produzida * 0.98 and descartada == 0:
                day_stats["esgotou"] += 1  # saiu tudo: possível venda perdida

    itens = []
    for item, days in sorted(stats.items()):
        unit = item_unit.get(item, "unidade")
        dias_saida = []
        for weekday in sorted(days):
            day_stats = days[weekday]
            eventos = day_stats["eventos"]
            media_produzida = day_stats["produzida"] / eventos
            media_consumida = day_stats["consumida"] / eventos
            esgotou_pct = round(100 * day_stats["esgotou"] / eventos, 0)
            sobrou_pct = (
                round(100 * day_stats["descartada"] / day_stats["produzida"], 1)
                if day_stats["produzida"] > 0
                else 0.0
            )
            # sugestão: consumo médio ajustado por demanda perdida e sobra
            sugerida = media_consumida * (1 + esgotou_pct / 100 * 0.15) * (
                1 - sobrou_pct / 100 * 0.5
            )
            dias_saida.append({
                "dia": DIAS_SEMANA[weekday],
                "eventos": eventos,
                "media_produzida": round(media_produzida, 1),
                "media_consumida": round(media_consumida, 1),
                "sobrou_pct": sobrou_pct,
                "esgotou_pct": esgotou_pct,
                "producao_sugerida": round(max(0, sugerida), 1),
            })
        itens.append({"item": item, "unidade_base": unit, "dias": dias_saida})

    sugestoes: list[str] = []
    for item_entry in itens:
        for day in item_entry["dias"]:
            frequencia = (
                f"nos {day['eventos']} turnos de {day['dia']} registrados"
                if day["eventos"] > 1
                else f"no último turno de {day['dia']}"
            )
            if day["esgotou_pct"] >= 50:
                sugestoes.append(
                    f"“{item_entry['item']}” esgotou {day['esgotou_pct']:.0f}% das vezes "
                    f"{frequencia} — sinal de venda perdida. Produza "
                    f"~{day['producao_sugerida']:,.0f} {item_entry['unidade_base']}."
                )
            elif day["sobrou_pct"] >= 25:
                sugestoes.append(
                    f"“{item_entry['item']}” sobrou {day['sobrou_pct']}% "
                    f"{frequencia} — produza ~{day['producao_sugerida']:,.0f} "
                    f"{item_entry['unidade_base']} para reduzir o descarte."
                )

    return {
        "periodo": periodo,
        "dias_analisados": len({p.data.date() for p, _ in history}),
        "itens": itens,
        "sugestoes": sugestoes,
        "ai_context": {
            "itens": [
                {
                    "item": i["item"],
                    "dias": {
                        d["dia"]: {
                            "produzida": d["media_produzida"],
                            "consumida": d["media_consumida"],
                            "esgotou_pct": d["esgotou_pct"],
                            "sugerida": d["producao_sugerida"],
                        }
                        for d in i["dias"]
                    },
                }
                for i in itens
            ]
        },
    }
