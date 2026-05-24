import "server-only";

// Minimal server-side PostHog event capture. Uses fetch against the
// /i/v0/e/ ingest endpoint so we don't pull in posthog-node for the
// two launch-day server events (signup, founding_member_provisioned).
//
// distinctId should match what posthog.identify() sets client-side
// (profiles.id / auth.users.id) so server + client events thread into
// the same person profile.

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com";
  if (!key) return;

  try {
    await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: distinctId,
        properties: { ...properties, $lib: "dividendmapper-server" },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("[posthog-server] capture failed", { event, distinctId, err });
  }
}
