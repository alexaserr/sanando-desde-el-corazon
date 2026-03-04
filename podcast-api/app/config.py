"""
Configuración de podcast-api usando pydantic-settings.
Podcast de Sanando desde el Corazón.
"""
from functools import lru_cache
from pathlib import Path
from typing import Self

from pydantic import Field, PrivateAttr, field_validator, model_validator
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

    _jwt_private_key: str = PrivateAttr(default="")
    _jwt_public_key: str = PrivateAttr(default="")

    # ── Base de datos ─────────────────────────────────────────
    PODCAST_DATABASE_URL: str = Field(...)
    AUDIT_DATABASE_URL: str = Field(...)

    # ── Redis ─────────────────────────────────────────────────
    REDIS_URL: str = Field(...)
    REDIS_DB_CACHE: int = Field(default=1)

    # ── MinIO (almacenamiento de episodios) ───────────────────
    MINIO_ENDPOINT: str = Field(...)
    MINIO_ROOT_USER: str = Field(...)
    MINIO_ROOT_PASSWORD: str = Field(...)
    MINIO_USE_SSL: bool = Field(default=False)
    MINIO_BUCKET_PODCAST: str = Field(default="podcast-media")

    # ── Podcast / RSS ─────────────────────────────────────────
    PODCAST_TITLE: str = Field(default="Sanando desde el Corazón")
    PODCAST_BASE_URL: str = Field(default="https://sanandodesdeelcorazon.com/podcast")

    # ── API ───────────────────────────────────────────────────
    PODCAST_API_PORT: int = Field(default=8003)
    PODCAST_CORS_ORIGINS: str = Field(default="")
    PODCAST_DOCS_ENABLED: bool = Field(default=False)

    # Tamaño máximo de episodio aceptado por la API (bytes)
    MAX_EPISODE_SIZE_MB: int = Field(default=500)

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
    def load_jwt_keys(self) -> Self:
        try:
            self._jwt_private_key = self.JWT_PRIVATE_KEY_PATH.read_text(encoding="utf-8").strip()
        except FileNotFoundError as e:
            raise ValueError(f"No se encontró JWT_PRIVATE_KEY_PATH: {e}") from e
        try:
            self._jwt_public_key = self.JWT_PUBLIC_KEY_PATH.read_text(encoding="utf-8").strip()
        except FileNotFoundError as e:
            raise ValueError(f"No se encontró JWT_PUBLIC_KEY_PATH: {e}") from e
        return self

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
        return [o.strip() for o in self.PODCAST_CORS_ORIGINS.split(",") if o.strip()]

    @property
    def docs_url(self) -> str | None:
        return "/docs" if self.PODCAST_DOCS_ENABLED else None

    @property
    def redoc_url(self) -> str | None:
        return "/redoc" if self.PODCAST_DOCS_ENABLED else None

    @property
    def openapi_url(self) -> str | None:
        return "/openapi.json" if self.PODCAST_DOCS_ENABLED else None

    @property
    def max_episode_size_bytes(self) -> int:
        return self.MAX_EPISODE_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings: Settings = get_settings()
