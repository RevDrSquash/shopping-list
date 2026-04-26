"use client";

import { FormEvent, useState } from "react";

type DevLoginProps = {
  onLogin: (email: string) => Promise<void>;
};

export function DevLogin({ onLogin }: DevLoginProps) {
  const [email, setEmail] = useState("person@example.com");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onLogin(email);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to log in");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card auth-card" aria-labelledby="dev-login-title">
      <p className="eyebrow">Development auth</p>
      <h1 id="dev-login-title">Sign in to your household list</h1>
      <p className="muted">
        Use the backend development login bypass while Google OAuth is still out of scope.
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
