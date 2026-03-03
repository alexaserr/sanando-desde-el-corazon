"""
Configuración de clinical-api usando pydantic-settings.
Lee variables de entorno y archivos PEM para JWT RS256.
"""
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── General ──────────────────────────────────────────────
    ENVIRONMENT: str = Field(default="development")
    LOG_LEVEL: str = Field(default="INFO")

    # ── JWT RS256 ─────────────────────────────────────────────
    JWT_ALGORITHM: str = Field(default="RS256")
    JWT_PRIVATE_KEY_PATH: Path = Field(default=Path("/run/secrets/jwt_private.pem"))
    JWT_PUBLIC_KEY_PATH: Path = Field(default=Path("/run/secrets/jwt_public.pem"))
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=15)
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=30)

    # Contenido de las claves (se cargan en model_validator)
    _jwt_private_key: str = ""
    _jwt_public_key: str = ""

    # ── Base de datos ─────────────────────────────────────────
    CLINICAL_DATABASE_URL: str = Field(...)
    AUTH_DATABASE_URL: str = Field(...)
    AUDIT_DATABASE_URL: str = Field(...)

    # Clave de cifrado PII (pgcrypto) — mínimo 32 caracteres
    CLINICAL_DB_PGCRYPTO_KEY: Annotated[str, Field(min_length=32)] = Field(...)

    # ── Redis ─────────────────────────────────────────────────
    REDIS_URL: str = Field(...)
    REDIS_DB_SESSIONS: int = Field(default=0)
    REDIS_DB_CACHE: int = Field(default=1)
    REDIS_DB_RATE_LIMIT: int = Field(default=2)

    # ── MinIO ─────────────────────────────────────────────────
    MINIO_ENDPOINT: str = Field(...)
    MINIO_ROOT_USER: str = Field(...)
    MINIO_ROOT_PASSWORD: str = Field(...)
    MINIO_USE_SSL: bool = Field(default=False)
    MINIO_BUCKET_CLINICAL: str = Field(default="clinical-files")

    # ── API ───────────────────────────────────────────────────
    CLINICAL_API_PORT: int = Field(default=8001)
    CLINICAL_CORS_ORIGINS: str = Field(default="")
    CLINICAL_DOCS_ENABLED: bool = Field(default=False)

    # ── SMTP (notificaciones) ─────────────────────────────────
    SMTP_HOST: str = Field(default="")
    SMTP_PORT: int = Field(default=587)
    SMTP_USER: str = Field(default="")
    SMTP_PASSWORD: str = Field(default="")
    SMTP_FROM_NAME: str = Field(default="Sanando desde el Corazón")
    SMTP_TLS: bool = Field(default=True)

    @field_validator("JWT_ALGORITHM")
    @classmethod
    def validate_algorithm(cls, v: str) -> str:
        if v != "RS256":
            raise ValueError("JWT_ALGORITHM debe ser RS256 — nunca HS256")
        return v

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        allowed = {"development", "staging", "production"}
        if v not in allowed:
            raise ValueError(f"ENVIRONMENT debe ser uno de: {allowed}")
        return v

    @model_validator(mode="after")
    def load_jwt_keys(self) -> "Settings":
        """Carga los archivos PEM al inicializar la configuración."""
        try:
            self._jwt_private_key = self.JWT_PRIVATE_KEY_PATH.read_text().strip()
        except FileNotFoundError as e:
            raise ValueError(f"No se encontró JWT_PRIVATE_KEY_PATH: {e}") from e

        try:
            self._jwt_public_key = self.JWT_PUBLIC_KEY_PATH.read_text().strip()
        except FileNotFoundError as e:
            raise ValueError(f"No se encontró JWT_PUBLIC_KEY_PATH: {e}") from e

        return self

    # ── Propiedades de conveniencia ───────────────────────────

    @property
    def jwt_private_key(self) -> str:
        return self._jwt_private_key

    @property
    def jwt_public_key(self) -> str:
        return self._jwt_public_key

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CLINICAL_CORS_ORIGINS.split(",") if o.strip()]

    @property
    def docs_url(self) -> str | None:
        """Deshabilita Swagger UI en producción (NOM-004 / seguridad)."""
        return None if self.is_production else "/docs"

    @property
    def redoc_url(self) -> str | None:
        return None if self.is_production else "/redoc"

    @property
    def openapi_url(self) -> str | None:
        return None if self.is_production else "/openapi.json"


@lru_cache
def get_settings() -> Settings:
    """Singleton de configuración — usar como dependencia FastAPI."""
    return Settings()


# Instancia global para uso directo fuera de DI
settings: Settings = get_settings()
