import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddOneOffItem } from "./AddOneOffItem";

describe("AddOneOffItem", () => {
  it("adds a confirmed one-off item payload and clears the form", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(<AddOneOffItem onAdd={onAdd} />);

    await user.type(screen.getByLabelText(/name/i), "  Bananas  ");
    await user.type(screen.getByLabelText(/quantity/i), "  6  ");
    await user.click(screen.getByRole("button", { name: /add item/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({ name: "Bananas", quantity: "6" });
    });
    expect(screen.getByLabelText(/name/i)).toHaveValue("");
    expect(screen.getByLabelText(/quantity/i)).toHaveValue("");
  });

  it("requires a non-blank name", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(<AddOneOffItem onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /add item/i }));

    expect(onAdd).not.toHaveBeenCalled();
  });
});
