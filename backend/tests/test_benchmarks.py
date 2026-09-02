"""Unit tests for static benchmark data (SEBRAE/EMBRAPA tables)."""

from __future__ import annotations

from app.core.benchmarks import CMV_BENCHMARKS, MARKET_BENCHMARKS, WASTE_BENCHMARKS


class TestCMVBenchmarks:
    def test_ranges_are_ordered(self):
        for segment, values in CMV_BENCHMARKS.items():
            assert values["ideal_min"] < values["ideal_max"], segment
            assert values["ideal_max"] < values["alerta"], segment

    def test_all_segments_have_waste_benchmark(self):
        assert set(CMV_BENCHMARKS.keys()) == set(WASTE_BENCHMARKS.keys())

    def test_waste_percentages_sane(self):
        for segment, pct in WASTE_BENCHMARKS.items():
            assert 0 < pct < 50, segment


class TestMarketBenchmarks:
    def test_quantities_positive(self):
        for dish, items in MARKET_BENCHMARKS.items():
            assert items, dish
            for key, value in items.items():
                assert value > 0, f"{dish}/{key}"

    def test_units_are_base_units(self):
        """Consumption values must be expressed in grams or ml (D009)."""
        for dish, items in MARKET_BENCHMARKS.items():
            for key in items:
                assert key.endswith("_g") or key.endswith("_ml"), f"{dish}/{key}"

    def test_per_person_portions_sane(self):
        """No single ingredient exceeds 1.5kg/L per person."""
        for dish, items in MARKET_BENCHMARKS.items():
            for key, value in items.items():
                assert value <= 1500, f"{dish}/{key}"

    def test_known_dishes_present(self):
        for dish in ("arroz", "feijao", "pizza", "hamburguer"):
            assert dish in MARKET_BENCHMARKS
