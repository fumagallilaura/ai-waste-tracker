"""Static starter recipes for events (catalog — not seeded into user accounts)."""

from __future__ import annotations

# preco_unitario: R$/kg for g, R$/L for ml, R$/unidade otherwise (same as RecipeIngredientCreate).

STARTER_CATALOG: list[dict] = [
    {
        "slug": "brigadeiro",
        "nome": "Brigadeiro",
        "rendimento_base": 50,
        "tipo": "sobremesa",
        "ingredients": [
            {"ingrediente": "leite condensado", "quantidade": 395, "unidade": "g", "preco_unitario": 28.0},
            {"ingrediente": "chocolate em pó", "quantidade": 30, "unidade": "g", "preco_unitario": 45.0},
            {"ingrediente": "manteiga", "quantidade": 15, "unidade": "g", "preco_unitario": 35.0},
            {"ingrediente": "granulado de chocolate", "quantidade": 100, "unidade": "g", "preco_unitario": 40.0},
        ],
    },
    {
        "slug": "beijinho",
        "nome": "Beijinho",
        "rendimento_base": 50,
        "tipo": "sobremesa",
        "ingredients": [
            {"ingrediente": "leite condensado", "quantidade": 395, "unidade": "g", "preco_unitario": 28.0},
            {"ingrediente": "coco ralado", "quantidade": 100, "unidade": "g", "preco_unitario": 32.0},
            {"ingrediente": "manteiga", "quantidade": 15, "unidade": "g", "preco_unitario": 35.0},
            {"ingrediente": "açúcar cristal", "quantidade": 50, "unidade": "g", "preco_unitario": 5.0},
        ],
    },
    {
        "slug": "coxinha",
        "nome": "Coxinha",
        "rendimento_base": 40,
        "tipo": "entrada",
        "ingredients": [
            {"ingrediente": "peito de frango", "quantidade": 500, "unidade": "g", "preco_unitario": 22.0},
            {"ingrediente": "farinha de trigo", "quantidade": 400, "unidade": "g", "preco_unitario": 6.0},
            {"ingrediente": "leite", "quantidade": 500, "unidade": "ml", "preco_unitario": 5.0},
            {"ingrediente": "manteiga", "quantidade": 40, "unidade": "g", "preco_unitario": 35.0},
            {"ingrediente": "ovo", "quantidade": 2, "unidade": "unidade", "preco_unitario": 0.8},
            {"ingrediente": "farinha de rosca", "quantidade": 200, "unidade": "g", "preco_unitario": 12.0},
            {"ingrediente": "óleo para fritar", "quantidade": 500, "unidade": "ml", "preco_unitario": 9.0},
        ],
    },
    {
        "slug": "empada-de-frango",
        "nome": "Empada de frango",
        "rendimento_base": 30,
        "tipo": "entrada",
        "ingredients": [
            {"ingrediente": "farinha de trigo", "quantidade": 500, "unidade": "g", "preco_unitario": 6.0},
            {"ingrediente": "manteiga", "quantidade": 200, "unidade": "g", "preco_unitario": 35.0},
            {"ingrediente": "peito de frango", "quantidade": 400, "unidade": "g", "preco_unitario": 22.0},
            {"ingrediente": "cebola", "quantidade": 1, "unidade": "unidade", "preco_unitario": 1.5},
            {"ingrediente": "ovo", "quantidade": 2, "unidade": "unidade", "preco_unitario": 0.8},
            {"ingrediente": "azeitona", "quantidade": 50, "unidade": "g", "preco_unitario": 30.0},
        ],
    },
    {
        "slug": "mini-pizza",
        "nome": "Mini pizza",
        "rendimento_base": 24,
        "tipo": "entrada",
        "ingredients": [
            {"ingrediente": "farinha de trigo", "quantidade": 500, "unidade": "g", "preco_unitario": 6.0},
            {"ingrediente": "fermento biológico seco", "quantidade": 10, "unidade": "g", "preco_unitario": 80.0},
            {"ingrediente": "molho de tomate", "quantidade": 300, "unidade": "g", "preco_unitario": 12.0},
            {"ingrediente": "mussarela", "quantidade": 400, "unidade": "g", "preco_unitario": 45.0},
            {"ingrediente": "orégano", "quantidade": 5, "unidade": "g", "preco_unitario": 60.0},
            {"ingrediente": "azeite", "quantidade": 30, "unidade": "ml", "preco_unitario": 40.0},
        ],
    },
    {
        "slug": "pao-de-queijo",
        "nome": "Pão de queijo",
        "rendimento_base": 40,
        "tipo": "acompanhamento",
        "ingredients": [
            {"ingrediente": "polvilho azedo", "quantidade": 500, "unidade": "g", "preco_unitario": 12.0},
            {"ingrediente": "leite", "quantidade": 250, "unidade": "ml", "preco_unitario": 5.0},
            {"ingrediente": "óleo", "quantidade": 100, "unidade": "ml", "preco_unitario": 9.0},
            {"ingrediente": "ovo", "quantidade": 2, "unidade": "unidade", "preco_unitario": 0.8},
            {"ingrediente": "queijo minas", "quantidade": 250, "unidade": "g", "preco_unitario": 40.0},
        ],
    },
    {
        "slug": "bolo-de-chocolate",
        "nome": "Bolo de chocolate",
        "rendimento_base": 16,
        "tipo": "sobremesa",
        "ingredients": [
            {"ingrediente": "farinha de trigo", "quantidade": 300, "unidade": "g", "preco_unitario": 6.0},
            {"ingrediente": "açúcar", "quantidade": 300, "unidade": "g", "preco_unitario": 5.0},
            {"ingrediente": "chocolate em pó", "quantidade": 80, "unidade": "g", "preco_unitario": 45.0},
            {"ingrediente": "ovo", "quantidade": 3, "unidade": "unidade", "preco_unitario": 0.8},
            {"ingrediente": "leite", "quantidade": 200, "unidade": "ml", "preco_unitario": 5.0},
            {"ingrediente": "óleo", "quantidade": 100, "unidade": "ml", "preco_unitario": 9.0},
            {"ingrediente": "fermento em pó", "quantidade": 15, "unidade": "g", "preco_unitario": 40.0},
        ],
    },
    {
        "slug": "salada-de-maionese",
        "nome": "Salada de maionese",
        "rendimento_base": 20,
        "tipo": "acompanhamento",
        "ingredients": [
            {"ingrediente": "batata", "quantidade": 1.5, "unidade": "kg", "preco_unitario": 6.0},
            {"ingrediente": "cenoura", "quantidade": 300, "unidade": "g", "preco_unitario": 5.0},
            {"ingrediente": "maionese", "quantidade": 400, "unidade": "g", "preco_unitario": 18.0},
            {"ingrediente": "ervilha", "quantidade": 200, "unidade": "g", "preco_unitario": 15.0},
            {"ingrediente": "ovo", "quantidade": 3, "unidade": "unidade", "preco_unitario": 0.8},
        ],
    },
    {
        "slug": "arroz-branco",
        "nome": "Arroz branco",
        "rendimento_base": 20,
        "tipo": "acompanhamento",
        "ingredients": [
            {"ingrediente": "arroz", "quantidade": 1, "unidade": "kg", "preco_unitario": 7.0},
            {"ingrediente": "óleo", "quantidade": 30, "unidade": "ml", "preco_unitario": 9.0},
            {"ingrediente": "alho", "quantidade": 20, "unidade": "g", "preco_unitario": 25.0},
            {"ingrediente": "sal", "quantidade": 15, "unidade": "g", "preco_unitario": 2.0},
        ],
    },
    {
        "slug": "suco-de-laranja",
        "nome": "Suco de laranja",
        "rendimento_base": 20,
        "tipo": "bebida",
        "ingredients": [
            {"ingrediente": "laranja", "quantidade": 3, "unidade": "kg", "preco_unitario": 6.0},
            {"ingrediente": "açúcar", "quantidade": 200, "unidade": "g", "preco_unitario": 5.0},
            {"ingrediente": "água", "quantidade": 2, "unidade": "L", "preco_unitario": 0.0},
        ],
    },
]

_BY_SLUG = {item["slug"]: item for item in STARTER_CATALOG}


def get_catalog_recipe(slug: str) -> dict | None:
    return _BY_SLUG.get(slug)
