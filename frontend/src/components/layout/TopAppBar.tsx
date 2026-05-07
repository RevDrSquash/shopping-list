"use client";

import type { ReactNode } from "react";

type TopAppBarProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function TopAppBar({ title, subtitle, leading, trailing }: TopAppBarProps) {
  return (
    <header className="sticky top-0 z-20 -mx-container-padding mb-lg bg-surface/95 px-container-padding py-md backdrop-blur">
      <div className="mx-auto flex w-full max-w-page-default items-center gap-md">
        {leading ? <div className="flex h-10 w-10 items-center justify-center">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-headline-lg">{title}</h1>
          {subtitle ? <p className="mt-xs truncate text-label-md text-on-surface-variant">{subtitle}</p> : null}
        </div>
        {trailing ? <div className="flex h-10 w-10 items-center justify-center">{trailing}</div> : null}
      </div>
    </header>
  );
}
