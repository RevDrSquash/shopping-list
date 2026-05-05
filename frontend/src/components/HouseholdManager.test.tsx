import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser, Invitation } from "@/lib/api";
import * as api from "@/lib/api";
import { HouseholdManager } from "./HouseholdManager";

vi.mock("@/lib/api", () => ({
  listIncomingInvitations: vi.fn(),
  listOutgoingInvitations: vi.fn(),
  inviteUser: vi.fn(),
  cancelInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
  leaveHousehold: vi.fn(),
}));

const currentUser: CurrentUser = {
  id: "current-user",
  email: "me@example.com",
  household_id: "my-household",
  household_member_count: 2,
};

const incomingInvitation: Invitation = {
  id: "incoming-invite",
  household_id: "roommates-household",
  household_name: "Roommates",
  user_id: "current-user",
  user_email: "me@example.com",
  status: "pending",
  created_at: "2026-05-04T00:00:00Z",
};

const outgoingInvitation: Invitation = {
  id: "outgoing-invite",
  household_id: "my-household",
  household_name: "My household",
  user_id: "friend-user",
  user_email: "friend@example.com",
  status: "pending",
  created_at: "2026-05-04T00:00:00Z",
};

function renderHouseholdManager(overrides: Partial<React.ComponentProps<typeof HouseholdManager>> = {}) {
  const props = {
    currentUser,
    onMembershipChanged: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  render(<HouseholdManager {...props} />);
  return props;
}

describe("HouseholdManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listIncomingInvitations).mockResolvedValue([incomingInvitation]);
    vi.mocked(api.listOutgoingInvitations).mockResolvedValue([outgoingInvitation]);
    vi.mocked(api.inviteUser).mockResolvedValue({
      ...outgoingInvitation,
      id: "new-invite",
      user_email: "new@example.com",
    });
    vi.mocked(api.cancelInvitation).mockResolvedValue(undefined);
    vi.mocked(api.acceptInvitation).mockResolvedValue(undefined);
    vi.mocked(api.declineInvitation).mockResolvedValue(undefined);
    vi.mocked(api.leaveHousehold).mockResolvedValue(undefined);
  });

  it("renders pending invitations and accepts one", async () => {
    const user = userEvent.setup();
    const props = renderHouseholdManager();

    const incomingSection = await screen.findByRole("heading", { name: /pending invitations to you/i });
    expect(within(incomingSection.closest("section") as HTMLElement).getByText(/household: roommates/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /accept/i }));

    await waitFor(() => {
      expect(api.acceptInvitation).toHaveBeenCalledWith("incoming-invite");
      expect(props.onMembershipChanged).toHaveBeenCalled();
    });
  });

  it("submits the invite form and prepends the outgoing invite", async () => {
    const user = userEvent.setup();
    vi.mocked(api.listOutgoingInvitations).mockResolvedValue([]);
    renderHouseholdManager();

    await screen.findByRole("heading", { name: /invite someone/i });
    await user.type(screen.getByLabelText(/email/i), "  new@example.com  ");
    await user.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() => {
      expect(api.inviteUser).toHaveBeenCalledWith("new@example.com");
    });
    expect(await screen.findByText("new@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveValue("");
  });

  it("disables leave when the current user is the sole member", async () => {
    renderHouseholdManager({
      currentUser: {
        ...currentUser,
        household_member_count: 1,
      },
    });

    const leaveButton = await screen.findByRole("button", { name: /leave household/i });

    expect(leaveButton).toBeDisabled();
    expect(leaveButton).toHaveAttribute("title", "You are the only member");
  });

  it("confirms before leaving and reloads membership state", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const props = renderHouseholdManager();

    await user.click(await screen.findByRole("button", { name: /leave household/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith("Leave this household and create your own household?");
      expect(api.leaveHousehold).toHaveBeenCalled();
      expect(props.onMembershipChanged).toHaveBeenCalled();
    });
  });
});
