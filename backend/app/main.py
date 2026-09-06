import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.responses import JSONResponse

from app.config import get_settings
from app.core.observability import _allow, observe_request
from app.core.rate_limit import limiter
from app.db.session import engine

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # O schema é controlado pelo Alembic (o container roda `alembic upgrade head`
    # no startup). Nada de create_all aqui: ele corria depois das edições de código
    # (uvicorn --reload) e criava tabelas novas antes das migrations, quebrando-as.
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


@app.middleware("http")
async def observability_and_limits(request, call_next):
    """Rate limit global por IP + métricas + log estruturado de request."""
    started = time.perf_counter()

    if request.url.path.startswith(settings.api_prefix):
        ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
            request.client.host if request.client else "unknown"
        )
        if not _allow(ip):
            return JSONResponse(
                {"detail": "Muitas requisições. Tente novamente em instantes."},
                status_code=429,
                headers={"Retry-After": "30"},
            )

    response = await call_next(request)
    duration_ms = (time.perf_counter() - started) * 1000
    observe_request(request, response.status_code, duration_ms)

    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    return response

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
    admin,
    auth,
    clients,
    dashboard,
    guest,
    health,
    insights,
    lgpd,
    productions,
    recipes,
    shopping,
    stock,
    waste,
)

PREFIX = settings.api_prefix

app.include_router(auth.router, prefix=f"{PREFIX}/auth", tags=["auth"])
app.include_router(recipes.router, prefix=f"{PREFIX}/recipes", tags=["recipes"])
app.include_router(clients.router, prefix=f"{PREFIX}/clients", tags=["clients"])
app.include_router(stock.router, prefix=f"{PREFIX}/stock", tags=["stock"])
app.include_router(guest.router, prefix=f"{PREFIX}/guest", tags=["guest"])
app.include_router(productions.router, prefix=f"{PREFIX}/productions", tags=["productions"])
app.include_router(shopping.router, prefix=f"{PREFIX}/productions", tags=["productions"])
app.include_router(waste.router, prefix=f"{PREFIX}/productions", tags=["productions"])
app.include_router(dashboard.router, prefix=f"{PREFIX}/dashboard", tags=["dashboard"])
app.include_router(insights.router, prefix=f"{PREFIX}/insights", tags=["insights"])
app.include_router(admin.router, prefix=f"{PREFIX}", tags=["admin"])
app.include_router(lgpd.router, prefix=f"{PREFIX}/lgpd", tags=["lgpd"])
app.include_router(health.router, prefix=f"{settings.api_prefix}", tags=["health"])
