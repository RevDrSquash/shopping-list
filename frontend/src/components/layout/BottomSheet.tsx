"use client";

import { useEffect, useRef, type ReactNode } from "react";

type BottomSheetProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function BottomSheet({ open, title, children, onClose }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const firstFocusableElement = sheetRef.current?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    firstFocusableElement?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !sheetRef.current) {
        return;
      }

      const focusableElements = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (focusableElements.length === 0) {
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previousActiveElement?.focus();
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 min-h-0 w-full rounded-none bg-black/30 p-0"
        aria-label="Close sheet"
        onClick={onClose}
      />
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottom-sheet-title"
        className="relative max-h-[92vh] w-[min(100vw,32rem)] min-w-0 overflow-y-auto rounded-t-[2rem] bg-surface-container-lowest px-container-padding pb-[max(24px,env(safe-area-inset-bottom))] pt-sm shadow-card sm:mb-0 sm:rounded-[2rem]"
      >
        <div className="mx-auto mb-md h-1 w-12 rounded-full bg-outline-variant" />
        <div className="mb-lg flex items-center justify-between gap-md">
          <h2 id="bottom-sheet-title" className="text-headline-lg">
            {title}
          </h2>
          <button
            type="button"
            className="grid min-h-10 w-10 place-items-center rounded-full bg-surface-container-low text-on-surface"
            aria-label="Close"
            onClick={onClose}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
