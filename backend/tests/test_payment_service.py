"""Unit tests for the Mercado Pago payment service (sandbox/mock paths)."""

from __future__ import annotations

import hashlib
import hmac

import pytest

from app.models import User
from app.services import payment_service
from app.services.payment_service import (
    PLAN_PRICES,
    create_preference,
    verify_webhook_signature,
)


class TestCreatePreference:
    async def test_sandbox_returns_mock_preference(self):
        user = User(email="a@b.com", plan="pro")
        result = await create_preference(user, "pro_mensal")
        assert result["id"].startswith("pref_")
        assert "init_point" in result
        assert "sandbox.mercadopago.com.br" in result["init_point"]

    async def test_invalid_plan_raises(self):
        user = User(email="a@b.com", plan="free")
        with pytest.raises(ValueError, match="Invalid plan"):
            await create_preference(user, "pro_vitalicio")

    async def test_prices_in_cents(self):
        assert PLAN_PRICES["pro_mensal"]["value"] == 1990  # R$ 19,90
        assert PLAN_PRICES["pro_anual"]["value"] == 14900  # R$ 149,00


class TestWebhookSignature:
    def test_skipped_without_token(self, monkeypatch):
        monkeypatch.setattr(payment_service.settings, "mercado_pago_access_token", "")
        assert verify_webhook_signature(b"{}", "") is True

    def test_valid_signature(self, monkeypatch):
        monkeypatch.setattr(payment_service.settings, "mercado_pago_access_token", "TESTsecret")
        body = b'{"id": 123}'
        digest = hmac.new(b"TESTsecret", body, hashlib.sha256).hexdigest()
        assert verify_webhook_signature(body, f"t=1700000000,v1={digest}") is True

    def test_invalid_signature(self, monkeypatch):
        monkeypatch.setattr(payment_service.settings, "mercado_pago_access_token", "TESTsecret")
        assert verify_webhook_signature(b"{}", "t=1,v1=nope") is False
