"""API tests for recipe CRUD + duplicate (R8) with unit normalization (D009)."""

from __future__ import annotations

from tests.conftest import register_user


async def create_recipe(client, headers, nome="Panacota", rendimento=10):
    response = await client.post(
        "/api/recipes/",
        headers=headers,
        json={
            "nome": nome,
            "rendimento_base": rendimento,
            "tipo": "sobremesa",
            "ingredients": [
                {
                    "ingrediente": "farinha",
                    "quantidade": 0.5,
                    "unidade": "kg",
                    "preco_unitario": 6.0,
                },
                {
                    "ingrediente": "leite",
                    "quantidade": 300,
                    "unidade": "ml",
                    "preco_unitario": 0.02,
                },
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


class TestCreateRecipe:
    async def test_normalizes_units_to_base(self, client):
        auth = await register_user(client, "r1@b.com")
        recipe = await create_recipe(client, auth["headers"])
        by_name = {i["ingrediente"]: i for i in recipe["ingredients"]}
        assert by_name["farinha"]["unidade_base"] == "g"
        assert float(by_name["farinha"]["unidade_base_qtd"]) == 500
        assert by_name["leite"]["unidade_base"] == "ml"
        assert float(by_name["leite"]["unidade_base_qtd"]) == 300

    async def test_invalid_unit_returns_400(self, client):
        auth = await register_user(client, "r2@b.com")
        response = await client.post(
            "/api/recipes/",
            headers=auth["headers"],
            json={
                "nome": "X",
                "rendimento_base": 1,
                "ingredients": [
                    {"ingrediente": "arroz", "quantidade": 1, "unidade": "xícara"}
                ],
            },
        )
        assert response.status_code in (400, 422)

    async def test_requires_auth(self, client):
        response = await client.get("/api/recipes/")
        assert response.status_code == 401


class TestRecipeCRUD:
    async def test_list_returns_only_user_recipes(self, client):
        a = await register_user(client, "ra@b.com")
        b = await register_user(client, "rb@b.com")
        await create_recipe(client, a["headers"], nome="Do A")
        await create_recipe(client, b["headers"], nome="Do B")

        resp_a = await client.get("/api/recipes/", headers=a["headers"])
        assert [r["nome"] for r in resp_a.json()] == ["Do A"]

    async def test_get_and_delete(self, client):
        auth = await register_user(client, "rc@b.com")
        recipe = await create_recipe(client, auth["headers"])

        resp = await client.get(f"/api/recipes/{recipe['id']}", headers=auth["headers"])
        assert resp.status_code == 200

        resp = await client.delete(f"/api/recipes/{recipe['id']}", headers=auth["headers"])
        assert resp.status_code == 204

        resp = await client.get(f"/api/recipes/{recipe['id']}", headers=auth["headers"])
        assert resp.status_code == 404

    async def test_cannot_access_other_users_recipe(self, client):
        a = await register_user(client, "rd@b.com")
        b = await register_user(client, "re@b.com")
        recipe = await create_recipe(client, a["headers"])

        resp = await client.get(f"/api/recipes/{recipe['id']}", headers=b["headers"])
        assert resp.status_code == 404
        resp = await client.delete(f"/api/recipes/{recipe['id']}", headers=b["headers"])
        assert resp.status_code == 404

    async def test_update_replaces_ingredients(self, client):
        auth = await register_user(client, "rf@b.com")
        recipe = await create_recipe(client, auth["headers"])

        resp = await client.put(
            f"/api/recipes/{recipe['id']}",
            headers=auth["headers"],
            json={
                "nome": "Panacota melhorada",
                "ingredients": [
                    {
                        "ingrediente": "ovo",
                        "quantidade": 3,
                        "unidade": "unidade",
                        "preco_unitario": 0.8,
                    }
                ],
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["nome"] == "Panacota melhorada"
        assert len(body["ingredients"]) == 1
        assert body["ingredients"][0]["ingrediente"] == "ovo"

    async def test_duplicate_creates_copy(self, client):
        auth = await register_user(client, "rg@b.com")
        recipe = await create_recipe(client, auth["headers"], nome="Original")

        resp = await client.post(
            f"/api/recipes/{recipe['id']}/duplicate", headers=auth["headers"]
        )
        assert resp.status_code == 201
        copy = resp.json()
        assert copy["nome"] == "Original (cópia)"
        assert copy["id"] != recipe["id"]
        assert len(copy["ingredients"]) == 2
