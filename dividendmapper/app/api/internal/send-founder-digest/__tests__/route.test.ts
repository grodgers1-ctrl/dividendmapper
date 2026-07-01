import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendIdempotent = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendIdempotent: (...a: unknown[]) => sendIdempotent(...a) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
// Capture props rather than render, so we can assert on the metrics fed in.
vi.mock("@/emails/founder-digest", () => ({ FounderDigestEmail: (props: unknown) => ({ props }) }));

const hogql = vi.fn();
vi.mock("@/lib/analytics/posthog-query", () => ({ hogql: (...a: unknown[]) => hogql(...a) }));
// Mock the founder module so we don't pull in its `server-only` import, and so
// the recipient list is fixed for the two-founder assertions.
vi.mock("@/lib/founder/notify", () => ({
  FOUNDER_EMAILS: ["glenn@dividendmapper.com", "grodgers1@googlemail.com"],
}));

const createClient = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: (...a: unknown[]) => createClient(...a) }));

// Terminal supabase query builder: chainable filters that resolve to a
// { count } for the head-count queries, or a { data } for the MRR select.
function countBuilder(count: number) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  b.select = chain;
  b.gte = chain;
  b.lt = chain;
  b.eq = chain;
  b.then = (resolve: (v: { count: number; error: null }) => unknown) =>
    resolve({ count, error: null });
  return b;
}

function makeSupabase() {
  // Distinct counts per (table, dateColumn) so the assertions can tell them apart.
  const from = vi.fn((table: string) => {
    if (table === "profiles") return countBuilder(7); // signups
    if (table === "grant_redemptions") return countBuilder(3); // trials
    if (table === "subscriptions") {
      // subscriptions is used three times: created_at count (conversions),
      // updated_at count (cancellations), and the MRR select. Route them by
      // which method is called first. The count queries call .select("id",{...})
      // then .gte(...); the MRR query calls .select("billing_period").eq(...).
      // Return a builder that supports both shapes.
      const b: Record<string, unknown> = {};
      b.select = (_cols: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.head) {
          // head-count query (conversions or cancellations)
          const c: Record<string, unknown> = {};
          const chain = () => c;
          c.gte = chain;
          c.lt = chain;
          c.eq = chain;
          c.then = (resolve: (v: { count: number; error: null }) => unknown) =>
            resolve({ count: 2, error: null });
          return c;
        }
        // MRR select
        return {
          eq: () =>
            Promise.resolve({
              data: [
                { billing_period: "monthly" },
                { billing_period: "monthly" },
                { billing_period: "annual" },
              ],
              error: null,
            }),
        };
      };
      return b;
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { from };
}

function makeReq(auth = "Bearer test-secret") {
  return new Request("https://x/api/internal/send-founder-digest", { headers: { authorization: auth } });
}

const FIXED_NOW = new Date("2026-07-01T09:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supa";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.PERSONAL_POSTHOG_API_KEY = "phk";
  sendIdempotent.mockResolvedValue({ ok: true, emailId: "e1" });
  hogql.mockImplementation((q: string) => {
    if (q.includes("count(distinct")) return Promise.resolve({ results: [[42]] });
    if (q.includes("GROUP BY"))
      return Promise.resolve({ results: [["https://dividendmapper.com/pricing", 30]] });
    return Promise.resolve({ results: [[123]] }); // pageviews
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("send-founder-digest route", () => {
  it("rejects a missing/bad bearer token", async () => {
    createClient.mockReturnValue(makeSupabase());
    const { GET } = await import("../route");
    const res = await GET(makeReq("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("sends one digest per founder with the right template and per-recipient sendKey", async () => {
    createClient.mockReturnValue(makeSupabase());
    const { GET } = await import("../route");
    const res = await GET(makeReq());
    const json = await res.json();

    // 2026-07-01 UTC -> yesterday label 2026-06-30.
    expect(json.ok).toBe(true);
    expect(json.sent).toBe(2);
    expect(json.metrics.dateLabel).toBe("2026-06-30");
    expect(json.metrics.pageviews).toBe(123);
    expect(json.metrics.uniques).toBe(42);
    // MRR = 2 monthly * 15 + 1 annual * (150/12) = 30 + 12.5 = 42.5 -> round 43.
    expect(json.metrics.mrr).toBe(43);

    expect(sendIdempotent).toHaveBeenCalledTimes(2);
    const calls = sendIdempotent.mock.calls.map((c) => c[0]);
    for (const call of calls) {
      expect(call.template).toBe("founder_digest");
      expect(call.userId).toBeNull();
      expect(call.sendKey).toMatch(/^founder_digest_2026-06-30_.+$/);
    }
    // Both founders get their own row (distinct sendKeys).
    expect(new Set(calls.map((c) => c.sendKey)).size).toBe(2);
  });

  it("still sends the Supabase portion when PostHog fails", async () => {
    createClient.mockReturnValue(makeSupabase());
    hogql.mockRejectedValue(new Error("posthog down"));
    const { GET } = await import("../route");
    const res = await GET(makeReq());
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.sent).toBe(2);
    expect(json.metrics.pageviews).toBeNull();
    expect(json.metrics.uniques).toBeNull();
    expect(json.metrics.topPages).toEqual([]);
    // Business counts still present.
    expect(json.metrics.signups).toBe(7);
    expect(json.metrics.trials).toBe(3);
  });
});
