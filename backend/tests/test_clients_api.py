"""API tests for clients (buffets) — CRUD, ownership, consumption pattern, suggestion."""

from __future__ import annotations

from datetime import date

from tests.conftest import register_user

TODAY = date.today()


async def create_client(client, headers, nome="Buffet Sol", fator=0.7):
    response = await client.post(
        "/api/clients/",
        headers=headers,
        json={"nome": nome, "tipo": "buffet", "fator_producao": fator},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def finalize_event_with_balance(
    client,
    headers,
    client_id: str,
    nome: str,
    convidados: int,
    item: str,
    produzida: float,
    consumida: float,
    descartada: float,
    devolvida: float = 0,
    unidade: str = "unidade",
):
    response = await client.post(
        "/api/productions/",
        headers=headers,
        json={
            "nome": nome,
            "tipo": "aniversario",
            "data": TODAY.isoformat(),
            "convidados": convidados,
            "client_id": client_id,
        },
    )
    assert response.status_code == 201, response.text
    production_id = response.json()["id"]
    response = await client.post(
        f"/api/productions/{production_id}/waste",
        headers=headers,
        json={
            "item": item,
            "quantidade_produzida": produzida,
            "quantidade_consumida": consumida,
            "quantidade_descartada": descartada,
            "quantidade_devolvida": devolvida,
            "unidade": unidade,
        },
    )
    assert response.status_code == 201, response.text
    return production_id


class TestClientCRUD:
    async def test_create_and_list(self, client):
        auth = await register_user(client, "c1@b.com")
        created = await create_client(client, auth["headers"], nome="Buffet Aurora")
        assert created["fator_producao"] == 0.7
        assert created["tipo"] == "buffet"

        resp = await client.get("/api/clients/", headers=auth["headers"])
        assert [c["nome"] for c in resp.json()] == ["Buffet Aurora"]

    async def test_update_fator(self, client):
        auth = await register_user(client, "c2@b.com")
        created = await create_client(client, auth["headers"])
        resp = await client.put(
            f"/api/clients/{created['id']}",
            headers=auth["headers"],
            json={"fator_producao": 0.5},
        )
        assert resp.status_code == 200
        assert float(resp.json()["fator_producao"]) == 0.5

    async def test_user_isolation(self, client):
        a = await register_user(client, "c3a@b.com")
        b = await register_user(client, "c3b@b.com")
        created = await create_client(client, a["headers"])
        resp = await client.get(f"/api/clients/{created['id']}", headers=b["headers"])
        assert resp.status_code == 404

    async def test_delete_unlinks_productions(self, client):
        auth = await register_user(client, "c4@b.com")
        created = await create_client(client, auth["headers"])
        production = await client.post(
            "/api/productions/",
            headers=auth["headers"],
            json={
                "nome": "Evento",
                "tipo": "casamento",
                "data": TODAY.isoformat(),
                "client_id": created["id"],
            },
        )
        assert production.status_code == 201
        assert production.json()["client_id"] == created["id"]

        resp = await client.delete(f"/api/clients/{created['id']}", headers=auth["headers"])
        assert resp.status_code == 204
        detail = await client.get(
            f"/api/productions/{production.json()['id']}", headers=auth["headers"]
        )
        assert detail.json()["client_id"] is None

    async def test_invalid_tipo_rejected(self, client):
        auth = await register_user(client, "c5@b.com")
        resp = await client.post(
            "/api/clients/",
            headers=auth["headers"],
            json={"nome": "X", "tipo": "outro"},
        )
        assert resp.status_code == 422


class TestClientPattern:
    async def test_empty_pattern(self, client):
        auth = await register_user(client, "cp1@b.com")
        created = await create_client(client, auth["headers"])
        resp = await client.get(
            f"/api/clients/{created['id']}/pattern", headers=auth["headers"]
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["eventos_analisados"] == 0
        assert body["itens"] == []

    async def test_pattern_aggregates_history(self, client):
        auth = await register_user(client, "cp2@b.com")
        created = await create_client(client, auth["headers"])

        # dois eventos de 100 convidados: 70 brig. / evento em média
        await finalize_event_with_balance(
            client, auth["headers"], created["id"],
            "Festa Junina", 100, "brigadeiro",
            produzida=90, consumida=70, descartada=15, devolvida=5,
        )
        await finalize_event_with_balance(
            client, auth["headers"], created["id"],
            "Aniversário Ana", 100, "brigadeiro",
            produzida=95, consumida=70, descartada=20, devolvida=5,
        )

        resp = await client.get(
            f"/api/clients/{created['id']}/pattern", headers=auth["headers"]
        )
        body = resp.json()
        assert body["eventos_analisados"] == 2
        item = body["itens"][0]
        assert item["item"] == "brigadeiro"
        assert item["unidade_base"] == "unidade"
        assert item["eventos"] == 2
        assert item["media_consumida"] == 70.0
        assert item["consumo_por_convidado"] == 0.7  # 140 consumidos / 200 convidados
        assert item["media_descartada"] == 17.5
        assert item["media_devolvida"] == 5.0


class TestClientSuggestion:
    async def test_suggestion_uses_consumed_per_guest(self, client):
        auth = await register_user(client, "cs1@b.com")
        created = await create_client(client, auth["headers"])
        await finalize_event_with_balance(
            client, auth["headers"], created["id"],
            "Festa", 100, "brigadeiro",
            produzida=90, consumida=70, descartada=20,
        )

        resp = await client.get(
            f"/api/clients/{created['id']}/suggestion?convidados=200",
            headers=auth["headers"],
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["convidados"] == 200
        item = body["itens"][0]
        # 0.7 por convidado × 200 × margem 10% = 154
        assert item["quantidade_sugerida"] == 154
        assert item["base_historica"] == 140

    async def test_suggestion_skips_items_without_guest_history(self, client):
        auth = await register_user(client, "cs2@b.com")
        created = await create_client(client, auth["headers"])
        # evento sem convidados informados
        response = await client.post(
            "/api/productions/",
            headers=auth["headers"],
            json={
                "nome": "Turno loja",
                "tipo": "turno_diario",
                "data": TODAY.isoformat(),
                "client_id": created["id"],
            },
        )
        production_id = response.json()["id"]
        await client.post(
            f"/api/productions/{production_id}/waste",
            headers=auth["headers"],
            json={
                "item": "bolo de pote",
                "quantidade_produzida": 10,
                "quantidade_consumida": 8,
                "unidade": "unidade",
            },
        )

        resp = await client.get(
            f"/api/clients/{created['id']}/suggestion?convidados=50",
            headers=auth["headers"],
        )
        assert resp.json()["itens"] == []

    async def test_suggestion_requires_client(self, client):
        auth = await register_user(client, "cs3@b.com")
        resp = await client.get(
            f"/api/clients/{'00000000-0000-0000-0000-000000000000'}/suggestion?convidados=50",
            headers=auth["headers"],
        )
        assert resp.status_code == 404
