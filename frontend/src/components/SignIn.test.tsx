import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignIn } from "./SignIn";

const baseConfig = {
  dev_login_enabled: true,
  google_oauth_enabled: true,
};

describe("SignIn", () => {
  it("renders the Google sign-in link when OAuth is enabled", () => {
    render(<SignIn config={baseConfig} onLogin={vi.fn()} />);

    const googleLink = screen.getByRole("link", { name: /sign in with google/i });

    expect(googleLink).toHaveAttribute("href", "/api/auth/google/login");
  });

  it("submits the entered email through the dev login flow", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue(undefined);

    render(<SignIn config={baseConfig} onLogin={onLogin} />);

    const emailInput = screen.getByLabelText(/email/i);
    await user.clear(emailInput);
    await user.type(emailInput, "test@example.com");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith("test@example.com");
    });
  });

  it("hides the dev bypass form when it is disabled", () => {
    render(<SignIn config={{ dev_login_enabled: false, google_oauth_enabled: true }} onLogin={vi.fn()} />);

    expect(screen.getByRole("link", { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /development bypass/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("shows login errors", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockRejectedValue(new Error("Development login is disabled"));

    render(<SignIn config={baseConfig} onLogin={onLogin} />);

    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText("Development login is disabled")).toBeInTheDocument();
  });

  it("shows an empty state when no sign-in methods are enabled", () => {
    render(<SignIn config={{ dev_login_enabled: false, google_oauth_enabled: false }} onLogin={vi.fn()} />);

    expect(screen.getByText(/no sign-in methods are enabled/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign in with google/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });
});
