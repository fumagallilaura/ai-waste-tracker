"""Tests for unit conversion."""

import pytest

from app.core.units import from_base_unit, get_display_unit, ingredient_cost, to_base_unit


class TestToBaseUnit:
    def test_kg_to_g(self):
        qtd, unit = to_base_unit(1.5, "kg")
        assert qtd == 1500
        assert unit == "g"

    def test_g_to_g(self):
        qtd, unit = to_base_unit(500, "g")
        assert qtd == 500
        assert unit == "g"

    def test_l_to_ml(self):
        qtd, unit = to_base_unit(0.5, "L")
        assert qtd == 500
        assert unit == "ml"

    def test_ml_to_ml(self):
        qtd, unit = to_base_unit(250, "ml")
        assert qtd == 250
        assert unit == "ml"

    def test_unidade(self):
        qtd, unit = to_base_unit(3, "unidade")
        assert qtd == 3
        assert unit == "unidade"

    def test_invalid_unit(self):
        with pytest.raises(ValueError, match="Unidade não suportada"):
            to_base_unit(1, "xícara")


class TestFromBaseUnit:
    def test_g_to_kg(self):
        result = from_base_unit(1500, "g", "kg")
        assert result == 1.5

    def test_ml_to_l(self):
        result = from_base_unit(500, "ml", "L")
        assert result == 0.5

    def test_incompatible_units(self):
        with pytest.raises(ValueError, match="Incompatible units"):
            from_base_unit(1000, "g", "L")


class TestGetDisplayUnit:
    def test_g_to_kg(self):
        qtd, unit = get_display_unit(1500, "g")
        assert qtd == 1.5
        assert unit == "kg"

    def test_g_stays_g(self):
        qtd, unit = get_display_unit(500, "g")
        assert qtd == 500
        assert unit == "g"

    def test_ml_to_l(self):
        qtd, unit = get_display_unit(1500, "ml")
        assert qtd == 1.5
        assert unit == "L"

    def test_ml_stays_ml(self):
        qtd, unit = get_display_unit(250, "ml")
        assert qtd == 250
        assert unit == "ml"

    def test_unidade_unchanged(self):
        qtd, unit = get_display_unit(5, "unidade")
        assert qtd == 5
        assert unit == "unidade"


class TestIngredientCost:
    def test_price_per_kg(self):
        # 2.5 kg a R$ 12/kg
        assert ingredient_cost(2500, "g", 12) == 30.0

    def test_price_per_l(self):
        # 900 ml a R$ 6/L
        assert ingredient_cost(900, "ml", 6) == pytest.approx(5.4)

    def test_price_per_unidade(self):
        assert ingredient_cost(10, "unidade", 3.5) == 35.0

    def test_zero_price(self):
        assert ingredient_cost(5000, "g", 0) == 0
