from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


_REPO_ROOT = Path(__file__).resolve().parents[3]


def _with_psycopg_driver(database_url: str) -> str:
    if database_url.startswith("postgresql://"):
        return f"postgresql+psycopg://{database_url.removeprefix('postgresql://')}"
    return database_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: str = Field(default="production", validation_alias="ENV")
    database_url: str = Field(validation_alias="DATABASE_URL")
    test_database_url: Optional[str] = Field(
        default=None,
        validation_alias="TEST_DATABASE_URL",
    )
    session_secret: str = Field(validation_alias="SESSION_SECRET")
    app_base_url: str = Field(
        default="http://localhost:8080",
        validation_alias="APP_BASE_URL",
    )
    google_oauth_client_id: Optional[str] = Field(
        default=None,
        validation_alias="GOOGLE_OAUTH_CLIENT_ID",
    )
    google_oauth_client_secret: Optional[str] = Field(
        default=None,
        validation_alias="GOOGLE_OAUTH_CLIENT_SECRET",
    )

    @property
    def active_database_url(self) -> str:
        if self.env == "test":
            if not self.test_database_url:
                raise ValueError("TEST_DATABASE_URL is required when ENV=test")
            return _with_psycopg_driver(self.test_database_url)
        return _with_psycopg_driver(self.database_url)

    @property
    def dev_login_enabled(self) -> bool:
        return self.env in {"development", "test"}

    @property
    def google_oauth_enabled(self) -> bool:
        return bool(self.google_oauth_client_id and self.google_oauth_client_secret)

    def validate_production_app_base_url(self) -> None:
        if self.env == "production" and self.app_base_url.startswith("http://localhost"):
            raise ValueError("APP_BASE_URL must be set for production deployments")


@lru_cache
def get_settings() -> Settings:
    return Settings()
