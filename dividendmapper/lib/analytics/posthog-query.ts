import "server-only";

// Server-side HogQL query helper. Ported from scripts/reports/daily-traffic.mjs
// (the LOCAL-only ad-hoc traffic script). The PostHog query API requires the
// PERSONAL api key (PERSONAL_POSTHOG_API_KEY), NOT the public NEXT_PUBLIC_POSTHOG_KEY.
export async function hogql(query: string): Promise<{ results: unknown[][] }> {
  const key = process.env.PERSONAL_POSTHOG_API_KEY;
  if (!key) {
    throw new Error(
      "PERSONAL_POSTHOG_API_KEY is not set — the PostHog query API needs the personal api key",
    );
  }

  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.posthog.com";
  const projectId = process.env.POSTHOG_PROJECT_ID ?? "170790";

  const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });

  if (!res.ok) {
    throw new Error(`PostHog query failed: ${res.status}`);
  }

  return res.json();
}
