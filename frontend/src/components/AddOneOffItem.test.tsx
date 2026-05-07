import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddOneOffItem } from "./AddOneOffItem";

describe("AddOneOffItem", () => {
  it("adds a confirmed one-off item payload and clears the form", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);

    render(<AddOneOffItem open onClose={vi.fn()} onAdd={onAdd} />);

    await user.type(screen.getByLabelText(/name/i), "  Bananas  ");
    await user.type(screen.getByLabelText(/quantity/i), "  6  ");
    await user.click(screen.getByRole("button", { name: /add to list/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({ name: "Bananas", quantity: "6" });
    });
    expect(screen.getByLabelText(/name/i)).toHaveValue("");
    expect(screen.getByLabelText(/quantity/i)).toHaveValue("");
  });

  it("requires a non-blank name", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(<AddOneOffItem open onClose={vi.fn()} onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /add to list/i }));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("closes when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<AddOneOffItem open onClose={onClose} onAdd={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
