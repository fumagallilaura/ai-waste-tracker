"""Import recipes from public web pages.

Parses schema.org `Recipe` structured data (JSON-LD), which is published by
most recipe sites (receita.globo, tudoreceita, panelinha, etc.). Falls back
to a clear error when no structured recipe is found — the user reviews and
completes prices in the form before saving.
"""

from __future__ import annotations

import ipaddress
import json
import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

USER_AGENT = "DesperdicioZeroBot/0.1 (+https://desperdiciozero.com.br)"
FETCH_TIMEOUT_SECONDS = 10.0
MAX_HTML_BYTES = 2_000_000

# Fractions commonly found in recipes
_FRACTIONS = {
    "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
    "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8, "⅙": 1 / 6, "⅚": 5 / 6,
    "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
}

# Units accepted as-is (map to canonical supported units)
_DIRECT_UNITS = {
    "g": "g", "kg": "kg", "ml": "ml", "l": "L", "un": "unidade",
    "unidade": "unidade", "unidades": "unidade",
}

# Household units → (factor_to_base, base_unit) heuristic (pt-BR)
_HOUSEHOLD_UNITS: list[tuple[re.Pattern[str], float, str]] = [
    (re.compile(r"colher(es)?\s+(de\s+)?sopa|colherada(s)?"), 15, "g"),
    (re.compile(r"colher(es)?\s+(de\s+)?sobremesa"), 10, "g"),
    (re.compile(r"colher(es)?\s+(de\s+)?ch[aá]"), 5, "g"),
    (re.compile(r"x[ií]cara(s)?(\s+de\s+ch[aá])?|x[ií]cs?(\.)?"), 240, "ml"),
    (re.compile(r"copo(s)?"), 200, "ml"),
    (re.compile(r"lata(s)?"), 1, "unidade"),
    (re.compile(r"dente[s]?\b"), 1, "unidade"),
    (re.compile(r"fatia[s]?\b"), 1, "unidade"),
    (re.compile(r"ramete[s]?\b"), 1, "unidade"),
    (re.compile(r"pitada(s)?"), 1, "g"),
    (re.compile(r"fil[eé]\s+\w+"), 1, "unidade"),
]

_QTY_PATTERN = re.compile(
    r"^\s*((?:\s*(?:\d+\s*[/−-]\s*\d+|\d+[.,]?\d*|"
    + "|".join(_FRACTIONS) + r")){1,2})"
)

_UNwanted_PREFIX = re.compile(r"^(de|do|da|d')\s+", re.IGNORECASE)


class RecipeImportError(Exception):
    """Raised when a page cannot be imported."""


def _to_float(token: str) -> float:
    """Parse a quantity token like '1 1/2', '½', '500', '1,5'."""
    token = token.strip()
    parts = token.split()
    total = 0.0
    matched = False
    for part in parts:
        if part in _FRACTIONS:
            total += _FRACTIONS[part]
            matched = True
            continue
        frac = re.match(r"^(\d+)\s*[/−-]\s*(\d+)$", part)
        if frac:
            total += int(frac.group(1)) / int(frac.group(2))
            matched = True
            continue
        num = re.match(r"^\d+[.,]?\d*$", part)
        if num:
            total += float(part.replace(",", "."))
            matched = True
    if not matched:
        raise ValueError(f"Not a quantity: {token!r}")
    return total


def parse_ingredient(text: str) -> tuple[float, str, str]:
    """Parse an ingredient string into (quantity, unit, ingredient).

    Examples:
        "500 g de farinha"        → (500, "g", "farinha")
        "1 ½ xícara de arroz"     → (360, "ml", "arroz")
        "2 ovos"                  → (2, "unidade", "ovos")
        "sal a gosto"             → (1, "unidade", "sal a gosto")
    """
    raw = " ".join(text.strip().split())
    match = _QTY_PATTERN.match(raw)
    if not match:
        return 1, "unidade", raw

    quantity = _to_float(match.group(1))
    rest = raw[match.end():].strip()

    if not rest:
        return quantity, "unidade", raw

    lower = rest.lower()

    for pattern, factor, base in _HOUSEHOLD_UNITS:
        m = pattern.match(lower)
        if m and (m.end() == len(lower) or not lower[m.end()].isalpha()):
            unit_text = rest[m.start():m.end()]
            ingredient = rest[m.end():].strip()
            ingredient = _UNwanted_PREFIX.sub("", ingredient)
            if not ingredient:
                ingredient = unit_text
            return round(quantity * factor, 3), base, ingredient

    tokens = rest.split(None, 1)
    head = tokens[0].rstrip(".").lower()
    if head in _DIRECT_UNITS:
        ingredient = tokens[1].strip() if len(tokens) > 1 else ""
        ingredient = _UNwanted_PREFIX.sub("", ingredient)
        return quantity, _DIRECT_UNITS[head], ingredient or raw

    # Unrecognized unit word (e.g. "queijo mussarela"): quantity in units
    return quantity, "unidade", rest


def _iter_dicts(node):
    """Depth-first walk over dicts inside parsed JSON-LD."""
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from _iter_dicts(value)
    elif isinstance(node, list):
        for item in node:
            yield from _iter_dicts(item)


def _find_recipe_object(data) -> dict | None:
    for node in _iter_dicts(data):
        type_ = node.get("@type")
        types = type_ if isinstance(type_, list) else [type_]
        if any(isinstance(t, str) and t.lower() in ("recipe", "receita") for t in types):
            return node
    return None


def _as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        return [part.strip() for part in re.split(r"\n|;", value) if part.strip()]
    return [value]


def _extract_yield(recipe: dict) -> int:
    """Best-effort portion count from recipeYield (e.g. '4 porções', '2')."""
    raw = recipe.get("recipeYield")
    text = " ".join(str(x) for x in _as_list(raw))
    match = re.search(r"(\d+)", text.replace(",", ""))
    return int(match.group(1)) if match else 1


def parse_recipe_html(html: str) -> dict:
    """Extract a structured recipe from HTML. Raises RecipeImportError."""
    soup = BeautifulSoup(html, "html.parser")
    recipe: dict | None = None

    for script in soup.find_all("script", type="application/ld+json"):
        if script.string is None:
            continue
        try:
            data = json.loads(script.string)
        except (json.JSONDecodeError, ValueError):
            continue
        recipe = _find_recipe_object(data)
        if recipe:
            break

    if not recipe or not recipe.get("name"):
        raise RecipeImportError(
            "Não encontramos uma receita estruturada nessa página. "
            "Cole os ingredientes manualmente."
        )

    ingredients = []
    for item in _as_list(recipe.get("recipeIngredient")):
        qtd, unit, name = parse_ingredient(str(item))
        if name:
            ingredients.append(
                {
                    "ingrediente": name,
                    "quantidade": qtd,
                    "unidade": unit,
                    "original": str(item).strip(),
                }
            )

    tipo = None
    keywords = recipe.get("keywords") or recipe.get("recipeCategory")
    if keywords:
        first = str(_as_list(keywords)[0]).lower()
        known = ("sobremesa", "principal", "entrada", "acompanhamento", "bebida")
        tipo = next((k for k in known if k in first), None)

    name = " ".join(str(recipe["name"]).split())
    return {
        "nome": name[:255],
        "rendimento_base": _extract_yield(recipe),
        "tipo": tipo,
        "ingredients": ingredients,
        "source_name": name[:255],
    }


async def _fetch_html(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise RecipeImportError("URL inválida. Use um link http(s) de uma receita.")

    _block_internal_host(parsed.hostname)

    async with httpx.AsyncClient(
        follow_redirects=True, timeout=FETCH_TIMEOUT_SECONDS
    ) as client:
        try:
            response = await client.get(url, headers={"User-Agent": USER_AGENT})
            response.raise_for_status()
        except httpx.HTTPError as e:
            raise RecipeImportError(
                f"Não foi possível acessar a página ({type(e).__name__})."
            ) from None
    return response.text[:MAX_HTML_BYTES]


def _block_internal_host(hostname: str) -> None:
    """Block obvious SSRF targets (localhost/private IP literals)."""
    lowered = hostname.lower().rstrip(".")
    if lowered == "localhost" or lowered.endswith((".local", ".internal", ".localhost")):
        raise RecipeImportError("Não é possível importar URLs internas.")
    try:
        ip = ipaddress.ip_address(lowered)
    except ValueError:
        return
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
        raise RecipeImportError("Não é possível importar URLs internas.")


async def import_recipe_from_url(url: str) -> dict:
    html = await _fetch_html(url)
    recipe = parse_recipe_html(html)
    recipe["source_url"] = url
    return recipe
