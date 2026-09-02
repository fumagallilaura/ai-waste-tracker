from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import get_settings
from app.core.rate_limit import limiter
from app.db.session import engine
from app.models import Base

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist (dev only)
    if settings.debug:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown: dispose engine
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
from app.routers import (  # noqa: E402
    auth,
    dashboard,
    health,
    lgpd,
    payments,
    productions,
    recipes,
    shopping,
    waste,
)

PREFIX = settings.api_prefix

app.include_router(auth.router, prefix=f"{PREFIX}/auth", tags=["auth"])
app.include_router(recipes.router, prefix=f"{PREFIX}/recipes", tags=["recipes"])
app.include_router(productions.router, prefix=f"{PREFIX}/productions", tags=["productions"])
app.include_router(shopping.router, prefix=f"{PREFIX}/productions", tags=["productions"])
app.include_router(waste.router, prefix=f"{PREFIX}/productions", tags=["productions"])
app.include_router(dashboard.router, prefix=f"{PREFIX}/dashboard", tags=["dashboard"])
app.include_router(payments.router, prefix=f"{PREFIX}/payments", tags=["payments"])
app.include_router(lgpd.router, prefix=f"{PREFIX}/lgpd", tags=["lgpd"])
app.include_router(health.router, prefix=f"{settings.api_prefix}", tags=["health"])
