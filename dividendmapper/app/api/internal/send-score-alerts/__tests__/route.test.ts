import { describe, it, expect, vi, beforeEach } from "vitest";

const sendIdempotent = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendIdempotent: (...a: unknown[]) => sendIdempotent(...a) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

// One Pro user (u1) holding MSFT, whose risk crossed 75 -> 81 between the two
// most-recent history rows. data_quality 'full'.
function makeSupabase() {
  // route calls .update(...).eq("user_id", uid).in("event_type", [...])
  const update = vi.fn().mockReturnValue({ eq: () => ({ in: () => ({ error: null }) }) });
  const from = vi.fn((table: string) => {
    if (table === "notification_preferences") {
      return {
        select: () => ({
          eq: () => ({
            or: () =>
              Promise.resolve({
                data: [
                  { user_id: "u1", event_type: "risk_threshold_crossed", enabled: true, threshold_value: 75 },
                  { user_id: "u1", event_type: "buy_threshold_crossed", enabled: true, threshold_value: 30 },
                ],
                error: null,
              }),
          }),
        }),
        update,
      };
    }
    if (table === "profiles") {
      return {
        select: () => ({
          in: () => Promise.resolve({ data: [{ id: "u1", tier: "pro", email: "a@b.com" }], error: null }),
        }),
      };
    }
    if (table === "holdings") {
      return { select: () => ({ eq: () => Promise.resolve({ data: [{ ticker: "MSFT" }], error: null }) }) };
    }
    if (table === "equity_scores") {
      return {
        select: () => ({
          in: () => Promise.resolve({ data: [{ ticker: "MSFT", data_quality: "full" }], error: null }),
        }),
      };
    }
    if (table === "equity_score_history") {
      return {
        select: () => ({
          in: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  { ticker: "MSFT", observed_at: "2026-06-02", risk_score: 81, buy_score: 60 },
                  { ticker: "MSFT", observed_at: "2026-06-01", risk_score: 70, buy_score: 60 },
                ],
                error: null,
              }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { from, update };
}

let supa: ReturnType<typeof makeSupabase>;
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => supa) }));

const ORIGINAL = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  supa = makeSupabase();
  sendIdempotent.mockResolvedValue({ ok: true, emailId: "e1" });
  process.env = {
    ...ORIGINAL,
    CRON_SECRET: "s3cr3t",
    SUPABASE_SERVICE_ROLE_KEY: "svc",
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SITE_URL: "https://dividendmapper.com",
  };
});

import { GET } from "../route";

function req(auth?: string) {
  return new Request("http://x/api/internal/send-score-alerts", {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("send-score-alerts cron", () => {
  it("401 without the cron bearer", async () => {
    expect((await GET(req())).status).toBe(401);
    expect(sendIdempotent).not.toHaveBeenCalled();
  });

  it("sends one digest with a per-user-per-day send key", async () => {
    const res = await GET(req("Bearer s3cr3t"));
    expect(res.status).toBe(200);
    expect(sendIdempotent).toHaveBeenCalledTimes(1);
    const opts = sendIdempotent.mock.calls[0][0] as { sendKey: string; to: string };
    expect(opts.to).toBe("a@b.com");
    expect(opts.sendKey).toMatch(/^u1:digest:\d{4}-\d{2}-\d{2}$/);
  });

  it("does not throw when sendIdempotent reports already_sent", async () => {
    sendIdempotent.mockResolvedValue({ ok: false, reason: "already_sent" });
    expect((await GET(req("Bearer s3cr3t"))).status).toBe(200);
  });
});
