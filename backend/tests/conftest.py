import os
from pathlib import Path
from typing import Generator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, text
from sqlalchemy.orm import Session

os.environ.setdefault("ENV", "test")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")

from app.core.config import get_settings  # noqa: E402
from app.db.models import Household, Membership, ShoppingListItem, Staple, User  # noqa: E402
from app.db.session import get_sessionmaker, reset_database_caches  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture(scope="session")
def alembic_config() -> Config:
    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    return config


@pytest.fixture(scope="session", autouse=True)
def migrated_db(alembic_config: Config) -> Generator[None, None, None]:
    get_settings.cache_clear()
    reset_database_caches()
    settings = get_settings()
    engine = create_engine(settings.test_database_url, isolation_level="AUTOCOMMIT")

    with engine.connect() as connection:
        connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))

    command.upgrade(alembic_config, "head")
    reset_database_caches()

    yield

    engine.dispose()


@pytest.fixture(autouse=True)
def clean_tables(migrated_db: None) -> Generator[None, None, None]:
    yield

    with get_sessionmaker()() as session:
        with session.begin():
            session.execute(delete(ShoppingListItem))
            session.execute(delete(Staple))
            session.execute(delete(Membership))
            session.execute(delete(Household))
            session.execute(delete(User))


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    get_settings.cache_clear()
    reset_database_caches()
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
