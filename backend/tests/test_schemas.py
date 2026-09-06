"""Unit tests for Pydantic request/response schemas."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas import (
    ClientCreate,
    LoginRequest,
    ProductionCreate,
    ProductionRecipeItem,
    RecipeCreate,
    RecipeIngredientCreate,
    RegisterRequest,
    StockAdjustRequest,
    WasteRecordCreate,
)


class TestAuthSchemas:
    def test_register_requires_min_password(self):
        with pytest.raises(ValidationError):
            RegisterRequest(email="a@b.com", password="short")
        RegisterRequest(email="a@b.com", password="longenough1")

    def test_register_requires_valid_email(self):
        with pytest.raises(ValidationError):
            RegisterRequest(email="not-an-email", password="longenough1")

    def test_login_accepts_any_password_length(self):
        LoginRequest(email="a@b.com", password="x")


class TestRecipeSchemas:
    def test_ingredient_requires_positive_quantity(self):
        with pytest.raises(ValidationError):
            RecipeIngredientCreate(ingrediente="farinha", quantidade=0, unidade="g")
        RecipeIngredientCreate(ingrediente="farinha", quantidade=500, unidade="g")

    def test_ingredient_rejects_negative_price(self):
        with pytest.raises(ValidationError):
            RecipeIngredientCreate(
                ingrediente="farinha", quantidade=500, unidade="g", preco_unitario=-1
            )

    def test_recipe_requires_rendimento(self):
        with pytest.raises(ValidationError):
            RecipeCreate(
                nome="Panacota",
                rendimento_base=0,
                ingredients=[
                    RecipeIngredientCreate(ingrediente="leite", quantidade=1, unidade="L")
                ],
            )

    def test_valid_recipe(self):
        recipe = RecipeCreate(
            nome="Panacota",
            rendimento_base=10,
            tipo="sobremesa",
            ingredients=[
                RecipeIngredientCreate(
                    ingrediente="cream cheese", quantidade=500, unidade="g", preco_unitario=15.9
                )
            ],
        )
        assert recipe.tipo == "sobremesa"
        assert len(recipe.ingredients) == 1


class TestProductionSchemas:
    def test_production_requires_items_or_not(self):
        p = ProductionCreate(nome="Casamento", tipo="casamento", data="2026-10-10")
        assert p.recipes == []

    def test_production_rejects_zero_guests(self):
        with pytest.raises(ValidationError):
            ProductionCreate(nome="X", tipo="casamento", data="2026-10-10", convidados=0)

    def test_recipe_item_requires_positive_scale(self):
        with pytest.raises(ValidationError):
            ProductionRecipeItem(escala_fator=0)

    def test_avulso_item_fields(self):
        item = ProductionRecipeItem(
            escala_fator=50, item_nome="panacota", item_quantidade_base=50, item_unidade="g"
        )
        assert item.recipe_id is None


class TestWasteSchemas:
    def test_valid_balance(self):
        w = WasteRecordCreate(
            item="arroz",
            quantidade_produzida=5,
            quantidade_consumida=3,
            quantidade_descartada=1.5,
            quantidade_devolvida=0.5,
            unidade="kg",
            custo_desperdicio=12.5,
        )
        assert w.custo_desperdicio == 12.5

    def test_rejects_negative_quantity(self):
        with pytest.raises(ValidationError):
            WasteRecordCreate(item="arroz", quantidade_consumida=-1, unidade="kg")

    def test_accepts_custom_unit(self):
        w = WasteRecordCreate(item="arroz", quantidade_consumida=1, unidade=" Xícara ")
        assert w.unidade == "xícara"


class TestClientSchemas:
    def test_default_fator_producao(self):
        c = ClientCreate(nome="Buffet Sol")
        assert c.fator_producao == 0.7
        assert c.tipo == "cliente"

    def test_rejects_invalid_tipo(self):
        with pytest.raises(ValidationError):
            ClientCreate(nome="X", tipo="fornecedor")

    def test_rejects_fator_out_of_range(self):
        with pytest.raises(ValidationError):
            ClientCreate(nome="X", fator_producao=1.5)


class TestStockSchemas:
    def test_delta_can_be_negative(self):
        s = StockAdjustRequest(ingrediente="arroz", unidade="kg", quantidade_delta=-2)
        assert s.quantidade_delta == -2

    def test_accepts_custom_unit(self):
        s = StockAdjustRequest(ingrediente="arroz", unidade="Saca", quantidade_delta=1)
        assert s.unidade == "saca"

    def test_set_requires_non_negative(self):
        from app.schemas import StockSetRequest

        with pytest.raises(ValidationError):
            StockSetRequest(unidade="kg", quantidade=-1)
