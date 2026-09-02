"""Unit tests for the notification service (dev mock path)."""

from __future__ import annotations

from app.services import notification_service
from app.services.notification_service import (
    send_email,
    send_pre_event_reminder,
    send_waste_reminder,
)


class TestSendEmailDevMode:
    async def test_placeholder_key_returns_dev_mock(self, monkeypatch, capsys):
        monkeypatch.setattr(notification_service.settings, "resend_api_key", "re_placeholder")
        result = await send_email("a@b.com", "Assunto", "<p>oi</p>")
        assert result["status"] == "dev"
        assert result["id"] == "dev_mock"
        assert "[EMAIL] To: a@b.com" in capsys.readouterr().out

    async def test_empty_key_returns_dev_mock(self, monkeypatch):
        monkeypatch.setattr(notification_service.settings, "resend_api_key", "")
        result = await send_email("a@b.com", "Assunto", "<p>oi</p>")
        assert result["status"] == "dev"


class TestTemplatedEmails:
    async def test_waste_reminder_dev(self, monkeypatch):
        monkeypatch.setattr(notification_service.settings, "resend_api_key", "re_placeholder")
        result = await send_waste_reminder("a@b.com", "Casamento Ana", "10/10/2026")
        assert result["status"] == "dev"

    async def test_pre_event_reminder_dev(self, monkeypatch):
        monkeypatch.setattr(notification_service.settings, "resend_api_key", "re_placeholder")
        result = await send_pre_event_reminder("a@b.com", "Buffet Formatura", "11/10/2026")
        assert result["status"] == "dev"
