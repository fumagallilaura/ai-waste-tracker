"""Static benchmark data from SEBRAE/EMBRAPA for Fluxo B.

These are average consumption values per person for common dishes.
Used when the user creates a production without formal recipes.
"""

# Average consumption per person (in grams or ml)
MARKET_BENCHMARKS: dict[str, dict[str, float]] = {
    "panacota": {
        "cream_cheese_g": 50,
        "creme_de_leite_ml": 30,
        "leite_condensado_ml": 40,
        "gelatina_em_pó_g": 5,
        "baunilha_ml": 2,
    },
    "arroz": {
        "arroz_g": 80,
        "agua_ml": 160,
        "oleo_ml": 5,
        "sal_g": 3,
    },
    "feijao": {
        "feijao_g": 100,
        "agua_ml": 300,
        "sal_g": 3,
        "alho_g": 2,
        "cebola_g": 10,
    },
    "frango_grelhado": {
        "peito_de_frango_g": 150,
        "sal_g": 3,
        "limao_ml": 5,
        "alho_g": 2,
        "oleo_ml": 5,
    },
    "salada_mista": {
        "alface_g": 30,
        "tomate_g": 40,
        "cebola_g": 10,
        "azeite_ml": 5,
        "sal_g": 1,
    },
    "macarrao": {
        "macarrao_g": 100,
        "molho_de_tomate_ml": 80,
        "carne_moida_g": 60,
        "cebola_g": 10,
        "alho_g": 2,
        "azeite_ml": 5,
    },
    "pizza": {
        "massa_g": 200,
        "molho_de_tomate_ml": 50,
        "mussarela_g": 80,
        "presunto_g": 40,
        "azeite_ml": 3,
    },
    "hamburguer": {
        "pao_g": 60,
        "carne_g": 150,
        "queijo_g": 30,
        "alface_g": 10,
        "tomate_g": 20,
        "molho_ml": 15,
    },
}

# Average food cost percentage by segment (from SEBRAE)
CMV_BENCHMARKS: dict[str, dict[str, float]] = {
    "restaurante": {"ideal_min": 28, "ideal_max": 35, "alerta": 38},
    "pizzaria": {"ideal_min": 25, "ideal_max": 32, "alerta": 35},
    "hamburgueria": {"ideal_min": 30, "ideal_max": 38, "alerta": 40},
    "bar": {"ideal_min": 22, "ideal_max": 28, "alerta": 33},
    "cafeteria": {"ideal_min": 18, "ideal_max": 25, "alerta": 30},
    "self_service": {"ideal_min": 32, "ideal_max": 40, "alerta": 43},
    "buffet": {"ideal_min": 30, "ideal_max": 38, "alerta": 42},
    "dark_kitchen": {"ideal_min": 25, "ideal_max": 32, "alerta": 35},
}

# Average waste percentage by segment
WASTE_BENCHMARKS: dict[str, float] = {
    "restaurante": 11.3,
    "pizzaria": 8.5,
    "hamburgueria": 10.0,
    "bar": 5.0,
    "cafeteria": 7.0,
    "self_service": 15.0,
    "buffet": 18.0,
    "dark_kitchen": 9.0,
}
