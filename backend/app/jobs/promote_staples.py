from app.db.session import get_engine, get_sessionmaker
from app.services.promotion import promote_due_staples


def main() -> None:
    sessionmaker = get_sessionmaker()
    with sessionmaker() as db:
        promoted_count = promote_due_staples(db)
        db.commit()

    get_engine().dispose()
    print(f"Promoted {promoted_count} staple(s).")


if __name__ == "__main__":
    main()
