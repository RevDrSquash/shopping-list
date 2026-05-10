"use client";

import { useEffect, useRef, useState } from "react";
import { useAppShellOptional } from "@/components/AppShell";

export function AccountMenu() {
  const shell = useAppShellOptional();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!shell) {
    return null;
  }

  const { user, signOut } = shell;
  const displayName = user.email.split("@")[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="grid min-h-10 w-10 place-items-center rounded-full bg-surface-container-low p-0 text-on-surface-variant"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          account_circle
        </span>
      </button>
      {isOpen ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl bg-surface-container-lowest p-4 shadow-card"
        >
          <div className="grid gap-1">
            <p className="truncate text-body-md font-semibold">{displayName}</p>
            <p className="truncate text-label-md text-on-surface-variant">{user.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-surface-container-low px-4 text-label-md text-on-surface"
            onClick={() => {
              setIsOpen(false);
              void signOut();
            }}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              logout
            </span>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
