"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageMain } from "@/components/layout/PageMain";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/list");
  }, [router]);

  return (
    <PageMain variant="centered">
      <p className="text-body-md text-on-surface-variant">Opening your shopping list...</p>
    </PageMain>
  );
}
