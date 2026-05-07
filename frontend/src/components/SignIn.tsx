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
    <section className="w-full max-w-page-narrow text-center" aria-labelledby="sign-in-title">
      <div className="mx-auto mb-md grid h-20 w-20 place-items-center rounded-full bg-primary-fixed text-primary">
        <span className="material-symbols-outlined text-[42px]" aria-hidden="true">
          home
        </span>
      </div>
      <h1 id="sign-in-title" className="text-headline-xl">
        Household
      </h1>
      <p className="mx-auto mt-sm max-w-xs text-body-md text-on-surface-variant">
        Share groceries, staples, and quick decisions with everyone at home.
      </p>

      <div className="mt-xl rounded-[2rem] bg-surface-container-lowest p-lg text-left shadow-card">
        <h2 className="text-headline-md">Welcome back</h2>
        <p className="mt-xs text-label-md text-on-surface-variant">Choose a sign-in method to continue.</p>

        {config.google_oauth_enabled ? (
          <a
            className="mt-lg flex min-h-14 w-full items-center justify-center gap-sm rounded-full border border-outline-variant bg-white px-md text-label-md text-on-surface transition hover:bg-surface-container-low"
            href="/api/auth/google/login"
          >
            <GoogleIcon />
            Sign in with Google
          </a>
        ) : null}

        {config.dev_login_enabled ? (
          <details className="mt-lg rounded-xl bg-surface-container-low p-md">
            <summary className="cursor-pointer text-label-md text-on-surface-variant">Development bypass</summary>
            <form className="mt-md grid gap-md" onSubmit={handleSubmit}>
              <label className="grid gap-xs text-label-md text-on-surface-variant" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <button
                type="submit"
                className="min-h-12 rounded-full bg-primary px-md text-label-md text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </details>
        ) : null}

        {!config.google_oauth_enabled && !config.dev_login_enabled ? (
          <p className="mt-lg text-body-md text-on-surface-variant">
            No sign-in methods are enabled. Ask an administrator to configure authentication.
          </p>
        ) : null}

        {error ? <p className="mt-md rounded-xl bg-error-container p-sm text-label-md text-error">{error}</p> : null}
      </div>

      <footer className="mt-xl text-label-sm text-on-surface-variant">
        <p>
          By continuing, you agree to the <a className="underline" href="/terms">Terms</a> and{" "}
          <a className="underline" href="/privacy">Privacy Policy</a>.
        </p>
        <p className="mt-sm">&copy; 2026 Household</p>
      </footer>
    </section>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
