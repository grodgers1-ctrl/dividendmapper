// Client-side fire-and-forget event capture. Lazy-imports posthog-js so the
// client bundle for surfaces that don't fire events stays untouched. No-ops
// silently when PostHog isn't initialised (NEXT_PUBLIC_POSTHOG_KEY unset) or
// when called server-side.

export function captureClientEvent(
  name: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  void import("posthog-js")
    .then((mod) => {
      const ph = (mod as { default?: { capture: (n: string, p?: unknown) => void; __loaded?: boolean } }).default;
      if (!ph || !(ph as { __loaded?: boolean }).__loaded) return;
      ph.capture(name, properties);
    })
    .catch(() => {
      // Non-fatal — analytics must never break a user-facing flow.
    });
}
