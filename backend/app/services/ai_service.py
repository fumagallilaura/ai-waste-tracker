"""Geração de receitas via LLM (qualquer API OpenAI-compatible).

Configuração por env: APP_AI_API_KEY, APP_AI_BASE_URL (padrão OpenAI),
APP_AI_MODEL. A resposta vem em JSON estruturado e é revisada pelo usuário
antes de salvar — a IA nunca grava direto.
"""

from __future__ import annotations

import json
import re

import httpx
from fastapi import HTTPException, status

from app.config import get_settings

ALLOWED_UNITS = frozenset({"kg", "g", "L", "ml", "unidade"})


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


async def _chat_json(messages: list[dict], *, temperature: float = 0.2) -> dict:
    """POST /chat/completions e devolve o objeto JSON parseado do content."""
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
                    "messages": messages,
                    "temperature": temperature,
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
        return json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="A IA devolveu uma resposta inesperada. Tente novamente.",
        ) from None


def _normalize_unit(raw: str) -> str:
    text = str(raw).strip()
    if text in ALLOWED_UNITS:
        return text
    lower = text.lower()
    aliases = {
        "un": "unidade", "und": "unidade", "unidades": "unidade",
        "l": "L", "grama": "g", "gramas": "g", "quilo": "kg", "quilos": "kg",
        "litro": "L", "litros": "L",
        "xicara": "unidade", "xícara": "unidade", "xicaras": "unidade", "xícaras": "unidade",
        "colher": "unidade", "colheres": "unidade",
    }
    return aliases.get(lower, "unidade")


def _normalize_price(raw) -> float | None:
    """Parse money from LLM/speech into a float (BRL).

    Accepts 5, "5,50", "R$ 5.90", "5 reais", "5 reais e 50", etc.
    """
    if raw is None or raw == "":
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        value = float(raw)
        return round(value, 2) if value >= 0 else None

    text = str(raw).strip().lower()
    if not text or text in {"null", "none", "n/a", "-"}:
        return None

    # "5 reais e 50" / "5 real e 50 centavos" → 5.50
    reais_centavos = re.search(
        r"(\d+)\s*reais?\s*e\s*(\d{1,2})(?:\s*centavos?)?\b",
        text,
    )
    if reais_centavos:
        whole = int(reais_centavos.group(1))
        cents = int(reais_centavos.group(2))
        if cents < 10 and len(reais_centavos.group(2)) == 1:
            cents *= 10
        return round(whole + cents / 100, 2)

    # strip currency words/symbols then find a number
    cleaned = re.sub(r"r\$|reais?|real|centavos?", " ", text)
    cleaned = cleaned.strip()

    # Brazilian thousands: 1.234,56
    br = re.search(r"(\d{1,3}(?:\.\d{3})+,\d{1,2})", cleaned)
    if br:
        num = br.group(1).replace(".", "").replace(",", ".")
        try:
            value = float(num)
            return round(value, 2) if value >= 0 else None
        except ValueError:
            return None

    # "5,50" or "5.50" or "5"
    plain = re.search(r"(\d+[.,]\d{1,2}|\d+)", cleaned)
    if not plain:
        return None
    num = plain.group(1).replace(",", ".")
    try:
        value = float(num)
    except ValueError:
        return None
    return round(value, 2) if value >= 0 else None


_PRICE_PHRASE = re.compile(
    r"(?:"
    r"(?:a|por|custa|custou|saiu|sai)\s*(?:r\$\s*)?(\d+[.,]?\d*)\s*(?:reais?\s*e\s*\d{1,2}|reais?|real)?"
    r"|r\$\s*(\d+[.,]?\d*)"
    r"|(\d+)\s*reais?\s*e\s*(\d{1,2})"
    r"|(\d+[.,]\d{1,2}|\d+)\s*reais?"
    r")",
    re.IGNORECASE,
)


def _extract_price_from_text(text: str) -> float | None:
    """Pull a price out of a messy ingredient/transcript fragment."""
    if not text:
        return None
    # Prefer "X reais e Y" first
    m = re.search(r"(\d+)\s*reais?\s*e\s*(\d{1,2})", text, re.IGNORECASE)
    if m:
        return _normalize_price(f"{m.group(1)} reais e {m.group(2)}")
    m = _PRICE_PHRASE.search(text)
    if not m:
        return None
    for g in m.groups():
        if g is not None:
            return _normalize_price(g)
    return None


def _transcript_prompt(transcript: str) -> list[dict]:
    system = (
        "Você é um assistente especializado em dados de receitas culinárias. "
        "Analise a transcrição de voz e extraia ingredientes em JSON estrito.\n\n"
        "REGRAS:\n"
        "1. Separe cada ingrediente mencionado.\n"
        "2. Campos por item:\n"
        '   - "ingrediente": SOMENTE o nome do alimento, limpo e curto '
        '(ex: "ovo", "farinha de trigo", "leite"). '
        "NUNCA inclua quantidade, unidade, preço, 'reais', 'R$', "
        "'a X reais', 'o quilo', 'cada' ou qualquer trecho de preço no nome.\n"
        '   - "quantidade": número da medida do ingrediente '
        '(ex: "um"=1, "meio"=0.5, "quinhentos"=500). '
        "NUNCA use o preço como quantidade.\n"
        '   - "unidade": apenas "g"|"kg"|"L"|"ml"|"unidade". '
        'Sem unidade explícita (ex: "10 tomates") use "unidade". '
        'xícara/colher → "unidade" mantendo a quantidade falada; '
        'gramas→g, quilos→kg, litros→L.\n'
        '   - "preco_unitario": número decimal com PONTO (ex: 5.5, não "5,50"). '
        "É o preço por kg/L/unidade em reais. "
        "null se não for dito. "
        "'a 5 reais' → 5; '5 reais e 50' → 5.5; 'R$ 3,90 o quilo' → 3.9. "
        "Frases de preço NUNCA vão no campo ingrediente nem em quantidade.\n"
        "3. Resposta ÚNICA: objeto JSON, sem texto fora do JSON.\n\n"
        "FORMATO:\n"
        '{"ingredients":[{"ingrediente":"string","quantidade":1,'
        '"unidade":"kg|g|L|ml|unidade","preco_unitario":null}]}\n\n'
        "EXEMPLO:\n"
        'Entrada: "2 ovos a 1 real cada, 1 kg de farinha a 5 reais e 50, '
        '500 mililitros de leite a 4 reais o litro"\n'
        "Saída:\n"
        '{"ingredients":['
        '{"ingrediente":"ovo","quantidade":2,"unidade":"unidade","preco_unitario":1},'
        '{"ingrediente":"farinha","quantidade":1,"unidade":"kg","preco_unitario":5.5},'
        '{"ingrediente":"leite","quantidade":500,"unidade":"ml","preco_unitario":4}'
        "]}"
    )
    user = f'### TRANSCRIÇÃO:\n"""\n{transcript}\n"""'
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


_PRICE_IN_NAME = re.compile(
    r"\s+(?:"
    r"é\s*r\$?|"
    r"a\s+r\$|"
    r"r\$|"
    r"a\s+\d+[.,]?\d*\s*(?:reais?\s*e\s*\d{1,2}|reais?|real)?|"
    r"por\s+\d+[.,]?\d*\s*(?:reais?|real)?|"
    r"custou\s+\d+[.,]?\d*|"
    r"\d+[.,]?\d*\s*reais?(?:\s+e\s+\d{1,2})?|"
    r"(?:o\s+)?(?:quilo|litro)|cada|a\s+unidade"
    r").*$",
    re.IGNORECASE,
)


def _clean_ingredient_name(name: str) -> str:
    cleaned = _PRICE_IN_NAME.sub("", name).strip(" ,.-")
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned or name.strip()


async def generate_recipe(
    prato: str, porcoes: int, observacoes: str | None
) -> dict:
    """Chama o LLM e devolve a receita estruturada para revisão do usuário."""
    recipe = await _chat_json(_prompt(prato, porcoes, observacoes), temperature=0.4)

    ingredients = []
    for ing in recipe.get("ingredients", [])[:50]:
        try:
            unidade = _normalize_unit(ing["unidade"])
            ingredients.append({
                "ingrediente": str(ing["ingrediente"])[:255],
                "quantidade": round(float(ing["quantidade"]), 3),
                "unidade": unidade,
                "original": f'{ing["ingrediente"]}: {ing["quantidade"]} {unidade}',
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


_PHANTOM_NAMES = frozenset({
    "cada", "quilo", "o quilo", "litro", "o litro", "reais", "real", "r$", "o", "a", "e",
})
_MONEY_IN_TRANSCRIPT = re.compile(
    r"\b(?:reais?|real)\b|r\$|\ba\s+\d+[.,]?\d*\s+o\s+(?:quilo|litro)\b",
    re.IGNORECASE,
)
_NAME_HAS_MONEY_JUNK = re.compile(r"r\$|é\s*r\$|a\s+r\$", re.IGNORECASE)


def _local_parse(text: str) -> dict:
    from app.services.recipe_import_service import (
        parse_ingredients_from_transcript as parse_local,
    )
    return parse_local(text)


def _priced_count(ingredients: list[dict]) -> int:
    return sum(1 for i in ingredients if i.get("preco_unitario") not in (None, ""))


def _looks_like_price_split_bug(ingredients: list[dict], transcript: str) -> bool:
    """Detect money amounts becoming fake ingredient rows (incl. STT 'a 5 o quilo')."""
    if not ingredients:
        return True
    names = [str(i.get("ingrediente", "")).strip().lower() for i in ingredients]
    if any(n in _PHANTOM_NAMES for n in names):
        return True
    if any(_NAME_HAS_MONEY_JUNK.search(n) for n in names):
        return True
    has_money_speech = bool(_MONEY_IN_TRANSCRIPT.search(transcript))
    if has_money_speech and _priced_count(ingredients) == 0:
        return True
    return False


async def parse_ingredients_from_transcript(transcript: str) -> dict:
    """Extrai ingredientes da fala: parser local price-aware; LLM só se melhorar."""
    settings = get_settings()
    text = transcript.strip()
    if not text:
        return {"ingredients": []}

    local = _local_parse(text)
    local_ok = (
        bool(local["ingredients"])
        and _priced_count(local["ingredients"]) > 0
        and not _looks_like_price_split_bug(local["ingredients"], text)
    )

    # Prefer solid local parse (handles Brazilian voice prices without LLM lag/drift).
    if local_ok:
        return local

    if not settings.ai_api_key:
        return local

    try:
        payload = await _chat_json(_transcript_prompt(text), temperature=0.1)
    except HTTPException:
        if local["ingredients"]:
            return local
        raise

    ingredients = []
    for ing in payload.get("ingredients", [])[:50]:
        try:
            raw_name = str(ing.get("ingrediente") or ing.get("nome") or "")
            price = _normalize_price(ing.get("preco_unitario", ing.get("preco")))
            if price is None:
                price = _extract_price_from_text(raw_name)
            nome = _clean_ingredient_name(raw_name)[:255]
            if not nome or nome.lower() in _PHANTOM_NAMES:
                continue
            quantidade = round(float(ing["quantidade"]), 3)
            if quantidade <= 0:
                continue
            unidade = _normalize_unit(ing.get("unidade", "unidade"))
            ingredients.append({
                "ingrediente": nome,
                "quantidade": quantidade,
                "unidade": unidade,
                "preco_unitario": price,
            })
        except (KeyError, TypeError, ValueError):
            continue

    if not ingredients:
        if local["ingredients"]:
            return local
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="A IA não retornou ingredientes válidos. Tente novamente.",
        )

    if any(i["preco_unitario"] is None for i in ingredients):
        for item in ingredients:
            if item["preco_unitario"] is not None:
                continue
            pattern = re.compile(
                re.escape(item["ingrediente"]) + r".{0,60}",
                re.IGNORECASE | re.DOTALL,
            )
            m = pattern.search(text)
            if m:
                recovered = _extract_price_from_text(m.group(0))
                if recovered is not None:
                    item["preco_unitario"] = recovered

    if _looks_like_price_split_bug(ingredients, text) and local["ingredients"]:
        return local

    # If local found more prices, trust local
    if _priced_count(local["ingredients"]) > _priced_count(ingredients):
        return local

    return {"ingredients": ingredients}
