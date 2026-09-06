"""Geração de receitas via LLM (qualquer API OpenAI-compatible).

Configuração por env: APP_AI_API_KEY, APP_AI_BASE_URL (padrão OpenAI),
APP_AI_MODEL. A resposta vem em JSON estruturado e é revisada pelo usuário
antes de salvar — a IA nunca grava direto.
"""

from __future__ import annotations

import json

import httpx
from fastapi import HTTPException, status

from app.config import get_settings


def _prompt(prato: str, porcoes: int, observacoes: str | None) -> list[dict]:
    system = (
        "Você é um chef brasileiro que cria receitas com medidas precisas. "
        "Responda SEMPRE apenas com JSON válido, sem texto fora do JSON, no formato: "
        '{"nome": str, "rendimento_base": int, '
        '"tipo": "entrada|principal|sobremesa|bebida|acompanhamento", '
        '"ingredients": [{"ingrediente": str, "quantidade": number, '
        '"unidade": "kg|g|L|ml|unidade"}]}. '
        "As quantidades já devem estar na unidade indicada, proporcionais ao rendimento informado. "
        "Use unidades simples da lista; para itens como ovos use unidade."
    )
    user = f"Crie a receita de {prato!r} que renda {porcoes} porções."
    if observacoes:
        user += f" Observações: {observacoes}"
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


async def generate_recipe(
    prato: str, porcoes: int, observacoes: str | None
) -> dict:
    """Chama o LLM e devolve a receita estruturada para revisão do usuário."""
    settings = get_settings()
    if not settings.ai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Geração com IA não configurada: defina APP_AI_API_KEY (e opcionalmente "
                "APP_AI_BASE_URL / APP_AI_MODEL) no .env."
            ),
        )

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{settings.ai_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.ai_api_key}"},
                json={
                    "model": settings.ai_model,
                    "messages": _prompt(prato, porcoes, observacoes),
                    "temperature": 0.4,
                    "response_format": {"type": "json_object"},
                },
            )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não consegui falar com o serviço de IA. Tente novamente.",
        ) from None

    if response.status_code == 401:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chave de IA inválida (APP_AI_API_KEY).",
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="O serviço de IA respondeu com erro. Tente novamente.",
        )

    try:
        content = response.json()["choices"][0]["message"]["content"]
        recipe = json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="A IA devolveu uma resposta inesperada. Tente novamente.",
        ) from None

    # normalização defensiva: a IA pode alucinar campos
    ingredients = []
    for ing in recipe.get("ingredients", [])[:50]:
        try:
            ingredients.append({
                "ingrediente": str(ing["ingrediente"])[:255],
                "quantidade": round(float(ing["quantidade"]), 3),
                "unidade": str(ing["unidade"])[:20],
                "original": f'{ing["ingrediente"]}: {ing["quantidade"]} {ing["unidade"]}',
            })
        except (KeyError, TypeError, ValueError):
            continue
    if not ingredients:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="A IA não retornou ingredientes válidos. Tente novamente.",
        )

    return {
        "nome": str(recipe.get("nome", prato))[:255],
        "rendimento_base": max(1, int(recipe.get("rendimento_base", porcoes))),
        "tipo": recipe.get("tipo") if recipe.get("tipo") in
        ("entrada", "principal", "sobremesa", "bebida", "acompanhamento") else None,
        "ingredients": ingredients,
    }
