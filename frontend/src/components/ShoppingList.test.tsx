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
        isCompletingShopping={false}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
        onToggleInCart={vi.fn()}
        onCompleteShopping={vi.fn()}
        onAddItem={vi.fn()}
      />,
    );

    const list = screen.getByRole("list", { name: /shopping items/i });

    expect(within(list).getByText("Milk")).toBeInTheDocument();
    expect(within(list).getByText("Bananas")).toBeInTheDocument();
    expect(within(list).getByText("Milk").closest("div")).toHaveClass("border-dashed");
  });

  it("calls confirm from a needs-review row and toggles in-cart from the checkbox", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onSkip = vi.fn().mockResolvedValue(undefined);
    const onToggleInCart = vi.fn().mockResolvedValue(undefined);

    render(
      <ShoppingList
        items={items}
        pendingItemId={null}
        isCompletingShopping={false}
        onConfirm={onConfirm}
        onSkip={onSkip}
        onToggleInCart={onToggleInCart}
        onCompleteShopping={vi.fn()}
        onAddItem={vi.fn()}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: /milk/i })[0]);
    await user.click(screen.getByRole("button", { name: /mark bananas in cart/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("review-item");
      expect(onToggleInCart).toHaveBeenCalledWith("confirmed-item");
    });
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("shows a complete shopping button when items are in cart", async () => {
    const user = userEvent.setup();
    const onCompleteShopping = vi.fn().mockResolvedValue(undefined);

    render(
      <ShoppingList
        items={[{ ...items[1], status: "in_cart" }]}
        pendingItemId={null}
        isCompletingShopping={false}
        onConfirm={vi.fn()}
        onSkip={vi.fn()}
        onToggleInCart={vi.fn()}
        onCompleteShopping={onCompleteShopping}
        onAddItem={vi.fn()}
      />,
    );

    expect(screen.getByText("Bananas")).toHaveClass("line-through");
    await user.click(screen.getByRole("button", { name: /complete shopping/i }));

    await waitFor(() => {
      expect(onCompleteShopping).toHaveBeenCalledOnce();
    });
  });

  it("calls remove when a row is swiped left", async () => {
    const onSkip = vi.fn().mockResolvedValue(undefined);

    render(
      <ShoppingList
        items={items}
        pendingItemId={null}
        isCompletingShopping={false}
        onConfirm={vi.fn()}
        onSkip={onSkip}
        onToggleInCart={vi.fn()}
        onCompleteShopping={vi.fn()}
        onAddItem={vi.fn()}
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
