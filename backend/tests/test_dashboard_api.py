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
            "ingrediente_ou_prato": "arroz",
            "quantidade_sobrou": 2,
            "unidade": "kg",
            "motivo": "produzi_demais",
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
        # custo_compras = desperdicio / 0.113 (D006 heuristic)
        assert item["custo_compras"] == 100.0

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
