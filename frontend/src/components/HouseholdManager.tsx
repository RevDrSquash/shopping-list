"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  acceptInvitation,
  cancelInvitation,
  declineInvitation,
  inviteUser,
  leaveHousehold,
  listIncomingInvitations,
  listOutgoingInvitations,
  type CurrentUser,
  type Invitation,
} from "@/lib/api";

type HouseholdManagerProps = {
  currentUser: CurrentUser;
  onMembershipChanged: () => Promise<void>;
};

export function HouseholdManager({ currentUser, onMembershipChanged }: HouseholdManagerProps) {
  const [incomingInvitations, setIncomingInvitations] = useState<Invitation[]>([]);
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
      const [incoming, outgoing] = await Promise.all([listIncomingInvitations(), listOutgoingInvitations()]);
      setIncomingInvitations(incoming);
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

  async function handleAccept(invitationId: string) {
    await handleMembershipChange(invitationId, acceptInvitation, "Unable to accept invitation");
  }

  async function handleDecline(invitationId: string) {
    await handleMembershipChange(invitationId, declineInvitation, "Unable to decline invitation");
  }

  async function handleMembershipChange(
    invitationId: string,
    mutation: (invitationId: string) => Promise<void>,
    fallbackMessage: string,
  ) {
    setError(null);
    setPendingActionId(invitationId);
    try {
      await mutation(invitationId);
      await onMembershipChanged();
    } catch (membershipError) {
      setError(membershipError instanceof Error ? membershipError.message : fallbackMessage);
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
    <section className="card household-card" aria-labelledby="household-management-title">
      <div className="section-header">
        <div>
          <p className="eyebrow">Household</p>
          <h2 id="household-management-title">Household management</h2>
          <p className="muted">Invite people to this shopping list or move back to your own household.</p>
        </div>
        <span className="pill">{currentUser.household_member_count}</span>
      </div>

      {isLoadingInvitations ? <p className="empty-state">Loading invitations...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!isLoadingInvitations && incomingInvitations.length > 0 ? (
        <section className="household-section" aria-labelledby="incoming-invitations-title">
          <h3 id="incoming-invitations-title">Pending invitations to you</h3>
          <ul className="item-list">
            {incomingInvitations.map((invitation) => (
              <li className="shopping-item" key={invitation.id}>
                <InvitationDetails invitation={invitation} />
                <div className="item-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={pendingActionId === invitation.id}
                    onClick={() => void handleAccept(invitation.id)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={pendingActionId === invitation.id}
                    onClick={() => void handleDecline(invitation.id)}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="household-section" aria-labelledby="invite-someone-title">
        <h3 id="invite-someone-title">Invite someone</h3>
        <form className="invite-form" onSubmit={handleInvite}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="friend@example.com"
              required
            />
          </label>
          <button type="submit" disabled={isInviting}>
            {isInviting ? "Sending..." : "Send invite"}
          </button>
        </form>

        {outgoingInvitations.length === 0 ? (
          <p className="empty-state">No outgoing invitations right now.</p>
        ) : (
          <ul className="item-list" aria-label="Outgoing invitations">
            {outgoingInvitations.map((invitation) => (
              <li className="shopping-item" key={invitation.id}>
                <InvitationDetails invitation={invitation} />
                <div className="item-actions">
                  <button
                    type="button"
                    className="ghost"
                    disabled={pendingActionId === invitation.id}
                    onClick={() => void handleCancel(invitation.id)}
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="household-section leave-household" aria-labelledby="leave-household-title">
        <div>
          <h3 id="leave-household-title">Leave household</h3>
          <p className="muted">You will keep copies of the staples and shopping list in a new household.</p>
        </div>
        <button
          type="button"
          className="ghost"
          disabled={isSoleMember || isLeaving}
          title={isSoleMember ? "You are the only member" : undefined}
          onClick={() => void handleLeave()}
        >
          {isLeaving ? "Leaving..." : "Leave household"}
        </button>
      </section>
    </section>
  );
}

function InvitationDetails({ invitation }: { invitation: Invitation }) {
  return (
    <div>
      <div className="item-title-row">
        <h3>{invitation.user_email}</h3>
        <span className="tag">{invitation.status}</span>
      </div>
      <p className="meta">Household: {invitation.household_name}</p>
    </div>
  );
}
