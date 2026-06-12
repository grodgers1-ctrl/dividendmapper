import { describe, it, expect, vi, beforeEach } from "vitest";

const sendIdempotent = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendIdempotent: (...a: unknown[]) => sendIdempotent(...a) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
// Capture the props passed to the email rather than rendering it, so tests can
// assert on the crossings the route fed in.
vi.mock("@/emails/score-alert", () => ({ ScoreAlertEmail: (props: unknown) => ({ props }) }));

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

// A watchlist-only Pro user (u2): holds nothing, watches AAPL (not held), whose
// risk crossed 75 between its two most-recent history rows. Only watchlist_alert
// is enabled (no risk/buy holdings prefs) — so the watchlist digest must fire on
// the default thresholds regardless of the holdings prefs.
function makeWatchlistSupabase() {
  const update = vi.fn().mockReturnValue({ eq: () => ({ in: () => ({ error: null }) }) });
  const from = vi.fn((table: string) => {
    if (table === "notification_preferences") {
      return {
        select: () => ({
          eq: () => ({
            or: () =>
              Promise.resolve({
                data: [{ user_id: "u2", event_type: "watchlist_alert", enabled: true, threshold_value: null }],
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
          in: () => Promise.resolve({ data: [{ id: "u2", tier: "pro", email: "w@b.com" }], error: null }),
        }),
      };
    }
    if (table === "holdings") {
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
    }
    if (table === "tracked_tickers") {
      return { select: () => ({ eq: () => Promise.resolve({ data: [{ ticker: "AAPL" }], error: null }) }) };
    }
    if (table === "equity_scores") {
      return {
        select: () => ({
          in: () => Promise.resolve({ data: [{ ticker: "AAPL", data_quality: "full" }], error: null }),
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
                  { ticker: "AAPL", observed_at: "2026-06-02", risk_score: 81, buy_score: 60 },
                  { ticker: "AAPL", observed_at: "2026-06-01", risk_score: 70, buy_score: 60 },
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

let supa: ReturnType<typeof makeSupabase> | ReturnType<typeof makeWatchlistSupabase>;
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

  it("sends a watchlist-only user a digest with watchlist crossings", async () => {
    supa = makeWatchlistSupabase();
    const res = await GET(req("Bearer s3cr3t"));
    expect(res.status).toBe(200);
    expect(sendIdempotent).toHaveBeenCalledTimes(1);
    const opts = sendIdempotent.mock.calls[0][0] as {
      to: string;
      body: { props: { watchlistRiskCrossings: { ticker: string }[]; riskCrossings: { ticker: string }[] } };
    };
    expect(opts.to).toBe("w@b.com");
    // The holdings sections are empty (user holds nothing); the watchlist section carries AAPL.
    expect(opts.body.props.riskCrossings).toEqual([]);
    expect(opts.body.props.watchlistRiskCrossings).toEqual([{ ticker: "AAPL", from: 70, to: 81 }]);
  });
});
