"""API tests for insights (events comparison, daily pattern) and admin metrics."""

from __future__ import annotations

from datetime import date, timedelta

from tests.conftest import register_user

TODAY = date.today()


def next_weekday(weekday: int) -> date:
    """Próxima data com o weekday pedido (0=segunda ... 6=domingo)."""
    delta = (weekday - TODAY.weekday()) % 7
    return TODAY + timedelta(days=delta or 7)


async def create_production(client, headers, nome: str, data: date, tipo: str):
    response = await client.post(
        "/api/productions/",
        headers=headers,
        json={"nome": nome, "tipo": tipo, "data": data.isoformat(), "recipes": []},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def register_balance(client, headers, production_id, produziu, consumiu, descartou):
    response = await client.post(
        f"/api/productions/{production_id}/waste",
        headers=headers,
        json={
            "item": "pao de queijo",
            "quantidade_produzida": produziu,
            "quantidade_consumida": consumiu,
            "quantidade_descartada": descartou,
            "unidade": "unidade",
            "custo_desperdicio": descartou * 0.5,
        },
    )
    assert response.status_code == 201, response.text


async def setup_history(client, headers):
    # evento A: produziu 100, consumiu 70, descartou 30 (30% de descarte)
    pid_a = await create_production(client, headers, "Festa A", TODAY, "casamento")
    await register_balance(client, headers, pid_a, 100, 70, 30)
    # evento B: produziu 100, consumiu 95, descartou 5 (5% de descarte)
    pid_b = await create_production(client, headers, "Festa B", TODAY, "casamento")
    await register_balance(client, headers, pid_b, 100, 95, 5)
    # comércio: segunda produziu 100, sobrou 30 | sábado saiu tudo (70/70)
    pid_seg = await create_production(
        client, headers, "Turno segunda", next_weekday(0), "turno_diario"
    )
    await register_balance(client, headers, pid_seg, 100, 70, 30)
    pid_sab = await create_production(
        client, headers, "Turno sábado", next_weekday(5), "turno_diario"
    )
    await register_balance(client, headers, pid_sab, 70, 70, 0)


class TestEventInsights:
    async def test_empty(self, client):
        auth = await register_user(client, "i1@b.com")
        response = await client.get(
            "/api/insights/events?tipo=casamento", headers=auth["headers"]
        )
        assert response.status_code == 200
        body = response.json()
        assert body["eventos"] == []
        assert body["resumo"] is None

    async def test_comparison_against_similar_events(self, client):
        auth = await register_user(client, "i2@b.com")
        await setup_history(client, auth["headers"])

        response = await client.get(
            "/api/insights/events?tipo=casamento", headers=auth["headers"]
        )
        assert response.status_code == 200
        body = response.json()
        assert body["resumo"]["eventos_analisados"] == 2
        # médias: consumo (70+95)/2=82.5, descarte (30+5)/2=17.5
        assert body["resumo"]["media_consumo_pct"] == 82.5
        assert body["resumo"]["media_descarte_pct"] == 17.5

        por_nome = {e["nome"]: e for e in body["eventos"]}
        assert por_nome["Festa A"]["descarte_pct"] == 30.0
        assert por_nome["Festa A"]["vs_media_descarte"] == 12.5
        assert por_nome["Festa B"]["vs_media_descarte"] == -12.5
        assert any("Festa A" in s for s in body["sugestoes"])

    async def test_filtered_by_tipo(self, client):
        auth = await register_user(client, "i3@b.com")
        await setup_history(client, auth["headers"])
        response = await client.get(
            "/api/insights/events?tipo=turno_diario", headers=auth["headers"]
        )
        body = response.json()
        assert body["resumo"]["eventos_analisados"] == 2
        assert all(e["tipo"] == "turno_diario" for e in body["eventos"])

    async def test_requires_auth(self, client):
        response = await client.get("/api/insights/events")
        assert response.status_code == 401


class TestDailyInsights:
    async def test_weekday_pattern_and_suggestions(self, client):
        auth = await register_user(client, "i4@b.com")
        await setup_history(client, auth["headers"])

        response = await client.get("/api/insights/daily", headers=auth["headers"])
        assert response.status_code == 200
        body = response.json()
        assert body["dias_analisados"] == 2

        item = body["itens"][0]
        assert item["item"] == "pao de queijo"
        dias = {d["dia"]: d for d in item["dias"]}
        # segunda: sobrou 30% → sugestão abaixo do produzido
        segunda = dias["segunda"]
        assert segunda["sobrou_pct"] == 30.0
        assert segunda["producao_sugerida"] < segunda["media_produzida"]
        # sábado: esgotou 100% → sugestão acima do produzido
        sabado = dias["sábado"]
        assert sabado["esgotou_pct"] == 100.0
        assert sabado["producao_sugerida"] > sabado["media_produzida"]

        assert any("sábado" in s for s in body["sugestoes"])

    async def test_ai_context_present(self, client):
        auth = await register_user(client, "i5@b.com")
        await setup_history(client, auth["headers"])
        response = await client.get("/api/insights/daily", headers=auth["headers"])
        context = response.json()["ai_context"]
        assert context["itens"][0]["item"] == "pao de queijo"
        assert "segunda" in context["itens"][0]["dias"]

    async def test_ignores_event_types(self, client):
        """turno_diario é o único tipo considerado no padrão diário."""
        auth = await register_user(client, "i6@b.com")
        pid = await create_production(client, auth["headers"], "Casamento X", TODAY, "casamento")
        await register_balance(client, auth["headers"], pid, 50, 25, 25)

        response = await client.get("/api/insights/daily", headers=auth["headers"])
        assert response.json()["itens"] == []


class TestAdminMetrics:
    async def test_metrics_denied_without_token(self, client):
        response = await client.get("/api/metrics")
        assert response.status_code == 403

    async def test_metrics_with_token(self, client, monkeypatch):
        from app.config import get_settings

        monkeypatch.setattr(get_settings(), "admin_token", "secret-admin")
        response = await client.get(
            "/api/metrics", headers={"X-Admin-Token": "secret-admin"}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["requests_total"] > 0
        assert "avg_latency_ms" in body
        assert "top_paths" in body

    async def test_business_metrics_funnel(self, client, monkeypatch):
        from app.config import get_settings

        await register_user(client, "i7@b.com")
        await create_guest_production(client)

        monkeypatch.setattr(get_settings(), "admin_token", "secret-admin")
        response = await client.get(
            "/api/metrics/business", headers={"X-Admin-Token": "secret-admin"}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["users"]["total"] >= 1
        assert body["funil"]["signup_email"]["total"] >= 1
        assert body["funil"]["guest_trial_created"]["total"] >= 1

    async def test_wrong_token_forbidden(self, client, monkeypatch):
        from app.config import get_settings

        monkeypatch.setattr(get_settings(), "admin_token", "secret-admin")
        response = await client.get(
            "/api/metrics", headers={"X-Admin-Token": "errado"}
        )
        assert response.status_code == 403


async def create_guest_production(client):
    return await client.post(
        "/api/guest/productions",
        json={
            "nome": "Trial",
            "tipo": "outro",
            "data": TODAY.isoformat(),
            "recipes": [
                {
                    "recipe_id": None,
                    "escala_fator": 1,
                    "item_nome": "brigadeiro",
                    "item_quantidade_base": 10,
                    "item_unidade": "unidade",
                }
            ],
        },
    )


class TestGlobalRateLimit:
    async def test_global_teto_por_ip(self, client, monkeypatch):
        from app.config import get_settings

        monkeypatch.setattr(get_settings(), "rate_limit_default_per_minute", 2)
        # cria rotas conhecidas: 2 passam, a 3ª recebe 429
        await client.get("/api/health")
        await client.get("/api/health")
        response = await client.get("/api/health")
        assert response.status_code == 429
        assert "Muitas requisições" in response.json()["detail"]
