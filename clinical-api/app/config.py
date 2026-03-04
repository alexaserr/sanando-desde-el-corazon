"""
Configuración de clinical-api usando pydantic-settings.
Lee variables de entorno y archivos PEM para JWT RS256.
"""

from functools import lru_cache
from pathlib import Path
from typing import Self

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

    # ── Base de datos ─────────────────────────────────────────
    CLINICAL_DATABASE_URL: str = Field(...)
    AUTH_DATABASE_URL: str = Field(...)
    AUDIT_DATABASE_URL: str = Field(...)

    # Clave de cifrado PII (pgcrypto) — mínimo 32 caracteres
    CLINICAL_DB_PGCRYPTO_KEY: str = Field(..., min_length=32)

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

    # ── Validadores ───────────────────────────────────────────

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
    def validate_key_files_exist(self) -> Self:
        """Verifica que los archivos PEM existen antes de usarlos."""
        private_key_path = Path(self.JWT_PRIVATE_KEY_PATH)
        public_key_path = Path(self.JWT_PUBLIC_KEY_PATH)
        if not private_key_path.exists():
            raise ValueError(f"JWT_PRIVATE_KEY_PATH no encontrado: {private_key_path}")
        if not public_key_path.exists():
            raise ValueError(f"JWT_PUBLIC_KEY_PATH no encontrado: {public_key_path}")
        return self

    # ── Propiedades de conveniencia ───────────────────────────

    @property
    def jwt_private_key(self) -> str:
        """Lee el PEM privado. El singleton @lru_cache garantiza una sola instancia."""
        return Path(self.JWT_PRIVATE_KEY_PATH).read_text(encoding="utf-8").strip()

    @property
    def jwt_public_key(self) -> str:
        """Lee el PEM público. El singleton @lru_cache garantiza una sola instancia."""
        return Path(self.JWT_PUBLIC_KEY_PATH).read_text(encoding="utf-8").strip()

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def cors_origins(self) -> list[str]:
        return [
            o.strip() for o in str(self.CLINICAL_CORS_ORIGINS).split(",") if o.strip()
        ]

    @property
    def docs_url(self) -> str | None:
        """Deshabilita Swagger UI en producción (NOM-004 / seguridad)."""
        return "/docs" if self.CLINICAL_DOCS_ENABLED else None

    @property
    def redoc_url(self) -> str | None:
        return "/redoc" if self.CLINICAL_DOCS_ENABLED else None

    @property
    def openapi_url(self) -> str | None:
        return "/openapi.json" if self.CLINICAL_DOCS_ENABLED else None


@lru_cache
def get_settings() -> Settings:
    """Singleton de configuración — usar como dependencia FastAPI."""
    return Settings()  # type: ignore[call-arg]


# Instancia global para uso directo fuera de DI
settings: Settings = get_settings()
