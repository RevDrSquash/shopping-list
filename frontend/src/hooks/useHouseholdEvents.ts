"use client";

import { useEffect, useRef, useState } from "react";
import { getHouseholdEventsUrl } from "@/lib/api";

export type HouseholdEventsStatus = "idle" | "connecting" | "open" | "error";

export type HouseholdEventsState = {
  status: HouseholdEventsStatus;
  receivedCount: number;
};

type UseHouseholdEventsOptions = {
  enabled: boolean;
  householdId: string | null;
  onHouseholdChanged: () => void;
};

export function useHouseholdEvents({
  enabled,
  householdId,
  onHouseholdChanged,
}: UseHouseholdEventsOptions): HouseholdEventsState {
  const [status, setStatus] = useState<HouseholdEventsStatus>("idle");
  const [receivedCount, setReceivedCount] = useState(0);

  // Keep the latest callback in a ref so changes to its identity don't
  // tear down and re-open the EventSource on every parent re-render.
  const onHouseholdChangedRef = useRef(onHouseholdChanged);
  useEffect(() => {
    onHouseholdChangedRef.current = onHouseholdChanged;
  }, [onHouseholdChanged]);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setReceivedCount(0);
      return;
    }

    setStatus("connecting");
    const events = new EventSource(getHouseholdEventsUrl(), { withCredentials: true });
    const handleOpen = () => setStatus("open");
    const handleError = () => setStatus("error");
    const handleHouseholdChanged = (event: Event) => {
      if (event instanceof MessageEvent) {
        try {
          const payload = JSON.parse(event.data) as { type?: string };
          if (payload.type !== "household_changed") {
            return;
          }
        } catch {
          return;
        }
      }

      setReceivedCount((count) => count + 1);
      onHouseholdChangedRef.current();
    };

    events.addEventListener("open", handleOpen);
    events.addEventListener("error", handleError);
    events.addEventListener("message", handleHouseholdChanged);
    events.addEventListener("household_changed", handleHouseholdChanged);

    return () => {
      events.removeEventListener("open", handleOpen);
      events.removeEventListener("error", handleError);
      events.removeEventListener("message", handleHouseholdChanged);
      events.removeEventListener("household_changed", handleHouseholdChanged);
      events.close();
    };
  }, [enabled, householdId]);

  return { status, receivedCount };
}
