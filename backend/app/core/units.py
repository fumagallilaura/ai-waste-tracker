"""Unit conversion for recipe ingredients."""

from __future__ import annotations

UNIT_CONVERSIONS: dict[str, dict[str, float | str]] = {
    "kg": {"base": "g", "factor": 1000},
    "g": {"base": "g", "factor": 1},
    "L": {"base": "ml", "factor": 1000},
    "ml": {"base": "ml", "factor": 1},
    "unidade": {"base": "unidade", "factor": 1},
}


def to_base_unit(quantidade: float, unidade: str) -> tuple[float, str]:
    """Convert a quantity to its base unit.

    Returns (base_quantity, base_unit).
    """
    if unidade not in UNIT_CONVERSIONS:
        raise ValueError(f"Unidade não suportada: {unidade}. Use: {list(UNIT_CONVERSIONS.keys())}")

    conversion = UNIT_CONVERSIONS[unidade]
    # Numeric columns come back as Decimal; coerce so any numeric type works.
    base_qtd = float(quantidade) * float(conversion["factor"])
    base_unit = str(conversion["base"])
    return base_qtd, base_unit


def from_base_unit(base_qtd: float, base_unit: str, target_unit: str) -> float:
    """Convert from base unit to a target unit."""
    if target_unit not in UNIT_CONVERSIONS:
        raise ValueError(f"Unidade não suportada: {target_unit}")

    target = UNIT_CONVERSIONS[target_unit]
    if str(target["base"]) != base_unit:
        raise ValueError(f"Incompatible units: {base_unit} -> {target_unit}")

    return base_qtd / float(target["factor"])


def get_display_unit(base_qtd: float, base_unit: str) -> tuple[float, str]:
    """Get the most human-readable unit for a quantity.

    E.g., 1500g -> 1.5kg, 500ml -> 500ml.
    """
    if base_unit == "g" and base_qtd >= 1000:
        return base_qtd / 1000, "kg"
    if base_unit == "ml" and base_qtd >= 1000:
        return base_qtd / 1000, "L"
    return base_qtd, base_unit


# Unidade de compra usada para precificação: sólidos por kg, líquidos por L,
# itens contados por unidade.
PURCHASE_UNIT_BY_BASE: dict[str, str] = {
    "g": "kg",
    "ml": "L",
    "unidade": "unidade",
}


def ingredient_cost(
    base_qtd: float, base_unit: str, preco_por_compra: float
) -> float:
    """Cost of a base quantity given the price per purchase unit (kg/L/unidade).

    E.g., 2500 g at R$ 12.00/kg -> 2.5 * 12.00 = 30.00.
    """
    purchase_unit = PURCHASE_UNIT_BY_BASE[base_unit]
    if purchase_unit == "unidade":
        return base_qtd * preco_por_compra
    return (base_qtd / 1000) * preco_por_compra
