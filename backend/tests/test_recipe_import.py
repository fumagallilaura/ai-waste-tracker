"""Unit tests for the recipe import parser (JSON-LD + ingredient strings)."""

from __future__ import annotations

import json

import pytest

from app.services.recipe_import_service import (
    RecipeImportError,
    parse_ingredient,
    parse_recipe_html,
)
from tests.conftest import register_user

RECIPE_HTML = f"""
<html><head>
<script type="application/ld+json">
{json.dumps({
    "@context": "https://schema.org",
    "@type": "Recipe",
    "name": "Panacota cremosa",
    "recipeIngredient": [
        "500 g de cream cheese",
        "1 xícara de leite",
        "½ lata de leite condensado",
        "2 ovos",
        "sal a gosto",
    ],
    "recipeYield": "8 porções",
    "keywords": "Sobremesas, doces",
})}
</script>
<meta property="og:title" content="Panacota cremosa | Site de Receitas">
</head><body><h1>Panacota cremosa</h1></body></html>
"""


class TestParseIngredient:
    @pytest.mark.parametrize(
        ("text", "qtd", "unit", "name"),
        [
            ("500 g de farinha", 500, "g", "farinha"),
            ("1,5 kg de carne moída", 1.5, "kg", "carne moída"),
            ("300 ml de leite", 300, "ml", "leite"),
            ("1 L de água", 1, "L", "água"),
            ("1 l de água", 1, "L", "água"),
            ("2 ovos", 2, "unidade", "ovos"),
            ("3 dentes de alho", 3, "unidade", "alho"),
            ("1 colher de sopa de azeite", 15, "g", "azeite"),
            ("2 colheres de sopa de açúcar", 30, "g", "açúcar"),
            ("1 colher de chá de sal", 5, "g", "sal"),
            ("1 xícara de arroz", 240, "ml", "arroz"),
            ("1 ½ xíc de farinha", 360, "ml", "farinha"),
            ("½ lata de milho", 0.5, "unidade", "milho"),
            ("farinha de trigo", 1, "unidade", "farinha de trigo"),
            ("1 pitada de noz moscada", 1, "g", "noz moscada"),
            ("200g de queijo", 200, "g", "queijo"),
            ("1/2 kg de feijão", 0.5, "kg", "feijão"),
        ],
    )
    def test_parses(self, text, qtd, unit, name):
        q, u, n = parse_ingredient(text)
        assert q == pytest.approx(qtd)
        assert u == unit
        assert n == name


class TestParseRecipeHtml:
    def test_extracts_structured_recipe(self):
        result = parse_recipe_html(RECIPE_HTML)
        assert result["nome"] == "Panacota cremosa"
        assert result["rendimento_base"] == 8
        assert result["tipo"] == "sobremesa"
        names = [i["ingrediente"] for i in result["ingredients"]]
        assert "cream cheese" in names
        assert "sal a gosto" in names
        assert len(result["ingredients"]) == 5

    def test_preserves_original_text(self):
        result = parse_recipe_html(RECIPE_HTML)
        original = {i["ingrediente"]: i["original"] for i in result["ingredients"]}
        assert original["leite condensado"] == "½ lata de leite condensado"

    def test_graph_wrapped_jsonld(self):
        payload = {
            "@graph": [
                {"@type": "WebPage", "name": "x"},
                {"@type": "Recipe", "name": "Bolo", "recipeIngredient": ["2 kg de trigo"]},
            ]
        }
        html = (
            '<script type="application/ld+json">'
            + json.dumps(payload)
            + "</script>"
        )
        result = parse_recipe_html(html)
        assert result["nome"] == "Bolo"
        assert result["rendimento_base"] == 1

    def test_mainentity_wrapped(self):
        payload = {
            "@type": "SocialMediaPosting",
            "mainEntity": {
                "@type": "Recipe",
                "name": "Sopa",
                "recipeIngredient": ["3 batatas"],
            },
        }
        html = '<script type="application/ld+json">' + json.dumps(payload) + "</script>"
        assert parse_recipe_html(html)["nome"] == "Sopa"

    def test_invalid_json_script_is_skipped(self):
        html = (
            '<script type="application/ld+json">{broken json!!</script>'
            '<script type="application/ld+json">'
            + json.dumps({"@type": "Recipe", "name": "X", "recipeIngredient": []})
            + "</script>"
        )
        assert parse_recipe_html(html)["nome"] == "X"

    def test_no_recipe_raises(self):
        with pytest.raises(RecipeImportError, match="receita estruturada"):
            parse_recipe_html("<html><body><p>not a recipe</p></body></html>")

    def test_empty_ingredients_ok(self):
        payload = {"@type": "Recipe", "name": "Água com gás"}
        html = '<script type="application/ld+json">' + json.dumps(payload) + "</script>"
        assert parse_recipe_html(html)["ingredients"] == []


class TestImportEndpoint:
    async def test_imports_recipe_from_url(self, client, monkeypatch):
        from app.services import recipe_import_service

        async def fake_fetch(url: str) -> str:
            assert url.startswith("https://")
            return RECIPE_HTML

        monkeypatch.setattr(recipe_import_service, "_fetch_html", fake_fetch)

        auth = await register_user(client, "import1@b.com")
        response = await client.post(
            "/api/recipes/import",
            headers=auth["headers"],
            json={"url": "https://exemplo.com/panacota"},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["nome"] == "Panacota cremosa"
        assert body["rendimento_base"] == 8
        assert len(body["ingredients"]) == 5
        assert body["source_url"] == "https://exemplo.com/panacota"

    async def test_unstructured_page_returns_422(self, client, monkeypatch):
        from app.services import recipe_import_service

        async def fake_fetch(url: str) -> str:
            return "<html><body>sem dados</body></html>"

        monkeypatch.setattr(recipe_import_service, "_fetch_html", fake_fetch)

        auth = await register_user(client, "import2@b.com")
        response = await client.post(
            "/api/recipes/import",
            headers=auth["headers"],
            json={"url": "https://exemplo.com/x"},
        )
        assert response.status_code == 422
        assert "receita estruturada" in response.json()["detail"]

    async def test_internal_url_blocked(self, client):
        auth = await register_user(client, "import3@b.com")
        response = await client.post(
            "/api/recipes/import",
            headers=auth["headers"],
            json={"url": "http://169.254.169.254/latest/meta-data/"},
        )
        assert response.status_code == 422
        assert "internas" in response.json()["detail"]

    async def test_requires_auth(self, client):
        response = await client.post(
            "/api/recipes/import", json={"url": "https://exemplo.com/x"}
        )
        assert response.status_code == 401

    async def test_imported_recipe_can_be_saved(self, client, monkeypatch):
        """End-to-end within the API: import → create recipe → shopping list."""
        from app.services import recipe_import_service

        async def fake_fetch(url: str) -> str:
            return RECIPE_HTML

        monkeypatch.setattr(recipe_import_service, "_fetch_html", fake_fetch)

        auth = await register_user(client, "import4@b.com")
        imported = (
            await client.post(
                "/api/recipes/import",
                headers=auth["headers"],
                json={"url": "https://exemplo.com/panacota"},
            )
        ).json()

        response = await client.post(
            "/api/recipes/",
            headers=auth["headers"],
            json={
                "nome": imported["nome"],
                "rendimento_base": imported["rendimento_base"],
                "ingredients": [
                    {
                        "ingrediente": i["ingrediente"],
                        "quantidade": i["quantidade"],
                        "unidade": i["unidade"],
                        "preco_unitario": 0,
                    }
                    for i in imported["ingredients"]
                ],
            },
        )
        assert response.status_code == 201, response.text
        recipe = response.json()
        assert len(recipe["ingredients"]) == 5
