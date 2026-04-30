import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHouseholdEvents } from "./useHouseholdEvents";

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly close = vi.fn();
  readonly url: string;
  readonly withCredentials: boolean;
  private readonly listeners = new Map<string, Set<EventListener>>();

  constructor(url: string | URL, init?: EventSourceInit) {
    this.url = url.toString();
    this.withCredentials = init?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener as EventListener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.get(type)?.delete(listener as EventListener);
  }

  emit(type: string, payloadType = type): void {
    const event = new MessageEvent(type, { data: JSON.stringify({ type: payloadType }) });
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

function TestSubscriber({
  enabled,
  onHouseholdChanged,
}: {
  enabled: boolean;
  onHouseholdChanged: () => void;
}) {
  const events = useHouseholdEvents({ enabled, onHouseholdChanged });
  return (
    <p>
      {events.status}:{events.receivedCount}
    </p>
  );
}

describe("useHouseholdEvents", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens a credentialed EventSource when enabled", () => {
    const { getByText } = render(<TestSubscriber enabled onHouseholdChanged={vi.fn()} />);

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]?.url).toBe("/api/events");
    expect(MockEventSource.instances[0]?.withCredentials).toBe(true);
    expect(getByText("connecting:0")).toBeInTheDocument();
  });

  it("reports the connection status", () => {
    const { getByText } = render(<TestSubscriber enabled onHouseholdChanged={vi.fn()} />);

    act(() => {
      MockEventSource.instances[0]?.emit("open");
    });
    expect(getByText("open:0")).toBeInTheDocument();

    act(() => {
      MockEventSource.instances[0]?.emit("error");
    });
    expect(getByText("error:0")).toBeInTheDocument();
  });

  it("does not subscribe while signed out", () => {
    const { rerender } = render(<TestSubscriber enabled={false} onHouseholdChanged={vi.fn()} />);

    expect(MockEventSource.instances).toHaveLength(0);

    rerender(<TestSubscriber enabled onHouseholdChanged={vi.fn()} />);

    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("refreshes when a household event arrives", () => {
    const onHouseholdChanged = vi.fn();
    const { getByText } = render(<TestSubscriber enabled onHouseholdChanged={onHouseholdChanged} />);

    act(() => {
      MockEventSource.instances[0]?.emit("household_changed");
    });

    expect(onHouseholdChanged).toHaveBeenCalledTimes(1);
    expect(getByText("connecting:1")).toBeInTheDocument();
  });

  it("refreshes when a default message carries a household event payload", () => {
    const onHouseholdChanged = vi.fn();
    const { getByText } = render(<TestSubscriber enabled onHouseholdChanged={onHouseholdChanged} />);

    act(() => {
      MockEventSource.instances[0]?.emit("message", "household_changed");
    });

    expect(onHouseholdChanged).toHaveBeenCalledTimes(1);
    expect(getByText("connecting:1")).toBeInTheDocument();
  });

  it("removes the listener and closes the connection on cleanup", () => {
    const onHouseholdChanged = vi.fn();
    const { rerender, unmount } = render(<TestSubscriber enabled onHouseholdChanged={onHouseholdChanged} />);
    const source = MockEventSource.instances[0];

    rerender(<TestSubscriber enabled={false} onHouseholdChanged={onHouseholdChanged} />);

    expect(source?.close).toHaveBeenCalledTimes(1);
    source?.emit("household_changed");
    expect(onHouseholdChanged).not.toHaveBeenCalled();

    rerender(<TestSubscriber enabled onHouseholdChanged={onHouseholdChanged} />);
    const secondSource = MockEventSource.instances[1];

    unmount();

    expect(secondSource?.close).toHaveBeenCalledTimes(1);
  });
});
