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
  householdId = "household",
  onHouseholdChanged,
}: {
  enabled: boolean;
  householdId?: string | null;
  onHouseholdChanged: () => void;
}) {
  useHouseholdEvents({ enabled, householdId, onHouseholdChanged });
  return null;
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
    render(<TestSubscriber enabled onHouseholdChanged={vi.fn()} />);

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]?.url).toBe("/api/events");
    expect(MockEventSource.instances[0]?.withCredentials).toBe(true);
  });

  it("does not subscribe while signed out", () => {
    const { rerender } = render(<TestSubscriber enabled={false} onHouseholdChanged={vi.fn()} />);

    expect(MockEventSource.instances).toHaveLength(0);

    rerender(<TestSubscriber enabled onHouseholdChanged={vi.fn()} />);

    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("reconnects when the household changes", () => {
    const onHouseholdChanged = vi.fn();
    const { rerender } = render(
      <TestSubscriber enabled householdId="first-household" onHouseholdChanged={onHouseholdChanged} />,
    );
    const firstSource = MockEventSource.instances[0];

    rerender(<TestSubscriber enabled householdId="second-household" onHouseholdChanged={onHouseholdChanged} />);

    expect(firstSource?.close).toHaveBeenCalledTimes(1);
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("refreshes when a household event arrives", () => {
    const onHouseholdChanged = vi.fn();
    render(<TestSubscriber enabled onHouseholdChanged={onHouseholdChanged} />);

    act(() => {
      MockEventSource.instances[0]?.emit("household_changed");
    });

    expect(onHouseholdChanged).toHaveBeenCalledTimes(1);
  });

  it("refreshes when a default message carries a household event payload", () => {
    const onHouseholdChanged = vi.fn();
    render(<TestSubscriber enabled onHouseholdChanged={onHouseholdChanged} />);

    act(() => {
      MockEventSource.instances[0]?.emit("message", "household_changed");
    });

    expect(onHouseholdChanged).toHaveBeenCalledTimes(1);
  });

  it("does not reconnect when only the callback identity changes", () => {
    const { rerender } = render(<TestSubscriber enabled onHouseholdChanged={vi.fn()} />);
    const firstSource = MockEventSource.instances[0];

    rerender(<TestSubscriber enabled onHouseholdChanged={vi.fn()} />);
    rerender(<TestSubscriber enabled onHouseholdChanged={vi.fn()} />);

    expect(MockEventSource.instances).toHaveLength(1);
    expect(firstSource?.close).not.toHaveBeenCalled();
  });

  it("invokes the latest callback when the parent re-renders with a new one", () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const { rerender } = render(<TestSubscriber enabled onHouseholdChanged={firstCallback} />);

    rerender(<TestSubscriber enabled onHouseholdChanged={secondCallback} />);

    act(() => {
      MockEventSource.instances[0]?.emit("household_changed");
    });

    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledTimes(1);
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
