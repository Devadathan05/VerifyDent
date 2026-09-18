"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file's location (backend/app/core/config.py)
# so the correct .env is found regardless of which directory uvicorn is run from.
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "VerifyDent API"
    app_env: str = "development"
    debug: bool = True

    # PostgreSQL-ready: point DATABASE_URL at a Postgres instance in prod,
    # falls back to SQLite for zero-setup local development.
    database_url: str = "sqlite:///./verifydent.db"

    # Local dev: Vite dev server default origin. "http://localhost:5173" etc.
    cors_origins: list[str] = ["http://localhost:5173"]

    # Document extraction (MVP).
    # "auto" -> Tesseract OCR if available, otherwise a safe unavailable response.
    # "ocr"  -> force Tesseract OCR (errors if the binary is missing).
    # "mock" -> deterministic fictional sample output.
    extraction_provider: str = "auto"

    # Absolute path to the Tesseract binary (used with the "ocr" provider).
    tesseract_cmd: str = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

    # Maximum accepted upload size in MB for insurance documents.
    max_upload_size_mb: int = 10

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()