import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DevLogin } from "./DevLogin";

describe("DevLogin", () => {
  it("submits the entered email through the dev login flow", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue(undefined);

    render(<DevLogin onLogin={onLogin} />);

    const emailInput = screen.getByLabelText(/email/i);
    await user.clear(emailInput);
    await user.type(emailInput, "test@example.com");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith("test@example.com");
    });
  });

  it("shows login errors", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockRejectedValue(new Error("Development login is disabled"));

    render(<DevLogin onLogin={onLogin} />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Development login is disabled")).toBeInTheDocument();
  });
});
