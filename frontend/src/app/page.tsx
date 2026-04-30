"use client";

import { useCallback, useEffect, useState } from "react";
import { AddOneOffItem } from "@/components/AddOneOffItem";
import { DevLogin } from "@/components/DevLogin";
import { ShoppingList } from "@/components/ShoppingList";
import { StaplesManager } from "@/components/StaplesManager";
import { useHouseholdEvents } from "@/hooks/useHouseholdEvents";
import {
  addOneOffItem,
  confirmItem,
  createStaple,
  deleteStaple,
  devLogin,
  getCurrentUser,
  getShoppingList,
  getStaples,
  promoteAllStaples,
  purchaseItem,
  skipItem,
  updateStaple,
  type CurrentUser,
  type Staple,
  type StaplePayload,
  type ShoppingListItem,
} from "@/lib/api";

export default function Home() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [staples, setStaples] = useState<Staple[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPromoting, setIsPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [pendingStapleId, setPendingStapleId] = useState<string | null>(null);

  const loadAppData = useCallback(async () => {
    const [shoppingList, householdStaples] = await Promise.all([getShoppingList(), getStaples()]);
    setItems(shoppingList);
    setStaples(householdStaples);
  }, []);

  const loadSession = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        await loadAppData();
      } else {
        setItems([]);
        setStaples([]);
      }
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Unable to load session");
    } finally {
      setIsLoading(false);
    }
  }, [loadAppData]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const refreshHouseholdData = useCallback(() => {
    void loadAppData().catch((refreshError) => {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh shopping list");
    });
  }, [loadAppData]);

  const householdEvents = useHouseholdEvents({
    enabled: user !== null,
    onHouseholdChanged: refreshHouseholdData,
  });

  async function handleLogin(email: string) {
    await devLogin(email);
    await loadSession();
  }

  async function refreshAfterMutation(mutation: () => Promise<unknown>) {
    setError(null);
    try {
      await mutation();
      await loadAppData();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Unable to update shopping list");
    }
  }

  async function handleItemAction(itemId: string, mutation: (id: string) => Promise<unknown>) {
    setPendingItemId(itemId);
    try {
      await refreshAfterMutation(() => mutation(itemId));
    } finally {
      setPendingItemId(null);
    }
  }

  async function handleStapleAction(stapleId: string, mutation: (id: string) => Promise<unknown>) {
    setPendingStapleId(stapleId);
    try {
      await refreshAfterMutation(() => mutation(stapleId));
    } finally {
      setPendingStapleId(null);
    }
  }

  async function handlePromoteAll() {
    setIsPromoting(true);
    try {
      const result = await promoteAllStaples();
      await loadAppData();
      return result;
    } catch (promotionError) {
      setError(promotionError instanceof Error ? promotionError.message : "Unable to promote staples");
      return null;
    } finally {
      setIsPromoting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="page-shell center-shell">
        <section className="card">
          <p className="muted">Loading your shopping list...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-shell center-shell">
        <DevLogin onLogin={handleLogin} />
        {error ? <p className="error">{error}</p> : null}
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Household shopping</p>
          <h1>Shopping list</h1>
          <p className="muted">Signed in as {user.email}</p>
          <p className="meta">Household: {user.household_id}</p>
          <p className={`sync-status sync-status-${householdEvents.status}`}>
            Real-time: {householdEvents.status} · events received: {householdEvents.receivedCount}
          </p>
        </div>
        <button type="button" className="secondary" onClick={() => void loadSession()}>
          Refresh
        </button>
      </header>

      {error ? <p className="error banner">{error}</p> : null}

      <StaplesManager
        staples={staples}
        pendingStapleId={pendingStapleId}
        isPromoting={isPromoting}
        onCreate={(payload: StaplePayload) => refreshAfterMutation(() => createStaple(payload))}
        onUpdate={(stapleId, payload) => handleStapleAction(stapleId, (id) => updateStaple(id, payload))}
        onDelete={(stapleId) => handleStapleAction(stapleId, deleteStaple)}
        onPromoteAll={handlePromoteAll}
      />

      <AddOneOffItem onAdd={(payload) => refreshAfterMutation(() => addOneOffItem(payload))} />
      <ShoppingList
        items={items}
        pendingItemId={pendingItemId}
        onConfirm={(itemId) => handleItemAction(itemId, confirmItem)}
        onSkip={(itemId) => handleItemAction(itemId, skipItem)}
        onPurchase={(itemId) => handleItemAction(itemId, purchaseItem)}
      />
    </main>
  );
}
