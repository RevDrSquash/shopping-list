"use client";

import { useEffect, useRef } from "react";
import { getHouseholdEventsUrl } from "@/lib/api";

type UseHouseholdEventsOptions = {
  enabled: boolean;
  householdId: string | null;
  onHouseholdChanged: () => void;
};

export function useHouseholdEvents({ enabled, householdId, onHouseholdChanged }: UseHouseholdEventsOptions): void {
  // Keep the latest callback in a ref so changes to its identity don't
  // tear down and re-open the EventSource on every parent re-render.
  const onHouseholdChangedRef = useRef(onHouseholdChanged);
  useEffect(() => {
    onHouseholdChangedRef.current = onHouseholdChanged;
  }, [onHouseholdChanged]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const events = new EventSource(getHouseholdEventsUrl(), { withCredentials: true });
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

      onHouseholdChangedRef.current();
    };

    events.addEventListener("message", handleHouseholdChanged);
    events.addEventListener("household_changed", handleHouseholdChanged);

    return () => {
      events.removeEventListener("message", handleHouseholdChanged);
      events.removeEventListener("household_changed", handleHouseholdChanged);
      events.close();
    };
  }, [enabled, householdId]);
}
