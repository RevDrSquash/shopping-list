from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: str = Field(default="development", validation_alias="ENV")
    database_url: str = Field(
        default="postgresql+psycopg://shopping_list:CHANGE_ME@localhost:5432/shopping_list",
        validation_alias="DATABASE_URL",
    )
    test_database_url: str = Field(
        default="postgresql+psycopg://shopping_list:CHANGE_ME@localhost:5432/shopping_list_test",
        validation_alias="TEST_DATABASE_URL",
    )
    session_secret: str = Field(
        default="development-session-secret",
        validation_alias="SESSION_SECRET",
    )

    @property
    def active_database_url(self) -> str:
        if self.env == "test":
            return self.test_database_url
        return self.database_url

    @property
    def dev_login_enabled(self) -> bool:
        return self.env in {"development", "test"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
