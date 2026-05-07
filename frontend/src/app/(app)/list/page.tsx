"use client";

import { useState } from "react";
import { AddOneOffItem } from "@/components/AddOneOffItem";
import { useAppShell } from "@/components/AppShell";
import { ShoppingList } from "@/components/ShoppingList";
import { Fab } from "@/components/layout/Fab";
import { TopAppBar } from "@/components/layout/TopAppBar";

export default function ListPage() {
  const { items, pendingItemId, addItem, confirmListItem, skipListItem, purchaseListItem, householdEvents } =
    useAppShell();
  const [isAddingItem, setIsAddingItem] = useState(false);

  return (
    <>
      <TopAppBar title="Shopping list" subtitle={`Real-time: ${householdEvents.status}`} />
      <ShoppingList
        items={items}
        pendingItemId={pendingItemId}
        onConfirm={confirmListItem}
        onSkip={skipListItem}
        onPurchase={purchaseListItem}
      />
      <Fab label="Add item" onClick={() => setIsAddingItem(true)} />
      <AddOneOffItem open={isAddingItem} onClose={() => setIsAddingItem(false)} onAdd={addItem} />
    </>
  );
}
