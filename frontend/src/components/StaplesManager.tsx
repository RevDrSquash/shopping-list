"use client";

import { FormEvent, useEffect, useState } from "react";
import { BottomSheet } from "@/components/layout/BottomSheet";
import { Fab } from "@/components/layout/Fab";
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
  intervalDays: number;
};

const emptyDraft: StapleDraft = {
  name: "",
  quantity: "",
  intervalDays: 7,
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
  const [sheetMode, setSheetMode] = useState<"create" | "edit" | null>(null);
  const [selectedStaple, setSelectedStaple] = useState<Staple | null>(null);
  const [actionStaple, setActionStaple] = useState<Staple | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promotionMessage, setPromotionMessage] = useState<string | null>(null);

  async function handleSave(payload: StaplePayload) {
    setError(null);
    setPromotionMessage(null);
    try {
      if (selectedStaple) {
        await onUpdate(selectedStaple.id, payload);
      } else {
        await onCreate(payload);
      }
      closeSheet();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save staple");
    }
  }

  async function handleDelete(stapleId: string) {
    setError(null);
    setPromotionMessage(null);

    try {
      await onDelete(stapleId);
      closeSheet();
      setActionStaple(null);
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

  function openCreateSheet() {
    setError(null);
    setPromotionMessage(null);
    setSelectedStaple(null);
    setSheetMode("create");
  }

  function openEditSheet(staple: Staple) {
    setError(null);
    setPromotionMessage(null);
    setSelectedStaple(staple);
    setActionStaple(null);
    setSheetMode("edit");
  }

  function closeSheet() {
    setSheetMode(null);
    setSelectedStaple(null);
  }

  return (
    <section aria-labelledby="staples-title">
      <p className="mb-lg text-body-md italic text-on-surface-variant">Items added to your list automatically</p>
      <div className="mb-md flex items-center justify-between">
        <h2 id="staples-title" className="text-headline-md">
          Household staples
        </h2>
        <span className="rounded-full bg-primary-fixed px-sm py-xs text-label-sm text-primary">{staples.length}</span>
      </div>

      {error ? <p className="mb-md rounded-xl bg-error-container p-sm text-label-md text-error">{error}</p> : null}
      {promotionMessage ? (
        <p className="mb-md rounded-xl bg-primary-fixed p-sm text-label-md text-primary">{promotionMessage}</p>
      ) : null}

      {staples.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest p-lg text-center shadow-card">
          <p className="text-body-md text-on-surface-variant">No staples yet. Add one to start your recurring list.</p>
        </div>
      ) : (
        <ul className="grid gap-md">
          {staples.map((staple) => (
            <li key={staple.id} className="rounded-xl bg-surface-container-lowest p-md shadow-card">
              <div className="flex items-start justify-between gap-md">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-sm">
                    <h3 className="text-body-lg font-semibold">{staple.name}</h3>
                    {staple.quantity ? (
                      <span className="rounded-full bg-surface-container px-sm py-xs text-label-sm text-on-surface-variant">
                        {staple.quantity}
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={`mt-sm inline-flex rounded-full px-sm py-xs text-label-sm ${
                      staple.interval_days <= 14
                        ? "bg-primary-fixed text-primary"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    every {staple.interval_days} days
                  </span>
                  <p className="mt-sm text-label-sm text-on-surface-variant">
                    Next automatic review: {formatDate(staple.eligible_at)}
                  </p>
                </div>
                <button
                  type="button"
                  className="grid min-h-10 w-10 place-items-center rounded-full bg-transparent p-0 text-on-surface-variant hover:bg-surface-container"
                  aria-label={`Actions for ${staple.name}`}
                  onClick={() => setActionStaple(staple)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    more_vert
                  </span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-xl rounded-xl bg-surface-container-low p-md" aria-label="Development tools">
        <button
          type="button"
          className="min-h-12 w-full rounded-full bg-primary-fixed px-md text-label-md text-primary"
          disabled={isPromoting || staples.length === 0}
          onClick={handlePromoteAll}
        >
          {isPromoting ? "Adding staples..." : "Review all staples now"}
        </button>
        <p className="mt-sm text-label-sm text-on-surface-variant">
          Adds staples without active shopping-list items to review for local development.
        </p>
      </section>

      <Fab label="Add staple" onClick={openCreateSheet} />

      <EditStapleSheet
        open={sheetMode !== null}
        staple={selectedStaple}
        pending={selectedStaple ? pendingStapleId === selectedStaple.id : false}
        onClose={closeSheet}
        onSave={handleSave}
        onDelete={selectedStaple ? () => handleDelete(selectedStaple.id) : undefined}
      />

      <BottomSheet open={actionStaple !== null} title="Staple actions" onClose={() => setActionStaple(null)}>
        {actionStaple ? (
          <div className="grid gap-sm">
            <p className="text-body-md text-on-surface-variant">{actionStaple.name}</p>
            <button
              type="button"
              className="min-h-12 rounded-full bg-primary px-md text-label-md text-white"
              onClick={() => openEditSheet(actionStaple)}
            >
              Edit
            </button>
            <button
              type="button"
              className="min-h-12 rounded-full bg-transparent px-md text-label-md text-error"
              disabled={pendingStapleId === actionStaple.id}
              onClick={() => void handleDelete(actionStaple.id)}
            >
              Delete
            </button>
            <button
              type="button"
              className="min-h-12 rounded-full bg-surface-container-low px-md text-label-md text-on-surface"
              onClick={() => setActionStaple(null)}
            >
              Cancel
            </button>
          </div>
        ) : null}
      </BottomSheet>
    </section>
  );
}

function EditStapleSheet({
  open,
  staple,
  pending,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  staple: Staple | null;
  pending: boolean;
  onClose: () => void;
  onSave: (payload: StaplePayload) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<StapleDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(staple ? { name: staple.name, quantity: staple.quantity, intervalDays: staple.interval_days } : emptyDraft);
      setError(null);
    }
  }, [open, staple]);

  function updateInterval(delta: number) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      intervalDays: Math.max(1, currentDraft.intervalDays + delta),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const payload = buildPayload(draft);
    if (!payload) {
      setError("Name is required and interval must be at least 1 day.");
      return;
    }
    await onSave(payload);
  }

  return (
    <BottomSheet open={open} title={staple ? "Edit staple" : "Add staple"} onClose={onClose}>
      <form className="grid gap-md" onSubmit={handleSubmit}>
        <label className="grid gap-xs text-label-md text-on-surface-variant">
          <span>Name (required)</span>
          <input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Coffee"
            required
          />
        </label>
        <label className="grid gap-xs text-label-md text-on-surface-variant">
          <span>Quantity (optional)</span>
          <input
            value={draft.quantity}
            onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
            placeholder="1 bag"
          />
        </label>
        <div>
          <p className="mb-sm text-label-md text-on-surface-variant">Interval</p>
          <div className="grid grid-cols-[56px_1fr_56px] items-center gap-sm">
            <button
              type="button"
              className="grid min-h-14 place-items-center rounded-full bg-surface-container text-on-surface"
              aria-label="Decrease interval"
              onClick={() => updateInterval(-7)}
            >
              -
            </button>
            <output className="rounded-full bg-primary-fixed px-md py-md text-center text-label-md text-primary">
              {draft.intervalDays} days
            </output>
            <button
              type="button"
              className="grid min-h-14 place-items-center rounded-full bg-surface-container text-on-surface"
              aria-label="Increase interval"
              onClick={() => updateInterval(7)}
            >
              +
            </button>
          </div>
          <p className="mt-sm text-label-sm text-on-surface-variant">Staples can recur every day or less often.</p>
        </div>
        <button type="submit" className="min-h-14 rounded-full bg-primary px-md text-label-md text-white" disabled={pending}>
          {pending ? "Saving..." : "Save staple"}
        </button>
      </form>
      {onDelete ? (
        <button
          type="button"
          className="mt-sm min-h-12 w-full rounded-full bg-transparent px-md text-label-md text-error"
          disabled={pending}
          onClick={() => void onDelete()}
        >
          Delete staple
        </button>
      ) : null}
      <button
        type="button"
        className="mt-xs min-h-12 w-full rounded-full bg-transparent px-md text-label-md text-on-surface-variant"
        onClick={onClose}
      >
        Cancel
      </button>
      {error ? <p className="mt-md rounded-xl bg-error-container p-sm text-label-md text-error">{error}</p> : null}
    </BottomSheet>
  );
}

function buildPayload(draft: StapleDraft): StaplePayload | null {
  const intervalDays = draft.intervalDays;
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
