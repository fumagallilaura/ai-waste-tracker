"""API tests for dashboard metrics/history and health check."""

from __future__ import annotations

from datetime import date

from tests.conftest import register_user


async def make_finalized_production_with_waste(client, headers, custo: float):
    response = await client.post(
        "/api/productions/",
        headers=headers,
        json={
            "nome": "Evento",
            "tipo": "casamento",
            "data": date.today().isoformat(),
            "recipes": [],
        },
    )
    production_id = response.json()["id"]
    await client.post(
        f"/api/productions/{production_id}/waste",
        headers=headers,
        json={
            "item": "arroz",
            "quantidade_produzida": 4,
            "quantidade_consumida": 2,
            "quantidade_descartada": 2,
            "unidade": "kg",
            "custo_desperdicio": custo,
        },
    )
    return production_id


class TestHealth:
    async def test_health(self, client):
        response = await client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


class TestDashboardMetrics:
    async def test_empty_metrics(self, client):
        auth = await register_user(client, "d1@b.com")
        response = await client.get("/api/dashboard/metrics", headers=auth["headers"])
        assert response.status_code == 200
        body = response.json()
        assert body["desperdicio_total"] == 0
        assert body["total_compras"] == 0
        assert body["eventos_realizados"] == 0

    async def test_metrics_after_waste(self, client):
        auth = await register_user(client, "d2@b.com")
        await make_finalized_production_with_waste(client, auth["headers"], custo=20.0)
        await make_finalized_production_with_waste(client, auth["headers"], custo=30.0)

        response = await client.get("/api/dashboard/metrics", headers=auth["headers"])
        body = response.json()
        assert body["eventos_realizados"] == 2
        assert body["desperdicio_total"] == 50.0
        assert body["desperdicio_medio_por_evento"] == 25.0

    async def test_metrics_with_shopping_costs(self, client):
        """Taxa de desperdício usa o valor real da requisição."""
        auth = await register_user(client, "d2b@b.com")
        recipe = await client.post(
            "/api/recipes/",
            headers=auth["headers"],
            json={
                "nome": "Bolo",
                "rendimento_base": 1,
                "ingredients": [
                    {
                        "ingrediente": "farinha",
                        "quantidade": 1000,
                        "unidade": "g",
                        "preco_unitario": 10,
                    }
                ],
            },
        )
        assert recipe.status_code == 201
        recipe_id = recipe.json()["id"]
        production = await client.post(
            "/api/productions/",
            headers=auth["headers"],
            json={
                "nome": "Evento compra",
                "tipo": "casamento",
                "data": date.today().isoformat(),
                "recipes": [{"recipe_id": recipe_id, "escala_fator": 1}],
            },
        )
        production_id = production.json()["id"]
        await client.get(
            f"/api/productions/{production_id}/shopping-list", headers=auth["headers"]
        )
        await client.post(
            f"/api/productions/{production_id}/waste",
            headers=auth["headers"],
            json={
                "item": "farinha",
                "quantidade_produzida": 1,
                "quantidade_descartada": 1,
                "unidade": "kg",
                "custo_desperdicio": 10.0,
            },
        )

        body = (await client.get("/api/dashboard/metrics", headers=auth["headers"])).json()
        assert body["total_compras"] == 10.0  # 1 kg × R$ 10/kg
        assert body["desperdicio_total"] == 10.0
        assert body["taxa_desperdicio"] == 100.0

    async def test_metrics_isolated_per_user(self, client):
        a = await register_user(client, "d3a@b.com")
        b = await register_user(client, "d3b@b.com")
        await make_finalized_production_with_waste(client, a["headers"], custo=10.0)

        response = await client.get("/api/dashboard/metrics", headers=b["headers"])
        assert response.json()["eventos_realizados"] == 0

    async def test_period_filter(self, client):
        auth = await register_user(client, "d4@b.com")
        response = await client.get(
            "/api/dashboard/metrics?periodo=ultimos_30_dias", headers=auth["headers"]
        )
        assert response.status_code == 200
        assert response.json()["periodo"] == "ultimos_30_dias"


class TestDashboardHistory:
    async def test_history_lists_productions(self, client):
        auth = await register_user(client, "d5@b.com")
        await make_finalized_production_with_waste(client, auth["headers"], custo=11.3)

        response = await client.get("/api/dashboard/history", headers=auth["headers"])
        assert response.status_code == 200
        history = response.json()
        assert len(history) == 1
        item = history[0]
        assert item["nome"] == "Evento"
        assert item["status"] == "finalizado"
        assert item["custo_desperdicio"] == 11.3
        # sem lista de compras gerada, custo_compras é 0 (nada inventado)
        assert item["custo_compras"] == 0
        # balanço: 2 consumido de 4 registrado (2+2) = 50%
        assert item["consumo_total"] == 50.0

    async def test_history_respects_limit(self, client):
        auth = await register_user(client, "d6@b.com")
        for i in range(3):
            response = await client.post(
                "/api/productions/",
                headers=auth["headers"],
                json={
                    "nome": f"E{i}",
                    "tipo": "casamento",
                    "data": date.today().isoformat(),
                    "recipes": [],
                },
            )
            assert response.status_code == 201

        response = await client.get("/api/dashboard/history?limit=2", headers=auth["headers"])
        assert len(response.json()) == 2

    async def test_history_requires_auth(self, client):
        response = await client.get("/api/dashboard/history")
        assert response.status_code == 401
