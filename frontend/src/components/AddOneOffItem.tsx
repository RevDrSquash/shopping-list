"use client";

import { FormEvent, useState } from "react";

type AddOneOffItemProps = {
  onAdd: (payload: { name: string; quantity: string }) => Promise<void>;
};

export function AddOneOffItem({ onAdd }: AddOneOffItemProps) {
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
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Unable to add item");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card" aria-labelledby="add-one-off-title">
      <div>
        <p className="eyebrow">One-off item</p>
        <h2 id="add-one-off-title">Add something for this trip</h2>
      </div>

      <form className="add-form" onSubmit={handleSubmit}>
        <label>
          <span>Name</span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Bananas"
            required
          />
        </label>
        <label>
          <span>Quantity</span>
          <input
            name="quantity"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="6"
          />
        </label>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Adding..." : "Add item"}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
