import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "./BottomNav";

const navigationState = vi.hoisted(() => ({
  pathname: "/list",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("BottomNav", () => {
  it("marks the active tab from the current pathname", () => {
    navigationState.pathname = "/staples";

    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /staples/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /list/i })).not.toHaveAttribute("aria-current");
  });
});
