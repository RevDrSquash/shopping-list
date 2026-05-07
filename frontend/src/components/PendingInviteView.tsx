"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageMain } from "@/components/layout/PageMain";
import {
  acceptInvitation,
  declineInvitation,
  getCurrentUser,
  listIncomingInvitations,
  logout,
  type Invitation,
} from "@/lib/api";

export function PendingInviteView() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<"accept" | "decline" | "sign-out" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvitations() {
      setError(null);
      setIsLoading(true);
      try {
        const [currentUser, incomingInvitations] = await Promise.all([getCurrentUser(), listIncomingInvitations()]);
        if (!currentUser) {
          router.replace("/sign-in");
          return;
        }
        if (incomingInvitations.length === 0) {
          router.replace("/list");
          return;
        }
        setInvitations(incomingInvitations);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load invitation");
      } finally {
        setIsLoading(false);
      }
    }

    void loadInvitations();
  }, [router]);

  async function handleInvitation(invitationId: string, action: "accept" | "decline") {
    setError(null);
    setPendingAction(action);
    try {
      if (action === "accept") {
        await acceptInvitation(invitationId);
      } else {
        await declineInvitation(invitationId);
      }
      router.replace("/list");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Unable to ${action} invitation`);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSignOut() {
    setError(null);
    setPendingAction("sign-out");
    try {
      await logout();
      router.replace("/sign-in");
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Unable to sign out");
      setPendingAction(null);
    }
  }

  const invitation = invitations[0];

  if (isLoading) {
    return (
      <PageMain variant="centered">
        <p className="text-body-md text-on-surface-variant">Loading invitation...</p>
      </PageMain>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <PageMain variant="flow">
      <header className="mb-xl text-center">
        <p className="text-headline-lg">Household</p>
      </header>

      <section className="flex flex-1 flex-col text-center" aria-labelledby="invite-title">
        <div className="mx-auto mb-lg grid h-24 w-24 place-items-center rounded-full bg-primary-fixed text-primary">
          <span className="material-symbols-outlined text-[52px]" aria-hidden="true">
            mail
          </span>
        </div>
        <p className="text-label-md text-on-surface-variant">You have a household invitation</p>
        <h1 id="invite-title" className="mt-sm text-headline-xl">
          You have been invited
        </h1>
        <p className="mx-auto mt-md max-w-xs text-body-md text-on-surface-variant">
          {invitation.user_email} invited you to join {invitation.household_name}.
        </p>

        <div className="mt-xl grid gap-sm rounded-xl bg-surface-container-lowest p-md text-left shadow-card">
          <InfoRow icon="merge_type" text="Your current staples and list will be merged into the new household." />
          <InfoRow icon="delete_outline" text="Duplicate invitations are cleared after you decide." />
        </div>

        {invitations.length > 1 ? (
          <section className="mt-lg text-left" aria-label="Additional invitations">
            <h2 className="mb-sm text-label-md text-on-surface-variant">Other invitations</h2>
            <ul className="grid gap-sm">
              {invitations.slice(1).map((extraInvitation) => (
                <li key={extraInvitation.id} className="rounded-xl bg-surface-container-low p-md text-label-md">
                  {extraInvitation.household_name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {error ? <p className="mt-md rounded-xl bg-error-container p-sm text-label-md text-error">{error}</p> : null}

        <div className="mt-auto grid gap-sm pt-xl">
          <button
            type="button"
            className="min-h-14 rounded-full bg-primary px-md text-label-md text-white"
            disabled={pendingAction !== null}
            onClick={() => void handleInvitation(invitation.id, "accept")}
          >
            {pendingAction === "accept" ? "Accepting..." : "Accept invite"}
          </button>
          <button
            type="button"
            className="min-h-14 rounded-full border border-outline-variant bg-transparent px-md text-label-md text-on-surface"
            disabled={pendingAction !== null}
            onClick={() => void handleInvitation(invitation.id, "decline")}
          >
            {pendingAction === "decline" ? "Declining..." : "Decline"}
          </button>
          <button
            type="button"
            className="min-h-12 rounded-full bg-transparent px-md text-label-md text-on-surface-variant"
            disabled={pendingAction !== null}
            onClick={() => void handleSignOut()}
          >
            {pendingAction === "sign-out" ? "Signing out..." : "Decide later - sign out"}
          </button>
        </div>
      </section>
    </PageMain>
  );
}

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex gap-sm">
      <span className="material-symbols-outlined text-primary" aria-hidden="true">
        {icon}
      </span>
      <p className="text-label-md text-on-surface-variant">{text}</p>
    </div>
  );
}
