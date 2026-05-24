"use client";

import { useEffect } from "react";

// Calls posthog.identify() once the lazy-loaded PostHog client is ready.
// The provider initialises posthog-js inside requestIdleCallback (up to 4s
// timeout), so we poll briefly before giving up.

const POLL_INTERVAL_MS = 500;
const MAX_ATTEMPTS = 20; // 10s total

export function PostHogIdentify({
  userId,
  email,
}: {
  userId: string;
  email: string | null;
}) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const tryIdentify = async (attempt: number) => {
      if (cancelled) return;
      const ph = (await import("posthog-js")).default;
      const flag = ph as unknown as {
        __loaded?: boolean;
        get_distinct_id?: () => string;
      };
      if (!flag.__loaded) {
        if (attempt < MAX_ATTEMPTS) {
          setTimeout(() => tryIdentify(attempt + 1), POLL_INTERVAL_MS);
        }
        return;
      }
      if (flag.get_distinct_id?.() === userId) return; // already identified
      ph.identify(userId, email ? { email } : undefined);
    };

    tryIdentify(0);
    return () => {
      cancelled = true;
    };
  }, [userId, email]);

  return null;
}
