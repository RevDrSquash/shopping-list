"use client";

import { useAppShell } from "@/components/AppShell";
import { TopAppBar } from "@/components/layout/TopAppBar";
import { StaplesManager } from "@/components/StaplesManager";

export default function StaplesPage() {
  const {
    staples,
    pendingStapleId,
    isPromoting,
    createHouseholdStaple,
    updateHouseholdStaple,
    deleteHouseholdStaple,
    promoteStaples,
  } = useAppShell();

  return (
    <>
      <TopAppBar title="Staples" subtitle="Items added to your list automatically" />
      <StaplesManager
        staples={staples}
        pendingStapleId={pendingStapleId}
        isPromoting={isPromoting}
        onCreate={createHouseholdStaple}
        onUpdate={updateHouseholdStaple}
        onDelete={deleteHouseholdStaple}
        onPromoteAll={promoteStaples}
      />
    </>
  );
}
