from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings
from app.db.session import engine
from app.models import Base

settings = get_settings()

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
from app.routers import auth, recipes, productions, shopping, waste, dashboard, payments, health, lgpd  # noqa: E402

app.include_router(auth.router, prefix=f"{settings.api_prefix}/auth", tags=["auth"])
app.include_router(recipes.router, prefix=f"{settings.api_prefix}/recipes", tags=["recipes"])
app.include_router(productions.router, prefix=f"{settings.api_prefix}/productions", tags=["productions"])
app.include_router(shopping.router, prefix=f"{settings.api_prefix}/productions", tags=["shopping"])
app.include_router(waste.router, prefix=f"{settings.api_prefix}/productions", tags=["waste"])
app.include_router(dashboard.router, prefix=f"{settings.api_prefix}/dashboard", tags=["dashboard"])
app.include_router(payments.router, prefix=f"{settings.api_prefix}/payments", tags=["payments"])
app.include_router(lgpd.router, prefix=f"{settings.api_prefix}/lgpd", tags=["lgpd"])
app.include_router(health.router, prefix=f"{settings.api_prefix}", tags=["health"])
