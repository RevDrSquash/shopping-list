"use client";

import { FormEvent, useState } from "react";
import type { PromotionResult, Staple, StaplePayload } from "@/lib/api";

type StaplesManagerProps = {
  staples: Staple[];
  pendingStapleId: string | null;
  isPromoting: boolean;
  onCreate: (payload: StaplePayload) => Promise<void>;
  onUpdate: (stapleId: string, payload: StaplePayload) => Promise<void>;
  onDelete: (stapleId: string) => Promise<void>;
  onPromoteAll: () => Promise<PromotionResult | null>;
};

type StapleDraft = {
  name: string;
  quantity: string;
  intervalDays: string;
};

const emptyDraft: StapleDraft = {
  name: "",
  quantity: "",
  intervalDays: "7",
};

export function StaplesManager({
  staples,
  pendingStapleId,
  isPromoting,
  onCreate,
  onUpdate,
  onDelete,
  onPromoteAll,
}: StaplesManagerProps) {
  const [createDraft, setCreateDraft] = useState<StapleDraft>(emptyDraft);
  const [editingStapleId, setEditingStapleId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<StapleDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [promotionMessage, setPromotionMessage] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPromotionMessage(null);

    const payload = buildPayload(createDraft);
    if (!payload) {
      setError("Staple name and interval are required");
      return;
    }

    try {
      await onCreate(payload);
      setCreateDraft(emptyDraft);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create staple");
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>, stapleId: string) {
    event.preventDefault();
    setError(null);
    setPromotionMessage(null);

    const payload = buildPayload(editDraft);
    if (!payload) {
      setError("Staple name and interval are required");
      return;
    }

    try {
      await onUpdate(stapleId, payload);
      setEditingStapleId(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update staple");
    }
  }

  async function handleDelete(stapleId: string) {
    setError(null);
    setPromotionMessage(null);

    try {
      await onDelete(stapleId);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete staple");
    }
  }

  async function handlePromoteAll() {
    setError(null);
    setPromotionMessage(null);

    try {
      const result = await onPromoteAll();
      if (result) {
        setPromotionMessage(
          result.promoted_count === 1
            ? "1 staple was added to review."
            : `${result.promoted_count} staples were added to review.`,
        );
      }
    } catch (promotionError) {
      setError(promotionError instanceof Error ? promotionError.message : "Unable to promote staples");
    }
  }

  function startEditing(staple: Staple) {
    setError(null);
    setPromotionMessage(null);
    setEditingStapleId(staple.id);
    setEditDraft({
      name: staple.name,
      quantity: staple.quantity,
      intervalDays: String(staple.interval_days),
    });
  }

  return (
    <section className="card staples-card" aria-labelledby="staples-title">
      <div className="section-header">
        <div>
          <p className="eyebrow">Staples</p>
          <h2 id="staples-title">Household staples</h2>
          <p className="muted">Recurring items can be reviewed now or promoted automatically later.</p>
        </div>
        <span className="pill">{staples.length}</span>
      </div>

      <form className="staple-form" onSubmit={handleCreate}>
        <label>
          <span>Staple name</span>
          <input
            value={createDraft.name}
            onChange={(event) => setCreateDraft({ ...createDraft, name: event.target.value })}
            placeholder="Coffee"
            required
          />
        </label>
        <label>
          <span>Quantity</span>
          <input
            value={createDraft.quantity}
            onChange={(event) => setCreateDraft({ ...createDraft, quantity: event.target.value })}
            placeholder="1 bag"
          />
        </label>
        <label>
          <span>Interval days</span>
          <input
            type="number"
            min="1"
            value={createDraft.intervalDays}
            onChange={(event) => setCreateDraft({ ...createDraft, intervalDays: event.target.value })}
            required
          />
        </label>
        <button type="submit">Add staple</button>
      </form>

      <div className="dev-action-row">
        <button type="button" className="secondary" disabled={isPromoting || staples.length === 0} onClick={handlePromoteAll}>
          {isPromoting ? "Adding staples..." : "Review all staples now"}
        </button>
        <p className="muted">Adds staples without active shopping-list items to Needs review.</p>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {promotionMessage ? <p className="success">{promotionMessage}</p> : null}

      {staples.length === 0 ? (
        <p className="empty-state">No staples yet. Add one above to start building your recurring list.</p>
      ) : (
        <ul className="staple-list">
          {staples.map((staple) => (
            <li className="staple-item" key={staple.id}>
              {editingStapleId === staple.id ? (
                <form className="staple-edit-form" onSubmit={(event) => handleUpdate(event, staple.id)}>
                  <label>
                    <span>Name</span>
                    <input
                      aria-label={`Name for ${staple.name}`}
                      value={editDraft.name}
                      onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    <span>Quantity</span>
                    <input
                      aria-label={`Quantity for ${staple.name}`}
                      value={editDraft.quantity}
                      onChange={(event) => setEditDraft({ ...editDraft, quantity: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>Interval days</span>
                    <input
                      aria-label={`Interval days for ${staple.name}`}
                      type="number"
                      min="1"
                      value={editDraft.intervalDays}
                      onChange={(event) => setEditDraft({ ...editDraft, intervalDays: event.target.value })}
                      required
                    />
                  </label>
                  <div className="item-actions">
                    <button type="submit" disabled={pendingStapleId === staple.id}>
                      Save
                    </button>
                    <button type="button" className="ghost" onClick={() => setEditingStapleId(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div>
                    <div className="item-title-row">
                      <h3>{staple.name}</h3>
                      <span className="tag">Every {staple.interval_days} days</span>
                    </div>
                    {staple.quantity ? (
                      <p className="quantity">{staple.quantity}</p>
                    ) : (
                      <p className="quantity muted">No quantity</p>
                    )}
                    <p className="meta">Next automatic review: {formatDate(staple.eligible_at)}</p>
                  </div>
                  <div className="item-actions">
                    <button type="button" className="secondary" onClick={() => startEditing(staple)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={pendingStapleId === staple.id}
                      onClick={() => void handleDelete(staple.id)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function buildPayload(draft: StapleDraft): StaplePayload | null {
  const intervalDays = Number.parseInt(draft.intervalDays, 10);
  const name = draft.name.trim();
  if (!name || !Number.isFinite(intervalDays) || intervalDays <= 0) {
    return null;
  }

  return {
    name,
    quantity: draft.quantity.trim(),
    interval_days: intervalDays,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
