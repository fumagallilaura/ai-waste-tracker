"""API tests for ingredient stock control."""

from __future__ import annotations

from tests.conftest import register_user


class TestStockAdjust:
    async def test_entrada_cria_item(self, client):
        auth = await register_user(client, "st1@b.com")
        resp = await client.post(
            "/api/stock/",
            headers=auth["headers"],
            json={
                "ingrediente": "farinha",
                "unidade": "kg",
                "quantidade_delta": 2.5,
                "preco_unitario": 12,
            },
        )
        assert resp.status_code == 201, resp.text
        item = resp.json()
        assert item["unidade_base"] == "g"
        assert float(item["quantidade"]) == 2500
        assert float(item["preco_unitario"]) == 12

    async def test_entrada_cumulativa(self, client):
        auth = await register_user(client, "st2@b.com")
        for delta in (1, 0.5):
            resp = await client.post(
                "/api/stock/",
                headers=auth["headers"],
                json={"ingrediente": "arroz", "unidade": "kg", "quantidade_delta": delta},
            )
            assert resp.status_code == 201
        resp = await client.get("/api/stock/", headers=auth["headers"])
        assert float(resp.json()[0]["quantidade"]) == 1500

    async def test_saida_nao_fica_negativa(self, client):
        auth = await register_user(client, "st3@b.com")
        await client.post(
            "/api/stock/",
            headers=auth["headers"],
            json={"ingrediente": "acucar", "unidade": "g", "quantidade_delta": 500},
        )
        resp = await client.post(
            "/api/stock/",
            headers=auth["headers"],
            json={"ingrediente": "acucar", "unidade": "g", "quantidade_delta": -800},
        )
        assert resp.status_code == 201
        assert float(resp.json()["quantidade"]) == 0

    async def test_saida_item_inexistente_404(self, client):
        auth = await register_user(client, "st4@b.com")
        resp = await client.post(
            "/api/stock/",
            headers=auth["headers"],
            json={"ingrediente": "fantasma", "unidade": "kg", "quantidade_delta": -1},
        )
        assert resp.status_code == 404

    async def test_unidade_incompativel_rejeitada(self, client):
        auth = await register_user(client, "st5@b.com")
        await client.post(
            "/api/stock/",
            headers=auth["headers"],
            json={"ingrediente": "farinha", "unidade": "kg", "quantidade_delta": 1},
        )
        resp = await client.post(
            "/api/stock/",
            headers=auth["headers"],
            json={"ingrediente": "farinha", "unidade": "L", "quantidade_delta": 1},
        )
        assert resp.status_code == 422

    async def test_ingrediente_case_insensitive(self, client):
        auth = await register_user(client, "st6@b.com")
        await client.post(
            "/api/stock/",
            headers=auth["headers"],
            json={"ingrediente": "Farinha", "unidade": "kg", "quantidade_delta": 1},
        )
        resp = await client.post(
            "/api/stock/",
            headers=auth["headers"],
            json={"ingrediente": "farinha", "unidade": "g", "quantidade_delta": 100},
        )
        assert resp.status_code == 201
        listing = await client.get("/api/stock/", headers=auth["headers"])
        assert len(listing.json()) == 1
        assert float(listing.json()[0]["quantidade"]) == 1100


class TestStockSetDelete:
    async def test_set_absolute_quantity(self, client):
        auth = await register_user(client, "st7@b.com")
        created = await client.post(
            "/api/stock/",
            headers=auth["headers"],
            json={"ingrediente": "leite", "unidade": "L", "quantidade_delta": 2},
        )
        item_id = created.json()["id"]
        resp = await client.put(
            f"/api/stock/{item_id}",
            headers=auth["headers"],
            json={"unidade": "L", "quantidade": 0.75},
        )
        assert resp.status_code == 200
        assert float(resp.json()["quantidade"]) == 750

    async def test_delete(self, client):
        auth = await register_user(client, "st8@b.com")
        created = await client.post(
            "/api/stock/",
            headers=auth["headers"],
            json={"ingrediente": "leite", "unidade": "L", "quantidade_delta": 2},
        )
        item_id = created.json()["id"]
        resp = await client.delete(f"/api/stock/{item_id}", headers=auth["headers"])
        assert resp.status_code == 204
        listing = await client.get("/api/stock/", headers=auth["headers"])
        assert listing.json() == []

    async def test_user_isolation(self, client):
        a = await register_user(client, "st9a@b.com")
        b = await register_user(client, "st9b@b.com")
        created = await client.post(
            "/api/stock/",
            headers=a["headers"],
            json={"ingrediente": "leite", "unidade": "L", "quantidade_delta": 2},
        )
        resp = await client.put(
            f"/api/stock/{created.json()['id']}",
            headers=b["headers"],
            json={"unidade": "L", "quantidade": 1},
        )
        assert resp.status_code == 404

    async def test_requires_auth(self, client):
        resp = await client.get("/api/stock/")
        assert resp.status_code == 401
