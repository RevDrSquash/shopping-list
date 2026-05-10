"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHouseholdEvents, type HouseholdEventsState } from "@/hooks/useHouseholdEvents";
import {
  addOneOffItem,
  confirmItem,
  createStaple,
  deleteStaple,
  getCurrentUser,
  getShoppingList,
  getStaples,
  listIncomingInvitations,
  logout,
  promoteAllStaples,
  purchaseItem,
  skipItem,
  updateStaple,
  type CurrentUser,
  type Invitation,
  type PromotionResult,
  type ShoppingListItem,
  type Staple,
  type StaplePayload,
} from "@/lib/api";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageMain } from "@/components/layout/PageMain";

type AppShellContextValue = {
  user: CurrentUser;
  items: ShoppingListItem[];
  staples: Staple[];
  incomingInvitations: Invitation[];
  error: string | null;
  pendingItemId: string | null;
  pendingStapleId: string | null;
  isPromoting: boolean;
  householdEvents: HouseholdEventsState;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  addItem: (payload: { name: string; quantity: string }) => Promise<void>;
  confirmListItem: (itemId: string) => Promise<void>;
  skipListItem: (itemId: string) => Promise<void>;
  purchaseListItem: (itemId: string) => Promise<void>;
  createHouseholdStaple: (payload: StaplePayload) => Promise<void>;
  updateHouseholdStaple: (stapleId: string, payload: StaplePayload) => Promise<void>;
  deleteHouseholdStaple: (stapleId: string) => Promise<void>;
  promoteStaples: () => Promise<PromotionResult | null>;
  reloadSession: () => Promise<void>;
};

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [staples, setStaples] = useState<Staple[]>([]);
  const [incomingInvitations, setIncomingInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPromoting, setIsPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [pendingStapleId, setPendingStapleId] = useState<string | null>(null);

  const loadHouseholdData = useCallback(async () => {
    const [shoppingList, householdStaples, invitations] = await Promise.all([
      getShoppingList(),
      getStaples(),
      listIncomingInvitations(),
    ]);
    setItems(shoppingList);
    setStaples(householdStaples);
    setIncomingInvitations(invitations);
  }, []);

  const reloadSession = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (!currentUser) {
        setItems([]);
        setStaples([]);
        setIncomingInvitations([]);
        router.replace("/sign-in");
        return;
      }

      await loadHouseholdData();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load session");
    } finally {
      setIsLoading(false);
    }
  }, [loadHouseholdData, router]);

  useEffect(() => {
    void reloadSession();
  }, [reloadSession]);

  useEffect(() => {
    if (!isLoading && user && incomingInvitations.length > 0 && pathname !== "/invite") {
      router.replace("/invite");
    }
  }, [incomingInvitations.length, isLoading, pathname, router, user]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      await loadHouseholdData();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh household data");
    }
  }, [loadHouseholdData]);

  const householdEvents = useHouseholdEvents({
    enabled: user !== null,
    householdId: user?.household_id ?? null,
    onHouseholdChanged: () => {
      void refresh();
    },
  });

  async function refreshAfterMutation(mutation: () => Promise<unknown>) {
    setError(null);
    try {
      await mutation();
      await loadHouseholdData();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Unable to update household data");
      throw mutationError;
    }
  }

  async function withPendingItem(itemId: string, mutation: (id: string) => Promise<unknown>) {
    setPendingItemId(itemId);
    try {
      await refreshAfterMutation(() => mutation(itemId));
    } finally {
      setPendingItemId(null);
    }
  }

  async function withPendingStaple(stapleId: string, mutation: (id: string) => Promise<unknown>) {
    setPendingStapleId(stapleId);
    try {
      await refreshAfterMutation(() => mutation(stapleId));
    } finally {
      setPendingStapleId(null);
    }
  }

  async function signOut() {
    setError(null);
    try {
      await logout();
      router.replace("/sign-in");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Unable to sign out");
    }
  }

  async function promoteStaples() {
    setIsPromoting(true);
    try {
      const result = await promoteAllStaples();
      await loadHouseholdData();
      return result;
    } catch (promotionError) {
      setError(promotionError instanceof Error ? promotionError.message : "Unable to promote staples");
      return null;
    } finally {
      setIsPromoting(false);
    }
  }

  const value: AppShellContextValue | null = user
    ? {
        user,
        items,
        staples,
        incomingInvitations,
        error,
        pendingItemId,
        pendingStapleId,
        isPromoting,
        householdEvents,
        refresh,
        signOut,
        addItem: (payload) => refreshAfterMutation(() => addOneOffItem(payload)),
        confirmListItem: (itemId) => withPendingItem(itemId, confirmItem),
        skipListItem: (itemId) => withPendingItem(itemId, skipItem),
        purchaseListItem: (itemId) => withPendingItem(itemId, purchaseItem),
        createHouseholdStaple: (payload) => refreshAfterMutation(() => createStaple(payload)),
        updateHouseholdStaple: (stapleId, payload) => withPendingStaple(stapleId, (id) => updateStaple(id, payload)),
        deleteHouseholdStaple: (stapleId) => withPendingStaple(stapleId, deleteStaple),
        promoteStaples,
        reloadSession,
      }
    : null;

  if (isLoading) {
    return (
      <PageMain variant="centered">
        <section className="w-full max-w-page-narrow rounded-xl bg-surface-container-lowest p-6 text-center shadow-card">
          <p className="text-body-md text-on-surface-variant">Loading your household...</p>
        </section>
      </PageMain>
    );
  }

  if (!value) {
    return null;
  }

  return (
    <AppShellContext.Provider value={value}>
      <PageMain variant="app">
        {error ? (
          <p className="mb-4 rounded-xl bg-error-container px-4 py-2 text-label-md text-error" role="alert">
            {error}
          </p>
        ) : null}
        {children}
      </PageMain>
      <BottomNav />
    </AppShellContext.Provider>
  );
}

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error("useAppShell must be used within AppShell");
  }
  return context;
}

export function useAppShellOptional() {
  return useContext(AppShellContext);
}
