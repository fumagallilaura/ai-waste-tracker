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

    async def test_custom_unit_accepted(self, client):
        """Medidas personalizadas (xícara, colher...) são aceitas sem conversão."""
        auth = await register_user(client, "r2@b.com")
        response = await client.post(
            "/api/recipes/",
            headers=auth["headers"],
            json={
                "nome": "Bolo de vó",
                "rendimento_base": 1,
                "ingredients": [
                    {"ingrediente": "farinha", "quantidade": 2, "unidade": "Xícara"}
                ],
            },
        )
        assert response.status_code == 201, response.text
        ingredient = response.json()["ingredients"][0]
        assert ingredient["unidade"] == "xícara"
        assert ingredient["unidade_base"] == "xícara"
        assert float(ingredient["unidade_base_qtd"]) == 2

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


class TestAiGeneration:
    async def test_not_configured_returns_503(self, client):
        auth = await register_user(client, "ai1@b.com")
        resp = await client.post(
            "/api/recipes/generate-ai", headers=auth["headers"],
            json={"prato": "bolo de cenoura", "porcoes": 10})
        assert resp.status_code == 503
        assert "APP_AI_API_KEY" in resp.json()["detail"]

    async def test_generated_recipe_is_structured(self, client, monkeypatch):
        import app.routers.recipes as recipes_router
        from app.config import get_settings

        monkeypatch.setattr(get_settings(), "ai_api_key", "test-key")

        async def fake_llm(prato, porcoes, observacoes):
            return {
                "nome": "Bolo de cenoura",
                "rendimento_base": porcoes,
                "tipo": "sobremesa",
                "ingredients": [
                    {
                        "ingrediente": "cenoura", "quantidade": 300, "unidade": "g",
                        "original": "cenoura: 300 g",
                    },
                    {
                        "ingrediente": "ovos", "quantidade": 4, "unidade": "unidade",
                        "original": "ovos: 4 unidade",
                    },
                ],
            }

        monkeypatch.setattr(recipes_router, "generate_recipe", fake_llm)
        auth = await register_user(client, "ai2@b.com")
        resp = await client.post(
            "/api/recipes/generate-ai", headers=auth["headers"],
            json={"prato": "bolo de cenoura", "porcoes": 10, "observacoes": "sem glúten"})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["nome"] == "Bolo de cenoura"
        assert body["rendimento_base"] == 10
        assert body["tipo"] == "sobremesa"
        assert len(body["ingredients"]) == 2
        assert body["ingredients"][0]["unidade"] == "g"

    async def test_llm_error_maps_to_502(self, client, monkeypatch):
        from fastapi import HTTPException

        import app.routers.recipes as recipes_router
        from app.config import get_settings

        monkeypatch.setattr(get_settings(), "ai_api_key", "test-key")

        async def broken_llm(prato, porcoes, observacoes):
            raise HTTPException(status_code=502, detail="O serviço de IA respondeu com erro. Tente novamente.")

        monkeypatch.setattr(recipes_router, "generate_recipe", broken_llm)
        auth = await register_user(client, "ai3@b.com")
        resp = await client.post(
            "/api/recipes/generate-ai", headers=auth["headers"],
            json={"prato": "x", "porcoes": 1})
        assert resp.status_code == 502
