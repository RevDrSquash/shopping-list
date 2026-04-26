import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.models import ShoppingListItem
from app.db.session import get_sessionmaker
from app.services.staples import create_staple


def test_promotion_command_runs_and_exits_against_test_database(client) -> None:
    login_response = client.get("/dev/login", params={"email": "person@example.com"})
    assert login_response.status_code == 200
    household_id = client.get("/me").json()["household_id"]

    with get_sessionmaker()() as db:
        create_staple(
            db,
            household_id,
            "Coffee",
            "1 bag",
            7,
            now=datetime.now(timezone.utc) - timedelta(days=10),
        )
        db.commit()

    env = os.environ.copy()
    env["ENV"] = "test"
    result = subprocess.run(
        [sys.executable, "-m", "app.jobs.promote_staples"],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )

    with get_sessionmaker()() as db:
        item_count = len(list(db.scalars(select(ShoppingListItem))))

    assert result.returncode == 0
    assert "Promoted 1 staple(s)." in result.stdout
    assert item_count == 1
