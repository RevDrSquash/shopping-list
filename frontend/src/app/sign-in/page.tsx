"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageMain } from "@/components/layout/PageMain";
import { SignIn } from "@/components/SignIn";
import { devLogin, getConfig, getCurrentUser, type AppConfig } from "@/lib/api";

export default function SignInPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAuthState() {
      setError(null);
      setIsLoading(true);
      try {
        const [appConfig, currentUser] = await Promise.all([getConfig(), getCurrentUser()]);
        if (currentUser) {
          router.replace("/list");
          return;
        }
        setConfig(appConfig);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load sign-in options");
      } finally {
        setIsLoading(false);
      }
    }

    void loadAuthState();
  }, [router]);

  async function handleLogin(email: string) {
    await devLogin(email);
    router.replace("/list");
  }

  return (
    <PageMain variant="auth">
      {isLoading ? <p className="text-body-md text-on-surface-variant">Loading sign-in options...</p> : null}
      {!isLoading && config ? <SignIn config={config} onLogin={handleLogin} /> : null}
      {!isLoading && !config && !error ? (
        <p className="rounded-xl bg-error-container p-4 text-error">No sign-in options are available.</p>
      ) : null}
      {error ? <p className="mt-4 rounded-xl bg-error-container p-4 text-error">{error}</p> : null}
    </PageMain>
  );
}
