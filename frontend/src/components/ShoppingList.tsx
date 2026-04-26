"use client";

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
  const reviewItems = items.filter((item) => item.status === "needs_review");
  const confirmedItems = items.filter((item) => item.status === "confirmed");

  return (
    <div className="list-grid">
      <section className="card" aria-labelledby="review-title">
        <div className="section-header">
          <div>
            <p className="eyebrow">Review</p>
            <h2 id="review-title">Needs review</h2>
          </div>
          <span className="pill">{reviewItems.length}</span>
        </div>

        {reviewItems.length === 0 ? (
          <p className="empty-state">Nothing needs review right now.</p>
        ) : (
          <ul className="item-list">
            {reviewItems.map((item) => (
              <ShoppingListItem key={item.id} item={item}>
                <button
                  type="button"
                  className="secondary"
                  disabled={pendingItemId === item.id}
                  onClick={() => void onConfirm(item.id)}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={pendingItemId === item.id}
                  onClick={() => void onSkip(item.id)}
                >
                  Skip
                </button>
              </ShoppingListItem>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="confirmed-title">
        <div className="section-header">
          <div>
            <p className="eyebrow">Shop</p>
            <h2 id="confirmed-title">Confirmed</h2>
          </div>
          <span className="pill">{confirmedItems.length}</span>
        </div>

        {confirmedItems.length === 0 ? (
          <p className="empty-state">Confirmed items will show up here.</p>
        ) : (
          <ul className="item-list">
            {confirmedItems.map((item) => (
              <ShoppingListItem key={item.id} item={item}>
                <button
                  type="button"
                  disabled={pendingItemId === item.id}
                  onClick={() => void onPurchase(item.id)}
                >
                  Purchased
                </button>
              </ShoppingListItem>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ShoppingListItem({
  item,
  children,
}: {
  item: ShoppingListItemType;
  children: React.ReactNode;
}) {
  return (
    <li className="shopping-item">
      <div>
        <div className="item-title-row">
          <h3>{item.name}</h3>
          {item.staple_id ? <span className="tag">Staple</span> : <span className="tag">One-off</span>}
        </div>
        {item.quantity ? <p className="quantity">{item.quantity}</p> : <p className="quantity muted">No quantity</p>}
      </div>
      <div className="item-actions">{children}</div>
    </li>
  );
}
