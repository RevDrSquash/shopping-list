import queue
from uuid import UUID, uuid4

import anyio
from fastapi.testclient import TestClient

from app.services.auth import provision_user_for_email
from app.services.events import (
    HOUSEHOLD_CHANGED_EVENT,
    HouseholdEventManager,
    _format_sse_event,
    household_event_stream,
    household_events,
)
from app.db.session import get_sessionmaker


def login(client: TestClient, email: str = "person@example.com") -> str:
    response = client.get("/dev/login", params={"email": email})
    assert response.status_code == 200
    me_response = client.get("/me")
    assert me_response.status_code == 200
    return me_response.json()["household_id"]


def test_events_requires_authentication(client: TestClient) -> None:
    response = client.get("/events")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_household_write_broadcasts_event_to_subscriber(client: TestClient) -> None:
    household_id = UUID(login(client))
    subscriber = household_events.subscribe(household_id)

    try:
        response = client.post(
            "/shopping-list/items",
            json={"name": "Bananas", "quantity": "6"},
        )

        assert response.status_code == 201
        assert subscriber.events.get(timeout=1) == {"type": HOUSEHOLD_CHANGED_EVENT}
    finally:
        household_events.unsubscribe(subscriber)


def test_events_are_scoped_to_subscriber_household(client: TestClient) -> None:
    household_id = UUID(login(client))
    with get_sessionmaker()() as db:
        other_user = provision_user_for_email(db, "other@example.com")
        other_household_id = other_user.memberships[0].household_id
        db.commit()

    current_subscriber = household_events.subscribe(household_id)
    other_subscriber = household_events.subscribe(other_household_id)

    try:
        response = client.post(
            "/shopping-list/items",
            json={"name": "Bananas", "quantity": "6"},
        )

        assert response.status_code == 201
        assert current_subscriber.events.get(timeout=1) == {"type": HOUSEHOLD_CHANGED_EVENT}
        try:
            other_subscriber.events.get_nowait()
        except queue.Empty:
            pass
        else:
            raise AssertionError("other household subscriber received an event")
    finally:
        household_events.unsubscribe(current_subscriber)
        household_events.unsubscribe(other_subscriber)


def test_event_stream_disconnect_cleanup_removes_subscriber() -> None:
    household_id = uuid4()
    manager = HouseholdEventManager()

    class DisconnectedRequest:
        async def is_disconnected(self) -> bool:
            return True

    async def run() -> None:
        stream = household_event_stream(DisconnectedRequest(), household_id, manager=manager, keepalive_seconds=0.01)

        try:
            await stream.__anext__()
        except StopAsyncIteration:
            pass
        else:
            raise AssertionError("disconnected event stream should stop without yielding")

        assert manager.subscriber_count(household_id) == 0
        assert manager.subscriber_count() == 0

    anyio.run(run)


def test_sse_event_format_uses_default_message_payload() -> None:
    assert _format_sse_event({"type": HOUSEHOLD_CHANGED_EVENT}) == 'data: {"type": "household_changed"}\n\n'
