import json
import logging
import queue
import threading
from collections import defaultdict
from dataclasses import dataclass
from typing import AsyncIterator, DefaultDict, Optional
from uuid import UUID

import anyio
from starlette.requests import Request


HOUSEHOLD_CHANGED_EVENT = "household_changed"
KEEPALIVE_SECONDS = 15.0
logger = logging.getLogger("uvicorn.error")


@dataclass(frozen=True)
class HouseholdEventSubscriber:
    household_id: UUID
    events: "queue.Queue[dict[str, str]]"


class HouseholdEventManager:
    def __init__(self) -> None:
        self._subscribers: DefaultDict[UUID, set[HouseholdEventSubscriber]] = defaultdict(set)
        self._lock = threading.Lock()

    def subscribe(self, household_id: UUID) -> HouseholdEventSubscriber:
        subscriber = HouseholdEventSubscriber(household_id=household_id, events=queue.Queue())
        with self._lock:
            self._subscribers[household_id].add(subscriber)
            subscriber_count = len(self._subscribers[household_id])
        logger.info("SSE subscriber added household_id=%s subscriber_count=%s", household_id, subscriber_count)
        return subscriber

    def unsubscribe(self, subscriber: HouseholdEventSubscriber) -> None:
        with self._lock:
            subscribers = self._subscribers.get(subscriber.household_id)
            if subscribers is None:
                return

            subscribers.discard(subscriber)
            subscriber_count = len(subscribers)
            if not subscribers:
                del self._subscribers[subscriber.household_id]
        logger.info(
            "SSE subscriber removed household_id=%s subscriber_count=%s",
            subscriber.household_id,
            subscriber_count,
        )

    def broadcast_household_changed(self, household_id: UUID) -> None:
        self.broadcast(household_id, {"type": HOUSEHOLD_CHANGED_EVENT})

    def broadcast(self, household_id: UUID, event: dict[str, str]) -> None:
        with self._lock:
            subscribers = tuple(self._subscribers.get(household_id, ()))

        logger.info(
            "SSE broadcast household_id=%s event_type=%s subscriber_count=%s",
            household_id,
            event.get("type"),
            len(subscribers),
        )
        for subscriber in subscribers:
            subscriber.events.put_nowait(event)

    def subscriber_count(self, household_id: Optional[UUID] = None) -> int:
        with self._lock:
            if household_id is not None:
                return len(self._subscribers.get(household_id, ()))
            return sum(len(subscribers) for subscribers in self._subscribers.values())


household_events = HouseholdEventManager()


async def household_event_stream(
    request: Request,
    household_id: UUID,
    manager: HouseholdEventManager = household_events,
    keepalive_seconds: float = KEEPALIVE_SECONDS,
) -> AsyncIterator[str]:
    subscriber = manager.subscribe(household_id)
    try:
        while True:
            if await request.is_disconnected():
                break

            try:
                event = await anyio.to_thread.run_sync(
                    lambda: subscriber.events.get(timeout=keepalive_seconds),
                )
            except queue.Empty:
                yield ": keepalive\n\n"
                continue

            logger.info("SSE event yielded household_id=%s event_type=%s", household_id, event.get("type"))
            yield _format_sse_event(event)
    finally:
        manager.unsubscribe(subscriber)


def _format_sse_event(event: dict[str, str]) -> str:
    return f"data: {json.dumps(event)}\n\n"
