"use client";

import { FormEvent, useState } from "react";
import type { AppConfig } from "@/lib/api";

type SignInProps = {
  config: AppConfig;
  onLogin: (email: string) => Promise<void>;
};

export function SignIn({ config, onLogin }: SignInProps) {
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
    <section className="card auth-card" aria-labelledby="sign-in-title">
      <p className="eyebrow">Authentication</p>
      <h1 id="sign-in-title">Sign in to your household list</h1>
      <p className="muted">Use Google sign-in or the development bypass when it is enabled.</p>

      {config.google_oauth_enabled ? (
        <a className="button-link google-sign-in" href="/api/auth/google/login">
          Sign in with Google
        </a>
      ) : null}

      {config.dev_login_enabled ? (
        <section className="dev-bypass" aria-labelledby="dev-bypass-title">
          <h2 id="dev-bypass-title">Development bypass</h2>
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
        </section>
      ) : null}

      {!config.google_oauth_enabled && !config.dev_login_enabled ? (
        <p className="empty-state">No sign-in methods are enabled. Ask an administrator to configure authentication.</p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
