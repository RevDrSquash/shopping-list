import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  it("renders needs_review and confirmed items in one list", () => {
    render(
      <ShoppingList
        items={items}
        pendingItemId={null}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
        onPurchase={vi.fn()}
      />,
    );

    const list = screen.getByRole("list", { name: /shopping items/i });

    expect(within(list).getByText("Milk")).toBeInTheDocument();
    expect(within(list).getByText("Bananas")).toBeInTheDocument();
    expect(screen.getByText(/tap to confirm/i)).toBeInTheDocument();
  });

  it("calls confirm from a needs-review row and purchase from the checkbox", async () => {
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

    await user.click(screen.getAllByRole("button", { name: /milk/i })[0]);
    await user.click(screen.getByRole("button", { name: /mark bananas purchased/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("review-item");
      expect(onPurchase).toHaveBeenCalledWith("confirmed-item");
    });
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("calls remove when a row is swiped left", async () => {
    const onSkip = vi.fn().mockResolvedValue(undefined);

    render(
      <ShoppingList
        items={items}
        pendingItemId={null}
        onConfirm={vi.fn()}
        onSkip={onSkip}
        onPurchase={vi.fn()}
      />,
    );

    const row = screen.getByText("Milk").closest("li");
    expect(row).not.toBeNull();

    fireEvent.pointerDown(row as HTMLElement, { clientX: 120 });
    fireEvent.pointerUp(row as HTMLElement, { clientX: 30 });

    await waitFor(() => {
      expect(onSkip).toHaveBeenCalledWith("review-item");
    });
  });
});
