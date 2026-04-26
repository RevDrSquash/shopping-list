import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Staple } from "@/lib/api";
import { StaplesManager } from "./StaplesManager";

const staples: Staple[] = [
  {
    id: "coffee",
    household_id: "household",
    name: "Coffee",
    quantity: "1 bag",
    interval_days: 14,
    last_resolved_at: null,
    eligible_at: "2026-05-01T00:00:00Z",
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
  },
];

function renderStaplesManager(overrides: Partial<React.ComponentProps<typeof StaplesManager>> = {}) {
  const props = {
    staples,
    pendingStapleId: null,
    isPromoting: false,
    onCreate: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onPromoteAll: vi.fn().mockResolvedValue({ promoted_count: 1 }),
    ...overrides,
  };

  render(<StaplesManager {...props} />);
  return props;
}

describe("StaplesManager", () => {
  it("creates a staple payload and clears the form", async () => {
    const user = userEvent.setup();
    const props = renderStaplesManager({ staples: [] });

    await user.type(screen.getByLabelText(/staple name/i), "  Milk  ");
    await user.type(screen.getByLabelText(/^quantity$/i), "  2L  ");
    await user.clear(screen.getByLabelText(/interval days/i));
    await user.type(screen.getByLabelText(/interval days/i), "7");
    await user.click(screen.getByRole("button", { name: /add staple/i }));

    await waitFor(() => {
      expect(props.onCreate).toHaveBeenCalledWith({
        name: "Milk",
        quantity: "2L",
        interval_days: 7,
      });
    });
    expect(screen.getByLabelText(/staple name/i)).toHaveValue("");
  });

  it("edits and deletes existing staples", async () => {
    const user = userEvent.setup();
    const props = renderStaplesManager();

    const stapleItem = screen.getByText("Coffee").closest("li");
    expect(stapleItem).not.toBeNull();

    await user.click(within(stapleItem as HTMLElement).getByRole("button", { name: /edit/i }));
    await user.clear(screen.getByLabelText(/name for coffee/i));
    await user.type(screen.getByLabelText(/name for coffee/i), "Espresso beans");
    await user.clear(screen.getByLabelText(/quantity for coffee/i));
    await user.type(screen.getByLabelText(/quantity for coffee/i), "2 bags");
    await user.clear(screen.getByLabelText(/interval days for coffee/i));
    await user.type(screen.getByLabelText(/interval days for coffee/i), "21");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(props.onUpdate).toHaveBeenCalledWith("coffee", {
        name: "Espresso beans",
        quantity: "2 bags",
        interval_days: 21,
      });
    });

    await user.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(props.onDelete).toHaveBeenCalledWith("coffee");
    });
  });

  it("promotes all inactive staples for review", async () => {
    const user = userEvent.setup();
    const props = renderStaplesManager();

    await user.click(screen.getByRole("button", { name: /review all staples now/i }));

    await waitFor(() => {
      expect(props.onPromoteAll).toHaveBeenCalled();
    });
    expect(await screen.findByText("1 staple was added to review.")).toBeInTheDocument();
  });
});
