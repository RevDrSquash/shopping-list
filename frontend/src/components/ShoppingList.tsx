"use client";

import { useRef, useState, type PointerEvent } from "react";
import { BottomSheet } from "@/components/layout/BottomSheet";
import type { ShoppingListItem as ShoppingListItemType } from "@/lib/api";

type ShoppingListProps = {
  items: ShoppingListItemType[];
  pendingItemId: string | null;
  onConfirm: (itemId: string) => Promise<void>;
  onSkip: (itemId: string) => Promise<void>;
  onPurchase: (itemId: string) => Promise<void>;
};

export function ShoppingList({
  items,
  pendingItemId,
  onConfirm,
  onSkip,
  onPurchase,
}: ShoppingListProps) {
  const [actionItem, setActionItem] = useState<ShoppingListItemType | null>(null);

  return (
    <section aria-labelledby="shopping-list-title">
      <div className="mb-md flex items-end justify-between gap-md">
        <div>
          <p className="text-label-sm uppercase tracking-[0.12em] text-primary">Today</p>
          <h2 id="shopping-list-title" className="text-headline-md">
            Shopping list
          </h2>
        </div>
        <span className="rounded-full bg-primary-fixed px-sm py-xs text-label-sm text-primary">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest p-lg text-center shadow-card">
          <p className="text-body-md text-on-surface-variant">Your list is clear. Add an item when something comes up.</p>
        </div>
      ) : (
        <ul className="grid gap-md" aria-label="Shopping items">
          {items.map((item) => (
            <ShoppingListRow
              key={item.id}
              item={item}
              disabled={pendingItemId === item.id}
              onConfirm={onConfirm}
              onPurchase={onPurchase}
              onRemove={async (itemId) => {
                await onSkip(itemId);
                setActionItem(null);
              }}
              onOpenActions={() => setActionItem(item)}
            />
          ))}
        </ul>
      )}

      <BottomSheet open={actionItem !== null} title="Item actions" onClose={() => setActionItem(null)}>
        {actionItem ? (
          <div className="grid gap-sm">
            <p className="text-body-md text-on-surface-variant">Remove {actionItem.name} from this shopping list?</p>
            <button
              type="button"
              className="min-h-12 rounded-full bg-error px-md text-label-md text-white"
              disabled={pendingItemId === actionItem.id}
              onClick={() => void onSkip(actionItem.id).then(() => setActionItem(null))}
            >
              Remove
            </button>
            <button
              type="button"
              className="min-h-12 rounded-full bg-surface-container-low px-md text-label-md text-on-surface"
              onClick={() => setActionItem(null)}
            >
              Cancel
            </button>
          </div>
        ) : null}
      </BottomSheet>
    </section>
  );
}

function ShoppingListRow({
  item,
  disabled,
  onConfirm,
  onPurchase,
  onRemove,
  onOpenActions,
}: {
  item: ShoppingListItemType;
  disabled: boolean;
  onConfirm: (itemId: string) => Promise<void>;
  onPurchase: (itemId: string) => Promise<void>;
  onRemove: (itemId: string) => Promise<void>;
  onOpenActions: () => void;
}) {
  const startX = useRef<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReview = item.status === "needs_review";
  const rowClassName = isReview
    ? "border-2 border-dashed border-outline-variant bg-surface"
    : "bg-surface-container-lowest shadow-card";

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLLIElement>) {
    startX.current = event.clientX;
    clearLongPress();
    longPressTimer.current = setTimeout(onOpenActions, 550);
  }

  function handlePointerMove(event: PointerEvent<HTMLLIElement>) {
    if (startX.current === null) {
      return;
    }

    if (Math.abs(event.clientX - startX.current) > 8) {
      clearLongPress();
    }
  }

  function handlePointerEnd(event: PointerEvent<HTMLLIElement>) {
    clearLongPress();
    const swipeDistance = startX.current === null ? 0 : event.clientX - startX.current;
    startX.current = null;
    if (swipeDistance < -50 && !disabled) {
      void onRemove(item.id);
    }
  }

  return (
    <li
      className="relative overflow-hidden rounded-xl"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={clearLongPress}
    >
      <div className="absolute inset-y-0 right-0 flex w-28 items-center justify-center bg-error text-label-md text-white">
        Remove
      </div>
      <div className={`relative flex items-center gap-md rounded-xl p-md ${rowClassName}`}>
        <button
          type="button"
          className="min-h-0 flex-1 bg-transparent p-0 text-left text-on-surface hover:bg-transparent"
          disabled={disabled}
          onClick={() => {
            if (isReview) {
              void onConfirm(item.id);
            }
          }}
        >
          <span className="flex flex-wrap items-center gap-sm">
            <span className={`text-body-lg font-semibold ${isReview ? "text-on-surface-variant" : "text-on-surface"}`}>
              {item.name}
            </span>
            {item.quantity ? (
              <span className="rounded-full bg-surface-container px-sm py-xs text-label-sm text-on-surface-variant">
                {item.quantity}
              </span>
            ) : null}
          </span>
          <span className="mt-xs block text-label-sm text-on-surface-variant">
            {item.staple_id ? "Staple" : "One-off"}
            {isReview ? " · tap to confirm" : ""}
          </span>
        </button>
        <button
          type="button"
          className="grid h-6 min-h-0 w-6 shrink-0 place-items-center rounded-full border-2 border-primary bg-transparent p-0 text-primary hover:bg-primary-fixed"
          aria-label={`Mark ${item.name} purchased`}
          disabled={disabled}
          onClick={() => void onPurchase(item.id)}
        >
          <span className="sr-only">Purchased</span>
        </button>
      </div>
    </li>
  );
}
