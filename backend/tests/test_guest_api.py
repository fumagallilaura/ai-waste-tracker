"""API tests for the guest (no-login) trial flow: quota, ownership and claim."""

from __future__ import annotations

from datetime import date

from tests.conftest import register_user

TODAY = date.today()


async def create_guest_production(client, nome="Evento visitante"):
    return await client.post(
        "/api/guest/productions",
        json={
            "nome": nome,
            "tipo": "outro",
            "data": TODAY.isoformat(),
            "convidados": 20,
            "recipes": [
                {
                    "recipe_id": None,
                    "escala_fator": 1,
                    "item_nome": "brigadeiro",
                    "item_quantidade_base": 100,
                    "item_unidade": "unidade",
                }
            ],
        },
    )


class TestGuestProduction:
    async def test_create_and_requisition(self, client):
        response = await create_guest_production(client)
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["nome"] == "Evento visitante"
        assert body["status"] == "planejado"

        # cookie do visitante foi definido
        assert "dz_guest" in response.cookies or any(
            c.name == "dz_guest" for c in client.cookies.jar
        )

        listing = await client.get(f"/api/guest/productions/{body['id']}/shopping-list")
        assert listing.status_code == 200
        items = listing.json()
        assert items[0]["ingrediente"] == "brigadeiro"
        assert float(items[0]["quantidade_total"]) == 100
        assert float(items[0]["quantidade_a_comprar"]) == 100  # visitante não tem estoque

    async def test_quota_blocks_second_production(self, client):
        first = await create_guest_production(client)
        assert first.status_code == 201

        second = await create_guest_production(client, nome="Segunda")
        assert second.status_code == 403
        assert "produção grátis" in second.json()["detail"]

    async def test_detail_requires_same_guest(self, client):
        first = await create_guest_production(client)
        production_id = first.json()["id"]

        # outro visitante (sem o cookie) não vê a produção
        from httpx import ASGITransport, AsyncClient

        from app.main import app

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as stranger:
            response = await stranger.get(f"/api/guest/productions/{production_id}")
            assert response.status_code == 404

        # o dono vê
        mine = await client.get(f"/api/guest/productions/{production_id}")
        assert mine.status_code == 200

    async def test_balance_only_once(self, client):
        created = await create_guest_production(client)
        production_id = created.json()["id"]

        balance = await client.post(
            f"/api/guest/productions/{production_id}/waste",
            json={
                "item": "brigadeiro",
                "quantidade_produzida": 100,
                "quantidade_consumida": 70,
                "quantidade_descartada": 20,
                "quantidade_devolvida": 10,
                "unidade": "unidade",
                "custo_desperdicio": 15,
            },
        )
        assert balance.status_code == 200, balance.text

        detail = await client.get(f"/api/guest/productions/{production_id}")
        assert detail.json()["status"] == "finalizado"

        again = await client.post(
            f"/api/guest/productions/{production_id}/waste",
            json={"item": "outro", "quantidade_consumida": 1, "unidade": "unidade"},
        )
        assert again.status_code == 403
        assert "balanço" in again.json()["detail"].lower()

    async def test_rejects_recipe_items(self, client):
        response = await client.post(
            "/api/guest/productions",
            json={
                "nome": "X",
                "tipo": "outro",
                "data": TODAY.isoformat(),
                "recipes": [
                    {"recipe_id": "00000000-0000-0000-0000-000000000001", "escala_fator": 1}
                ],
            },
        )
        assert response.status_code == 422

    async def test_guest_production_isolated_from_other_users(self, client):
        """Produção de visitante só aparece para quem fez o claim (mesmo browser)."""
        from httpx import ASGITransport, AsyncClient

        from app.main import app

        await create_guest_production(client)
        auth = await register_user(client, "g-owner@b.com")

        # o dono (mesmo browser, cookie no jar) vê após o claim
        resp = await client.get("/api/productions/", headers=auth["headers"])
        assert [p["nome"] for p in resp.json()] == ["Evento visitante"]

        # outro usuário não vê
        other = await register_user(client, "g-other@b.com")
        resp = await client.get("/api/productions/", headers=other["headers"])
        assert resp.json() == []

        # e um visitante anônimo também não vê
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as stranger:
            resp = await stranger.get("/api/productions/")
            assert resp.status_code == 401


class TestGuestClaim:
    async def test_claim_on_register(self, client, session_factory):
        from uuid import UUID

        from app.models import Production

        created = await create_guest_production(client)
        production_id = created.json()["id"]

        # cadastro no MESMO browser (cookie jar do client) → claim
        auth = await register_user(client, "claimer@b.com")

        listings = await client.get("/api/productions/", headers=auth["headers"])
        names = [p["nome"] for p in listings.json()]
        assert "Evento visitante" in names

        async with session_factory() as session:
            production = await session.get(Production, UUID(production_id))
            assert production.user_id is not None
            assert production.guest_identifier_hash is not None

    async def test_claim_on_login(self, client):
        # registra usuário antes, cria produção como visitante, depois login
        await register_user(client, "claimer2@b.com")
        created = await create_guest_production(client)
        production_id = created.json()["id"]

        # login de novo (cookie do visitante ainda no jar)
        login = await client.post(
            "/api/auth/login",
            json={"email": "claimer2@b.com", "password": "secret123"},
        )
        assert login.status_code == 200

        listings = await client.get("/api/productions/", headers={
            "Authorization": f"Bearer {login.json()['access_token']}"
        })
        assert any(p["id"] == production_id for p in listings.json())

    async def test_quota_resets_after_claim(self, client):
        await create_guest_production(client)
        auth = await register_user(client, "claimer3@b.com")

        # cookie foi removido no claim → novo visitante → pode criar de novo
        second = await create_guest_production(client, nome="Depois do claim")
        assert second.status_code == 201
        listings = await client.get("/api/productions/", headers=auth["headers"])
        assert len(listings.json()) == 1  # só a primeira foi associada
