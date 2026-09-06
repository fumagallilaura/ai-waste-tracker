"""Unit conversion for recipe ingredients.

Unidades conhecidas (kg/g/L/ml/unidade) têm conversão para base. Qualquer outra
string (ex.: "xícara", "colher") é aceita como medida personalizada: a própria
unidade vira a base e as quantidades são tratadas sem conversão.
"""

from __future__ import annotations

UNIT_CONVERSIONS: dict[str, dict[str, float | str]] = {
    "kg": {"base": "g", "factor": 1000},
    "g": {"base": "g", "factor": 1},
    "L": {"base": "ml", "factor": 1000},
    "ml": {"base": "ml", "factor": 1},
    "unidade": {"base": "unidade", "factor": 1},
}

_CANONICAL_BY_LOWER: dict[str, str] = {k.lower(): k for k in UNIT_CONVERSIONS}


def normalize_unit(unidade: str) -> str:
    """Normaliza o texto de uma unidade.

    Unidades conhecidas voltam na grafia canônica ("L", "kg"...). Qualquer outra
    vira medida personalizada em minúsculas (ex.: "xícara", "colher de sopa").
    """
    cleaned = unidade.strip().lower()[:20]
    if not cleaned:
        raise ValueError("Unidade não pode ser vazia")
    return _CANONICAL_BY_LOWER.get(cleaned, cleaned)


def to_base_unit(quantidade: float, unidade: str) -> tuple[float, str]:
    """Convert a quantity to its base unit.

    Unidades conhecidas convertem (kg→g, L→ml). Medidas personalizadas
    (ex.: "xícara") voltam como estão — a quantidade é usada sem conversão.
    """
    unit = normalize_unit(unidade)
    conversion = UNIT_CONVERSIONS.get(unit)
    if conversion is None:
        return float(quantidade), unit
    # Numeric columns come back as Decimal; coerce so any numeric type works.
    base_qtd = float(quantidade) * float(conversion["factor"])
    return base_qtd, str(conversion["base"])


def from_base_unit(base_qtd: float, base_unit: str, target_unit: str) -> float:
    """Convert from base unit to a target unit."""
    target = UNIT_CONVERSIONS.get(normalize_unit(target_unit))
    if target is None or str(target["base"]) != base_unit:
        raise ValueError(f"Incompatible units: {base_unit} -> {target_unit}")
    return base_qtd / float(target["factor"])


def get_display_unit(base_qtd: float, base_unit: str) -> tuple[float, str]:
    """Get the most human-readable unit for a quantity.

    E.g., 1500g -> 1.5kg, 500ml -> 500ml. Medidas personalizadas ficam como estão.
    """
    if base_unit == "g" and base_qtd >= 1000:
        return base_qtd / 1000, "kg"
    if base_unit == "ml" and base_qtd >= 1000:
        return base_qtd / 1000, "L"
    return base_qtd, base_unit


# Unidade de compra usada para precificação: sólidos por kg, líquidos por L,
# itens contados por unidade. Medidas personalizadas são precificadas por si mesmas.
PURCHASE_UNIT_BY_BASE: dict[str, str] = {
    "g": "kg",
    "ml": "L",
    "unidade": "unidade",
}


def ingredient_cost(
    base_qtd: float, base_unit: str, preco_por_compra: float
) -> float:
    """Cost of a base quantity given the price per purchase unit (kg/L/unidade).

    E.g., 2500 g at R$ 12.00/kg -> 2.5 * 12.00 = 30.00. Medidas personalizadas
    (ex.: "xícara") usam o preço informado por xícara diretamente.
    """
    purchase_unit = PURCHASE_UNIT_BY_BASE.get(base_unit, base_unit)
    if purchase_unit in ("unidade", base_unit):
        return base_qtd * preco_por_compra
    return (base_qtd / 1000) * preco_por_compra
