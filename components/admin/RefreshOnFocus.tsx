"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the server component when the tab comes back into view (new orders appear). */
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);
  return null;
}
