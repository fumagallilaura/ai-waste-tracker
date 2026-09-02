from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint for ALB and monitoring."""
    return {"status": "ok", "version": "0.1.0"}
