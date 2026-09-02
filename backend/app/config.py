from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "Desperdício Zero API"
    debug: bool = False
    api_prefix: str = "/api"

    # Database
    database_url: str = "postgresql+asyncpg://desperdicio:password@localhost:5432/desperdicio_zero"

    # JWT
    jwt_algorithm: str = "RS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7
    jwt_private_key_path: str = "/etc/desperdicio-zero/jwt/private_key.pem"
    jwt_public_key_path: str = "/etc/desperdicio-zero/jwt/public_key.pem"

    # Mercado Pago
    mercado_pago_access_token: str = ""
    mercado_pago_sandbox: bool = True

    # Email (Resend)
    resend_api_key: str = ""
    email_from: str = "noreply@desperdiciozero.com.br"

    # Rate Limiting
    rate_limit_login_per_minute: int = 5

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "https://desperdiciozero.com.br"]

    model_config = {"env_prefix": "APP_", "env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
