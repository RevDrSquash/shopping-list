"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/list", label: "List", icon: "shopping_cart" },
  { href: "/staples", label: "Staples", icon: "inventory_2" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 pb-[max(12px,env(safe-area-inset-bottom))] pt-2"
      aria-label="Primary"
    >
      <div className="mx-auto grid w-full max-w-page-default grid-cols-3 gap-2 border-t border-outline-variant bg-surface-container-lowest/95 px-4 py-2 shadow-card backdrop-blur sm:rounded-full sm:border">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center justify-center gap-1 rounded-full px-2 py-2 text-label-sm transition ${
                isActive
                  ? "bg-primary-container text-on-primary-container"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
