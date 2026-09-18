"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
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

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()