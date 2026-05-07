"use client";

import { useAppShell } from "@/components/AppShell";
import { HouseholdManager } from "@/components/HouseholdManager";

export default function SettingsPage() {
  const { user, reloadSession, signOut } = useAppShell();

  return <HouseholdManager currentUser={user} onMembershipChanged={reloadSession} onSignOut={signOut} />;
}
