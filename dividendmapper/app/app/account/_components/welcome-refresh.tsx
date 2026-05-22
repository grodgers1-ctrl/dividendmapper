"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Mounted when /app/account?welcome=1 lands after Stripe Checkout. The webhook
// that flips profiles.tier='pro' can lag the redirect by 1-3 seconds, so the
// first server render of this page may still show tier='free'. Schedule one
// router.refresh() at 3s to pick up the post-webhook state without making the
// user reload.

export function WelcomeRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => {
      router.refresh();
    }, 3000);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}
