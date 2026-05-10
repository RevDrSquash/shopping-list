"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  cancelInvitation,
  inviteUser,
  leaveHousehold,
  listOutgoingInvitations,
  type CurrentUser,
  type Invitation,
} from "@/lib/api";
import { TopAppBar } from "@/components/layout/TopAppBar";

type HouseholdManagerProps = {
  currentUser: CurrentUser;
  onMembershipChanged: () => Promise<void>;
};

export function HouseholdManager({ currentUser, onMembershipChanged }: HouseholdManagerProps) {
  const [outgoingInvitations, setOutgoingInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const isSoleMember = currentUser.household_member_count <= 1;

  const loadInvitations = useCallback(async () => {
    setError(null);
    setIsLoadingInvitations(true);
    try {
      const outgoing = await listOutgoingInvitations();
      setOutgoingInvitations(outgoing);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load household invitations");
    } finally {
      setIsLoadingInvitations(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations, currentUser.household_id]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required");
      return;
    }

    setIsInviting(true);
    try {
      const invitation = await inviteUser(trimmedEmail);
      setOutgoingInvitations((existingInvitations) => [invitation, ...existingInvitations]);
      setEmail("");
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to send invitation");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleCancel(invitationId: string) {
    setError(null);
    setPendingActionId(invitationId);
    try {
      await cancelInvitation(invitationId);
      setOutgoingInvitations((existingInvitations) =>
        existingInvitations.filter((invitation) => invitation.id !== invitationId),
      );
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel invitation");
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleLeave() {
    setError(null);
    if (isSoleMember) {
      return;
    }

    const confirmed = window.confirm("Leave this household and create your own household?");
    if (!confirmed) {
      return;
    }

    setIsLeaving(true);
    try {
      await leaveHousehold();
      await onMembershipChanged();
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : "Unable to leave household");
    } finally {
      setIsLeaving(false);
    }
  }

  return (
    <>
      <TopAppBar title="Household" />

      <section className="grid gap-xl" aria-labelledby="household-management-title">
        <h2 id="household-management-title" className="sr-only">
          Household management
        </h2>

        {error ? <p className="rounded-xl bg-error-container p-sm text-label-md text-error">{error}</p> : null}

        <section aria-labelledby="members-title">
          <div className="mb-md flex items-center justify-between">
            <h3 id="members-title" className="text-headline-md">
              Members
            </h3>
            <span className="rounded-full bg-primary-fixed px-sm py-xs text-label-sm text-primary">
              {currentUser.household_member_count}
            </span>
          </div>
          <div className="grid gap-sm">
            <MemberCard email={currentUser.email} isCurrentUser />
            {currentUser.household_member_count > 1 ? (
              <div className="rounded-xl border border-dashed border-outline-variant p-md text-label-md text-on-surface-variant">
                {currentUser.household_member_count - 1} other{" "}
                {currentUser.household_member_count - 1 === 1 ? "member" : "members"} in this household
              </div>
            ) : null}
          </div>

          {!isLoadingInvitations && outgoingInvitations.length > 0 ? (
            <section className="mt-lg" aria-labelledby="pending-invites-title">
              <h4 id="pending-invites-title" className="mb-sm text-label-md text-on-surface-variant">
                Pending invites
              </h4>
              <ul className="grid gap-sm" aria-label="Outgoing invitations">
                {outgoingInvitations.map((invitation) => (
                  <li
                    className="flex items-center justify-between gap-md rounded-xl bg-surface-container-lowest p-md shadow-card"
                    key={invitation.id}
                  >
                    <InvitationDetails invitation={invitation} />
                    <button
                      type="button"
                      className="min-h-10 rounded-full bg-surface-container-low px-md text-label-md text-on-surface"
                      disabled={pendingActionId === invitation.id}
                      onClick={() => void handleCancel(invitation.id)}
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>

        <section aria-labelledby="invite-someone-title">
          <h3 id="invite-someone-title" className="mb-md text-headline-md">
            Invite by email
          </h3>
          <form className="rounded-xl bg-surface-container-lowest p-md shadow-card" onSubmit={handleInvite}>
            <label className="grid gap-xs text-label-md text-on-surface-variant">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="friend@example.com"
                required
              />
            </label>
            <button
              type="submit"
              className="mt-md min-h-12 w-full rounded-full bg-primary px-md text-label-md text-white"
              disabled={isInviting}
            >
              {isInviting ? "Sending..." : "Send invite"}
            </button>
            <p className="mt-sm text-label-sm text-on-surface-variant">
              They can accept from their pending invitation screen.
            </p>
          </form>
        </section>

        <section aria-labelledby="leave-household-title">
          <h3 id="leave-household-title" className="mb-md text-headline-md">
            Leave household
          </h3>
          <div className="rounded-xl border border-error p-md">
            <p className="mb-md text-body-md text-on-surface-variant">
              You will keep copies of the staples and shopping list in a new household.
            </p>
            <button
              type="button"
              className="min-h-12 w-full rounded-full border border-error bg-transparent px-md text-label-md text-error"
              disabled={isSoleMember || isLeaving}
              title={isSoleMember ? "You are the only member" : undefined}
              onClick={() => void handleLeave()}
            >
              {isLeaving ? "Leaving..." : "Leave this household"}
            </button>
          </div>
        </section>
      </section>
    </>
  );
}

function MemberCard({ email, isCurrentUser }: { email: string; isCurrentUser: boolean }) {
  return (
    <article className="flex items-center gap-md rounded-xl bg-surface-container-lowest p-md shadow-card">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary-fixed text-label-md text-secondary">
        {initialsFor(email)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-sm">
          <h4 className="truncate text-body-md font-semibold">{email.split("@")[0]}</h4>
          {isCurrentUser ? (
            <span className="rounded-full bg-primary-fixed px-sm py-xs text-label-sm text-primary">You</span>
          ) : null}
        </div>
        <p className="truncate text-label-md text-on-surface-variant">{email}</p>
      </div>
    </article>
  );
}

function initialsFor(email: string): string {
  return email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function InvitationDetails({ invitation }: { invitation: Invitation }) {
  return (
    <div className="min-w-0">
      <h4 className="truncate text-body-md font-semibold">{invitation.user_email}</h4>
      <p className="text-label-sm text-on-surface-variant">Household: {invitation.household_name}</p>
    </div>
  );
}
