"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Mounted when /app/account?welcome=1 lands after Stripe Checkout. The webhook
// that flips profiles.tier='pro' can lag the redirect by 1-3 seconds, so the
// first server render of this page may still show tier='free'. Schedule one
// router.refresh() at 3s to pick up the post-webhook state without making the
// user reload.
//
// Also fires the PostHog checkout_completed event once the lazily-loaded
// client is ready (provider uses requestIdleCallback, so we poll briefly).

const POLL_INTERVAL_MS = 500;
const MAX_ATTEMPTS = 20;

export function WelcomeRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => {
      router.refresh();
    }, 3000);

    let cancelled = false;
    const tryCapture = async (attempt: number) => {
      if (cancelled) return;
      const ph = (await import("posthog-js")).default;
      const flag = ph as unknown as { __loaded?: boolean };
      if (!flag.__loaded) {
        if (attempt < MAX_ATTEMPTS) {
          setTimeout(() => tryCapture(attempt + 1), POLL_INTERVAL_MS);
        }
        return;
      }
      ph.capture("checkout_completed");
    };
    tryCapture(0);

    return () => {
      clearTimeout(t);
      cancelled = true;
    };
  }, [router]);
  return null;
}
