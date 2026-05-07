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
  it("opens the create sheet and creates a staple", async () => {
    const user = userEvent.setup();
    const props = renderStaplesManager({ staples: [] });

    await user.click(screen.getByRole("button", { name: /add staple/i }));
    await user.type(screen.getByLabelText(/name/i), "  Milk  ");
    await user.type(screen.getByLabelText(/quantity/i), "  2L  ");
    await user.click(screen.getByRole("button", { name: /save staple/i }));

    await waitFor(() => {
      expect(props.onCreate).toHaveBeenCalledWith({
        name: "Milk",
        quantity: "2L",
        interval_days: 7,
      });
    });
  });

  it("uses the stepper while editing and only shows delete in edit mode", async () => {
    const user = userEvent.setup();
    const props = renderStaplesManager();

    const stapleItem = screen.getByText("Coffee").closest("li");
    expect(stapleItem).not.toBeNull();
    expect(screen.queryByRole("button", { name: /delete staple/i })).not.toBeInTheDocument();

    await user.click(within(stapleItem as HTMLElement).getByRole("button", { name: /actions for coffee/i }));
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(screen.getByRole("button", { name: /delete staple/i })).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/name/i));
    await user.type(screen.getByLabelText(/name/i), "Espresso beans");
    await user.clear(screen.getByLabelText(/quantity/i));
    await user.type(screen.getByLabelText(/quantity/i), "2 bags");
    await user.click(screen.getByRole("button", { name: /increase interval/i }));
    await user.click(screen.getByRole("button", { name: /save staple/i }));

    await waitFor(() => {
      expect(props.onUpdate).toHaveBeenCalledWith("coffee", {
        name: "Espresso beans",
        quantity: "2 bags",
        interval_days: 21,
      });
    });
  });

  it("deletes a staple from the edit sheet", async () => {
    const user = userEvent.setup();
    const props = renderStaplesManager();

    await user.click(screen.getByRole("button", { name: /actions for coffee/i }));
    await user.click(screen.getByRole("button", { name: /^edit$/i }));

    await user.click(screen.getByRole("button", { name: /delete staple/i }));

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
