from functools import lru_cache

from pydantic_settings import BaseSettings


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

    # Google OAuth (login social). Vazio = botão desabilitado.
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"
    frontend_url: str = "http://localhost:3000"

    # Rate Limiting
    rate_limit_login_per_minute: int = 5
    rate_limit_guest_per_minute: int = 60
    # teto global por IP para toda a API (anti-abuso)
    rate_limit_default_per_minute: int = 240

    # Observabilidade/analytics: token para endpoints administrativos
    admin_token: str = ""

    # IA para gerar receitas: qualquer API OpenAI-compatible
    # (OpenAI, Groq, OpenRouter, proxy da Cursor, etc.)
    ai_api_key: str = ""
    ai_base_url: str = "https://api.openai.com/v1"
    ai_model: str = "gpt-4o-mini"

    # Cookies (Secure só em produção HTTPS)
    cookie_secure: bool = False

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "https://desperdiciozero.com.br"]

    model_config = {"env_prefix": "APP_", "env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
