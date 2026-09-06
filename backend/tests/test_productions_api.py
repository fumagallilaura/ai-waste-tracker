"""API tests for productions, shopping list generation and waste records."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from tests.conftest import register_user

TODAY = date.today()


async def create_recipe(client, headers, nome, rendimento, ingredients):
    response = await client.post(
        "/api/recipes/",
        headers=headers,
        json={"nome": nome, "rendimento_base": rendimento, "ingredients": ingredients},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def create_production(client, headers, **payload):
    payload.setdefault("tipo", "casamento")
    payload.setdefault("data", TODAY.isoformat())
    response = await client.post("/api/productions/", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


class TestProductionCRUD:
    async def test_create_and_list(self, client):
        auth = await register_user(client, "p1@b.com")
        created = await create_production(client, auth["headers"], nome="Casamento A")
        assert created["status"] == "planejado"

        resp = await client.get("/api/productions/", headers=auth["headers"])
        assert resp.status_code == 200
        assert [p["nome"] for p in resp.json()] == ["Casamento A"]

    async def test_user_isolation(self, client):
        a = await register_user(client, "pa@b.com")
        b = await register_user(client, "pb@b.com")
        production = await create_production(client, a["headers"], nome="Privada")

        resp = await client.get(f"/api/productions/{production['id']}", headers=b["headers"])
        assert resp.status_code == 404

    async def test_update_status(self, client):
        auth = await register_user(client, "p2@b.com")
        production = await create_production(client, auth["headers"], nome="Aniversário")
        resp = await client.put(
            f"/api/productions/{production['id']}",
            headers=auth["headers"],
            json={"status": "confirmado"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "confirmado"

    async def test_duplicate(self, client):
        auth = await register_user(client, "p3@b.com")
        production = await create_production(client, auth["headers"], nome="Formatura")
        resp = await client.post(
            f"/api/productions/{production['id']}/duplicate", headers=auth["headers"]
        )
        assert resp.status_code == 201
        assert resp.json()["nome"] == "Formatura (cópia)"


class TestShoppingListFluxoA:
    async def test_scales_recipe_by_guests(self, client):
        """R2/D009: 500g farinha p/ 10 porções, servindo 30 → 1500g."""
        auth = await register_user(client, "s1@b.com")
        recipe = await create_recipe(
            client,
            auth["headers"],
            nome="Panacota",
            rendimento=10,
            ingredients=[
                {
                    "ingrediente": "farinha",
                    "quantidade": 500,
                    "unidade": "g",
                    "preco_unitario": 0.01,
                },
                {
                    "ingrediente": "leite",
                    "quantidade": 0.3,
                    "unidade": "L",
                    "preco_unitario": 0.005,
                },
            ],
        )
        production = await create_production(
            client,
            auth["headers"],
            nome="Jantar 30",
            convidados=30,
            recipes=[{"recipe_id": recipe["id"], "escala_fator": 3.0}],
        )

        resp = await client.get(
            f"/api/productions/{production['id']}/shopping-list", headers=auth["headers"]
        )
        assert resp.status_code == 200
        items = {i["ingrediente"]: i for i in resp.json()}

        assert items["farinha"]["unidade_base"] == "g"
        assert float(items["farinha"]["quantidade_total"]) == 1500
        assert items["leite"]["unidade_base"] == "ml"
        assert float(items["leite"]["quantidade_total"]) == 900

    async def test_aggregates_same_ingredient_across_recipes(self, client):
        auth = await register_user(client, "s2@b.com")
        r1 = await create_recipe(
            client, auth["headers"], "A", 1,
            [{"ingrediente": "alho", "quantidade": 10, "unidade": "g", "preco_unitario": 0}],
        )
        r2 = await create_recipe(
            client, auth["headers"], "B", 1,
            [{"ingrediente": "alho", "quantidade": 20, "unidade": "g", "preco_unitario": 0}],
        )
        production = await create_production(
            client,
            auth["headers"],
            nome="Demo",
            recipes=[
                {"recipe_id": r1["id"], "escala_fator": 1},
                {"recipe_id": r2["id"], "escala_fator": 1},
            ],
        )
        resp = await client.get(
            f"/api/productions/{production['id']}/shopping-list", headers=auth["headers"]
        )
        items = resp.json()
        assert len(items) == 1
        assert float(items[0]["quantidade_total"]) == 30

    async def test_adjusts_requisition_manually(self, client):
        auth = await register_user(client, "s3@b.com")
        recipe = await create_recipe(
            client, auth["headers"], "Arroz", 1,
            [{"ingrediente": "arroz", "quantidade": 80, "unidade": "g", "preco_unitario": 0}],
        )
        production = await create_production(
            client, auth["headers"], nome="Almoço",
            recipes=[{"recipe_id": recipe["id"], "escala_fator": 1}],
        )
        await client.get(
            f"/api/productions/{production['id']}/shopping-list", headers=auth["headers"]
        )
        listing = await client.get(
            f"/api/productions/{production['id']}/shopping-list", headers=auth["headers"]
        )
        item_id = listing.json()[0]["id"]

        resp = await client.put(
            f"/api/productions/{production['id']}/shopping-list/{item_id}",
            headers=auth["headers"],
            json={"quantidade_a_comprar": 0},
        )
        assert resp.status_code == 200
        assert float(resp.json()["quantidade_a_comprar"]) == 0


class TestShoppingListRequisition:
    async def test_requisition_deducts_stock(self, client):
        """Requisição = necessário - estoque (fluxo de requisição do cliente)."""
        auth = await register_user(client, "r1@b.com")
        recipe = await create_recipe(
            client, auth["headers"], "Bolo", 1,
            [{"ingrediente": "farinha", "quantidade": 500, "unidade": "g", "preco_unitario": 12}],
        )
        # entrada de 1.2 kg de farinha no estoque
        resp = await client.post(
            "/api/stock/",
            headers=auth["headers"],
            json={"ingrediente": "farinha", "unidade": "kg", "quantidade_delta": 1.2},
        )
        assert resp.status_code == 201, resp.text

        production = await create_production(
            client,
            auth["headers"],
            nome="Evento 10 bolos",
            recipes=[{"recipe_id": recipe["id"], "escala_fator": 10}],
        )
        resp = await client.get(
            f"/api/productions/{production['id']}/shopping-list", headers=auth["headers"]
        )
        item = resp.json()[0]
        assert float(item["quantidade_total"]) == 5000
        assert float(item["quantidade_estoque"]) == 1200
        assert float(item["quantidade_a_comprar"]) == 3800
        # preço: 3.8 kg × R$ 12/kg
        assert float(item["preco_estimado"]) == pytest.approx(45.6)

    async def test_requisition_never_negative(self, client):
        auth = await register_user(client, "r2@b.com")
        recipe = await create_recipe(
            client, auth["headers"], "Bolo", 1,
            [{"ingrediente": "acucar", "quantidade": 300, "unidade": "g", "preco_unitario": 5}],
        )
        await client.post(
            "/api/stock/",
            headers=auth["headers"],
            json={"ingrediente": "acucar", "unidade": "g", "quantidade_delta": 1000},
        )
        production = await create_production(
            client,
            auth["headers"],
            nome="Evento pequeno",
            recipes=[{"recipe_id": recipe["id"], "escala_fator": 1}],
        )
        resp = await client.get(
            f"/api/productions/{production['id']}/shopping-list", headers=auth["headers"]
        )
        item = resp.json()[0]
        assert float(item["quantidade_a_comprar"]) == 0
        assert float(item["preco_estimado"]) == 0

    async def test_regenerate_recomputes_stock_snapshot(self, client):
        auth = await register_user(client, "r3@b.com")
        recipe = await create_recipe(
            client, auth["headers"], "Bolo", 1,
            [{"ingrediente": "leite", "quantidade": 1, "unidade": "L", "preco_unitario": 6}],
        )
        production = await create_production(
            client,
            auth["headers"],
            nome="Evento leite",
            recipes=[{"recipe_id": recipe["id"], "escala_fator": 2}],
        )
        first = await client.get(
            f"/api/productions/{production['id']}/shopping-list", headers=auth["headers"]
        )
        assert float(first.json()[0]["quantidade_estoque"]) == 0

        await client.post(
            "/api/stock/",
            headers=auth["headers"],
            json={"ingrediente": "leite", "unidade": "L", "quantidade_delta": 0.5},
        )
        second = await client.get(
            f"/api/productions/{production['id']}/shopping-list?regenerate=true",
            headers=auth["headers"],
        )
        item = second.json()[0]
        assert float(item["quantidade_estoque"]) == 500
        assert float(item["quantidade_a_comprar"]) == 1500


class TestShoppingListFluxoB:
    async def test_avulso_items_scaled_by_guests(self, client):
        """D002: usuário informa qtd por pessoa × convidados."""
        auth = await register_user(client, "s4@b.com")
        production = await create_production(
            client,
            auth["headers"],
            nome="Buffet 50",
            convidados=50,
            recipes=[
                {
                    "recipe_id": None,
                    "escala_fator": 50,
                    "item_nome": "panacota",
                    "item_quantidade_base": 50,
                    "item_unidade": "g",
                }
            ],
        )
        resp = await client.get(
            f"/api/productions/{production['id']}/shopping-list", headers=auth["headers"]
        )
        items = resp.json()
        assert items[0]["ingrediente"] == "panacota"
        assert float(items[0]["quantidade_total"]) == 2500


class TestWasteRecords:
    async def test_balance_finalizes_production(self, client):
        auth = await register_user(client, "w1@b.com")
        production = await create_production(client, auth["headers"], nome="Evento W")

        resp = await client.post(
            f"/api/productions/{production['id']}/waste",
            headers=auth["headers"],
            json={
                "item": "arroz",
                "quantidade_produzida": 5,
                "quantidade_consumida": 2.5,
                "quantidade_descartada": 2,
                "quantidade_devolvida": 0.5,
                "unidade": "kg",
                "custo_desperdicio": 15.0,
            },
        )
        assert resp.status_code == 201

        detail = await client.get(
            f"/api/productions/{production['id']}", headers=auth["headers"]
        )
        assert detail.json()["status"] == "finalizado"
        assert len(detail.json()["waste_records"]) == 1

    async def test_devolvido_returns_to_stock(self, client):
        """Devolvido (não exposto) volta ao estoque; descartado não."""
        auth = await register_user(client, "w2b@b.com")
        production = await create_production(client, auth["headers"], nome="Evento R")
        resp = await client.post(
            f"/api/productions/{production['id']}/waste",
            headers=auth["headers"],
            json={
                "item": "bolo crú",
                "quantidade_produzida": 10,
                "quantidade_consumida": 6,
                "quantidade_descartada": 2,
                "quantidade_devolvida": 2,
                "unidade": "unidade",
            },
        )
        assert resp.status_code == 201

        stock = await client.get("/api/stock/", headers=auth["headers"])
        items = {i["ingrediente"]: i for i in stock.json()}
        assert "bolo crú" in items
        assert float(items["bolo crú"]["quantidade"]) == 2

    async def test_rejects_unknown_unit(self, client):
        auth = await register_user(client, "w2c@b.com")
        production = await create_production(client, auth["headers"], nome="Evento X")
        resp = await client.post(
            f"/api/productions/{production['id']}/waste",
            headers=auth["headers"],
            json={"item": "arroz", "quantidade_consumida": 1, "unidade": "panela"},
        )
        assert resp.status_code == 422

    async def test_update_and_delete_within_24h(self, client):
        auth = await register_user(client, "w3@b.com")
        production = await create_production(client, auth["headers"], nome="Evento Y")
        resp = await client.post(
            f"/api/productions/{production['id']}/waste",
            headers=auth["headers"],
            json={
                "item": "feijao",
                "quantidade_produzida": 3,
                "quantidade_consumida": 2,
                "quantidade_descartada": 1,
                "unidade": "kg",
                "custo_desperdicio": 8.0,
            },
        )
        record_id = resp.json()["id"]

        resp = await client.put(
            f"/api/productions/{production['id']}/waste/{record_id}",
            headers=auth["headers"],
            json={"custo_desperdicio": 9.5},
        )
        assert resp.status_code == 200
        assert float(resp.json()["custo_desperdicio"]) == 9.5

        resp = await client.delete(
            f"/api/productions/{production['id']}/waste/{record_id}", headers=auth["headers"]
        )
        assert resp.status_code == 204

    async def test_update_after_24h_forbidden(self, client, session_factory):
        auth = await register_user(client, "w4@b.com")
        production = await create_production(client, auth["headers"], nome="Evento Z")
        resp = await client.post(
            f"/api/productions/{production['id']}/waste",
            headers=auth["headers"],
            json={
                "item": "bolo",
                "quantidade_consumida": 1,
                "unidade": "unidade",
            },
        )
        record_id = resp.json()["id"]

        # Simulate an old record
        from uuid import UUID

        from app.models import WasteRecord

        async with session_factory() as session:
            record = await session.get(WasteRecord, UUID(record_id))
            record.created_at = record.created_at - timedelta(hours=25)
            await session.commit()

        resp = await client.put(
            f"/api/productions/{production['id']}/waste/{record_id}",
            headers=auth["headers"],
            json={"custo_desperdicio": 5},
        )
        assert resp.status_code == 403
