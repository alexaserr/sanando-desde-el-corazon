"""
Configuración centralizada para los scripts de migración Notion → SDC.
Lee variables de entorno / .env usando pydantic-settings.
"""
from pathlib import Path
from typing import Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class MigrationSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    # ── Base de datos clínica ──────────────────────────────────
    CLINICAL_DATABASE_URL: str = Field(...)
    CLINICAL_DB_PGCRYPTO_KEY: str = Field(..., min_length=32)

    # ── Notion API ─────────────────────────────────────────────
    NOTION_API_TOKEN: str = Field(...)

    # ── MinIO ──────────────────────────────────────────────────
    MINIO_ENDPOINT: str = Field(default="localhost:9000")
    MINIO_ACCESS_KEY: str = Field(...)
    MINIO_SECRET_KEY: str = Field(...)
    MINIO_BUCKET_CLIENTS: str = Field(default="sdc-clients")
    MINIO_SECURE: bool = Field(default=False)   # True en producción

    # ── Directorios de datos ───────────────────────────────────
    DATA_RAW_DIR: Path = Field(default=Path("data/raw"))
    DATA_CLEAN_DIR: Path = Field(default=Path("data/clean"))
    REPORTS_DIR: Path = Field(default=Path("reports"))

    # ── Logging ────────────────────────────────────────────────
    LOG_LEVEL: str = Field(default="INFO")

    @model_validator(mode="after")
    def ensure_dirs(self) -> Self:
        Path(self.DATA_RAW_DIR).mkdir(parents=True, exist_ok=True)
        Path(self.DATA_CLEAN_DIR).mkdir(parents=True, exist_ok=True)
        Path(self.REPORTS_DIR).mkdir(parents=True, exist_ok=True)
        return self


settings: MigrationSettings = MigrationSettings()  # type: ignore[call-arg]
