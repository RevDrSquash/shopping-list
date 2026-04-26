from sqlalchemy import create_engine, inspect

from app.core.config import get_settings


def test_initial_migration_creates_auth_tables(migrated_db: None) -> None:
    engine = create_engine(get_settings().test_database_url)
    inspector = inspect(engine)

    assert {
        "users",
        "households",
        "memberships",
        "staples",
        "shopping_list_items",
    }.issubset(set(inspector.get_table_names()))

    engine.dispose()
