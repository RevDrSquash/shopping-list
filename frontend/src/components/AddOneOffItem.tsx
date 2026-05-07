"use client";

import { FormEvent, useState } from "react";
import { BottomSheet } from "@/components/layout/BottomSheet";

type AddOneOffItemProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (payload: { name: string; quantity: string }) => Promise<void>;
};

export function AddOneOffItem({ open, onClose, onAdd }: AddOneOffItemProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdd({ name: trimmedName, quantity: quantity.trim() });
      setName("");
      setQuantity("");
      onClose();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Unable to add item");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} title="Add item" onClose={onClose}>
      <form className="grid gap-md" onSubmit={handleSubmit}>
        <label className="grid gap-xs text-label-md text-on-surface-variant">
          <span>Name</span>
          <input
            className="min-h-14 rounded-xl border-outline-variant"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Bananas"
            required
          />
        </label>
        <label className="grid gap-xs text-label-md text-on-surface-variant">
          <span>Quantity (optional)</span>
          <input
            className="min-h-14 rounded-xl border-outline-variant"
            name="quantity"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="6"
          />
        </label>
        <button
          type="submit"
          className="mt-sm min-h-14 rounded-full bg-primary px-md text-label-md text-white"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Adding..." : "Add to list"}
        </button>
        <button
          type="button"
          className="min-h-10 rounded-full bg-transparent text-label-md text-on-surface-variant"
          onClick={onClose}
        >
          Cancel
        </button>
      </form>

      {error ? <p className="mt-md rounded-xl bg-error-container p-sm text-label-md text-error">{error}</p> : null}
    </BottomSheet>
  );
}
