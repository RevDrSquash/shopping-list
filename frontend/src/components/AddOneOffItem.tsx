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
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-1 text-label-md text-on-surface-variant">
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
        <label className="grid gap-1 text-label-md text-on-surface-variant">
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
          className="mt-2 min-h-14 rounded-full bg-primary px-4 text-label-md text-white"
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

      {error ? <p className="mt-4 rounded-xl bg-error-container p-2 text-label-md text-error">{error}</p> : null}
    </BottomSheet>
  );
}
