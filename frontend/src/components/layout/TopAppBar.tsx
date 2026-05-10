"use client";

import type { ReactNode } from "react";
import { AccountMenu } from "@/components/layout/AccountMenu";

type TopAppBarProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function TopAppBar({ title, subtitle, leading, trailing = <AccountMenu /> }: TopAppBarProps) {
  return (
    <header className="sticky top-0 z-20 -mx-5 mb-6 bg-surface/95 px-5 py-4 backdrop-blur">
      <div className="mx-auto flex w-full max-w-page-default items-center gap-4">
        {leading ? <div className="flex h-10 w-10 items-center justify-center">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-headline-lg">{title}</h1>
          {subtitle ? <p className="mt-1 truncate text-label-md text-on-surface-variant">{subtitle}</p> : null}
        </div>
        {trailing ? <div className="flex h-10 w-10 items-center justify-center">{trailing}</div> : null}
      </div>
    </header>
  );
}
