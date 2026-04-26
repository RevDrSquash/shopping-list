import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ShoppingListItem } from "@/lib/api";
import { ShoppingList } from "./ShoppingList";

const items: ShoppingListItem[] = [
  {
    id: "review-item",
    household_id: "household",
    staple_id: "staple",
    name: "Milk",
    quantity: "2L",
    status: "needs_review",
    created_at: "2026-04-26T00:00:00Z",
    updated_at: "2026-04-26T00:00:00Z",
  },
  {
    id: "confirmed-item",
    household_id: "household",
    staple_id: null,
    name: "Bananas",
    quantity: "6",
    status: "confirmed",
    created_at: "2026-04-26T00:00:00Z",
    updated_at: "2026-04-26T00:00:00Z",
  },
];

describe("ShoppingList", () => {
  it("renders needs_review and confirmed items in separate sections", () => {
    render(
      <ShoppingList
        items={items}
        pendingItemId={null}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
        onPurchase={vi.fn()}
      />,
    );

    const reviewSection = screen.getByRole("region", { name: /needs review/i });
    const confirmedSection = screen.getByRole("region", { name: /confirmed/i });

    expect(within(reviewSection).getByText("Milk")).toBeInTheDocument();
    expect(within(reviewSection).queryByText("Bananas")).not.toBeInTheDocument();
    expect(within(confirmedSection).getByText("Bananas")).toBeInTheDocument();
  });

  it("calls the expected actions for confirm, skip, and purchase", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onSkip = vi.fn().mockResolvedValue(undefined);
    const onPurchase = vi.fn().mockResolvedValue(undefined);

    render(
      <ShoppingList
        items={items}
        pendingItemId={null}
        onConfirm={onConfirm}
        onSkip={onSkip}
        onPurchase={onPurchase}
      />,
    );

    await user.click(screen.getByRole("button", { name: /confirm/i }));
    await user.click(screen.getByRole("button", { name: /skip/i }));
    await user.click(screen.getByRole("button", { name: /purchased/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("review-item");
      expect(onSkip).toHaveBeenCalledWith("review-item");
      expect(onPurchase).toHaveBeenCalledWith("confirmed-item");
    });
  });
});
