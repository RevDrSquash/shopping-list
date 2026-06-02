"use client";

import { useState } from "react";
import { AddOneOffItem } from "@/components/AddOneOffItem";
import { useAppShell } from "@/components/AppShell";
import { ShoppingList } from "@/components/ShoppingList";
import { TopAppBar } from "@/components/layout/TopAppBar";

export default function ListPage() {
  const {
    items,
    pendingItemId,
    isCompletingShopping,
    addItem,
    confirmListItem,
    skipListItem,
    toggleItemInCart,
    completeShopping,
  } = useAppShell();
  const [isAddingItem, setIsAddingItem] = useState(false);

  return (
    <>
      <TopAppBar title="Shopping list" />
      <ShoppingList
        items={items}
        pendingItemId={pendingItemId}
        isCompletingShopping={isCompletingShopping}
        onConfirm={confirmListItem}
        onSkip={skipListItem}
        onToggleInCart={toggleItemInCart}
        onCompleteShopping={completeShopping}
        onAddItem={() => setIsAddingItem(true)}
      />
      <AddOneOffItem open={isAddingItem} onClose={() => setIsAddingItem(false)} onAdd={addItem} />
    </>
  );
}
