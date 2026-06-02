"use client";

import { useState } from "react";
import { AddOneOffItem } from "@/components/AddOneOffItem";
import { useAppShell } from "@/components/AppShell";
import { ShoppingList } from "@/components/ShoppingList";
import { TopAppBar } from "@/components/layout/TopAppBar";

export default function ListPage() {
  const { items, pendingItemId, addItem, confirmListItem, skipListItem, purchaseListItem } = useAppShell();
  const [isAddingItem, setIsAddingItem] = useState(false);

  return (
    <>
      <TopAppBar title="Shopping list" />
      <ShoppingList
        items={items}
        pendingItemId={pendingItemId}
        onConfirm={confirmListItem}
        onSkip={skipListItem}
        onPurchase={purchaseListItem}
        onAddItem={() => setIsAddingItem(true)}
      />
      <AddOneOffItem open={isAddingItem} onClose={() => setIsAddingItem(false)} onAdd={addItem} />
    </>
  );
}
