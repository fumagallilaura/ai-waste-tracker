"""Email notification service using Resend."""

from __future__ import annotations

import httpx

from app.config import get_settings

settings = get_settings()

RESEND_API_URL = "https://api.resend.com/emails"


async def send_email(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
) -> dict:
    """Send an email via Resend API."""
    if not settings.resend_api_key or settings.resend_api_key.startswith("re_"):
        # Dev mode - log instead of sending
        print(f"[EMAIL] To: {to}, Subject: {subject}")
        return {"id": "dev_mock", "status": "dev"}

    async with httpx.AsyncClient() as client:
        response = await client.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.email_from,
                "to": [to],
                "subject": subject,
                "html": html,
                "text": text or html,
            },
        )
        response.raise_for_status()
        return response.json()


async def send_waste_reminder(user_email: str, production_nome: str, production_data: str) -> dict:
    """Send a reminder to register waste after an event."""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">🌱 Desperdício Zero</h2>
        <p>Olá!</p>
        <p>Sua produção <strong>{production_nome}</strong> ({production_data}) foi finalizada.</p>
        <p>Registre o desperdício em <strong>30 segundos</strong> para acompanhar sua economia:</p>
        <a href="https://desperdiciozero.com.br/productions"
           style="display: inline-block; background: #059669; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 8px; margin: 16px 0;">
            Registrar desperdício →
        </a>
        <p style="color: #64748B; font-size: 12px; margin-top: 24px;">
            Se não quiser mais receber estes lembretes, acesse suas configurações.
        </p>
    </div>
    """

    text = f"""
    Desperdício Zero

    Olá! Sua produção {production_nome} ({production_data}) foi finalizada.

    Registre o desperdício em 30 segundos para acompanhar sua economia:
    https://desperdiciozero.com.br/productions

    Se não quiser mais receber estes lembretes, acesse suas configurações.
    """

    return await send_email(
        to=user_email,
        subject=(
            f"Como foi {production_nome}? "
            "Registre o desperdício em 30 segundos"
        ),
        html=html,
        text=text,
    )


async def send_pre_event_reminder(
    user_email: str, production_nome: str, production_data: str
) -> dict:
    """Send a reminder 1 day before an event with shopping list."""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">🌱 Desperdício Zero</h2>
        <p>Olá!</p>
        <p>Sua produção <strong>{production_nome}</strong> é amanhã ({production_data}).</p>
        <p>Sua lista de compras está pronta. Confira antes de ir ao mercado:</p>
        <a href="https://desperdiciozero.com.br/productions"
           style="display: inline-block; background: #059669; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 8px; margin: 16px 0;">
            Ver lista de compras →
        </a>
        <p style="color: #64748B; font-size: 12px; margin-top: 24px;">
            Boa produção! 🍳
        </p>
    </div>
    """

    text = f"""
    Desperdício Zero

    Olá! Sua produção {production_nome} é amanhã ({production_data}).

    Sua lista de compras está pronta. Confira antes de ir ao mercado:
    https://desperdiciozero.com.br/productions

    Boa produção! 🍳
    """

    return await send_email(
        to=user_email,
        subject=f"Lista de compras pronta para {production_nome}",
        html=html,
        text=text,
    )
