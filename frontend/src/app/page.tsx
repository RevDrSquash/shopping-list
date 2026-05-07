"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/list");
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center px-container-padding">
      <p className="text-body-md text-on-surface-variant">Opening your shopping list...</p>
    </main>
  );
}
