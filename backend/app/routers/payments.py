from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import CheckoutRequest, CheckoutResponse
from app.services import payment_service

router = APIRouter()


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    data: CheckoutRequest,
    user: User = Depends(get_current_user),
):
    """Create a Mercado Pago checkout preference."""
    try:
        result = await payment_service.create_preference(user, data.plan)
        return CheckoutResponse(
            preference_id=result["id"],
            init_point=result["init_point"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")


@router.post("/webhook", status_code=status.HTTP_204_NO_CONTENT)
async def payment_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Mercado Pago webhook notifications."""
    body = await request.body()
    headers = dict(request.headers)

    # Verify signature (skip in dev)
    x_signature = headers.get("x-signature", "")
    if x_signature and not payment_service.verify_webhook_signature(body, x_signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    data = await request.json()
    event_type = data.get("type")
    event_data = data.get("data", {})

    if event_type == "payment":
        payment_id = event_data.get("id")
        if not payment_id:
            return None

        # Fetch payment details
        try:
            payment_info = await payment_service.get_payment_info(str(payment_id))
        except Exception:
            return None

        status = payment_info.get("status")
        external_ref = payment_info.get("external_reference")

        if not external_ref:
            return None

        try:
            user_id = uuid.UUID(external_ref)
        except ValueError:
            return None

        if status == "approved":
            await payment_service.activate_plan(user_id, db)
        elif status in ["rejected", "cancelled"]:
            await payment_service.cancel_plan(user_id, db)

    return None
