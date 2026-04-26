"use client";

import { useCallback, useEffect, useState } from "react";
import { AddOneOffItem } from "@/components/AddOneOffItem";
import { DevLogin } from "@/components/DevLogin";
import { ShoppingList } from "@/components/ShoppingList";
import {
  addOneOffItem,
  confirmItem,
  devLogin,
  getCurrentUser,
  getShoppingList,
  purchaseItem,
  skipItem,
  type CurrentUser,
  type ShoppingListItem,
} from "@/lib/api";

export default function Home() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const loadShoppingList = useCallback(async () => {
    const shoppingList = await getShoppingList();
    setItems(shoppingList);
  }, []);

  const loadSession = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        await loadShoppingList();
      } else {
        setItems([]);
      }
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Unable to load session");
    } finally {
      setIsLoading(false);
    }
  }, [loadShoppingList]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  async function handleLogin(email: string) {
    await devLogin(email);
    await loadSession();
  }

  async function refreshAfterMutation(mutation: () => Promise<unknown>) {
    setError(null);
    try {
      await mutation();
      await loadShoppingList();
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
        </div>
        <button type="button" className="secondary" onClick={() => void loadSession()}>
          Refresh
        </button>
      </header>

      {error ? <p className="error banner">{error}</p> : null}

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
