"use client";

import { useEffect, useState } from "react";
import { getHouseholdEventsUrl } from "@/lib/api";

export type HouseholdEventsStatus = "idle" | "connecting" | "open" | "error";

export type HouseholdEventsState = {
  status: HouseholdEventsStatus;
  receivedCount: number;
};

type UseHouseholdEventsOptions = {
  enabled: boolean;
  onHouseholdChanged: () => void;
};

export function useHouseholdEvents({ enabled, onHouseholdChanged }: UseHouseholdEventsOptions): HouseholdEventsState {
  const [status, setStatus] = useState<HouseholdEventsStatus>("idle");
  const [receivedCount, setReceivedCount] = useState(0);

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
      onHouseholdChanged();
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
  }, [enabled, onHouseholdChanged]);

  return { status, receivedCount };
}
