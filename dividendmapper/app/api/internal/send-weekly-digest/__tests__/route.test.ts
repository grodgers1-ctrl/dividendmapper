import { describe, it, expect, vi, beforeEach } from "vitest";

const sendIdempotent = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendIdempotent: (...a: unknown[]) => sendIdempotent(...a) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
// Capture the props rather than render, so we can assert on the rows fed in.
vi.mock("@/emails/weekly-digest", () => ({ WeeklyDigestEmail: (props: unknown) => ({ props }) }));

const createClient = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: (...a: unknown[]) => createClient(...a) }));

// Pro user u1 holds SHEL: resilience 50->55 (a mover). Watches DGE (not held),
// price 100->90 (a >=5% swing). Two history rows each, newest first.
function makeSupabase() {
  const update = vi.fn().mockReturnValue({ eq: () => ({ in: () => ({ error: null }) }) });
  const from = vi.fn((table: string) => {
    if (table === "notification_preferences") {
      return {
        select: () => ({
          eq: () => ({
            or: () =>
              Promise.resolve({
                data: [{ user_id: "u1", event_type: "weekly_digest", enabled: true, threshold_value: null }],
                error: null,
              }),
          }),
        }),
        update,
      };
    }
    if (table === "profiles") {
      return { select: () => ({ in: () => Promise.resolve({ data: [{ id: "u1", tier: "pro", email: "a@b.com" }], error: null }) }) };
    }
    if (table === "holdings") {
      return { select: () => ({ eq: () => Promise.resolve({ data: [{ ticker: "SHEL" }], error: null }) }) };
    }
    if (table === "tracked_tickers") {
      return { select: () => ({ eq: () => Promise.resolve({ data: [{ ticker: "DGE" }], error: null }) }) };
    }
    if (table === "equity_scores") {
      return {
        select: () => ({
          in: () => Promise.resolve({ data: [{ ticker: "SHEL", data_quality: "full" }, { ticker: "DGE", data_quality: "full" }], error: null }),
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
                  { ticker: "SHEL", observed_at: "2026-06-14", buy_score: 55, risk_score: 41, current_price: 100 },
                  { ticker: "SHEL", observed_at: "2026-06-06", buy_score: 50, risk_score: 41, current_price: 100 },
                  { ticker: "DGE", observed_at: "2026-06-14", buy_score: 60, risk_score: 50, current_price: 90 },
                  { ticker: "DGE", observed_at: "2026-06-06", buy_score: 60, risk_score: 50, current_price: 100 },
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

function makeReq(auth = "Bearer test-secret") {
  return new Request("https://x/api/internal/send-weekly-digest", { headers: { authorization: auth } });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supa";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.NEXT_PUBLIC_SITE_URL = "https://dividendmapper.com";
  sendIdempotent.mockResolvedValue({ ok: true, emailId: "e1" });
});

describe("send-weekly-digest route", () => {
  it("rejects a missing/bad bearer token", async () => {
    createClient.mockReturnValue(makeSupabase());
    const { GET } = await import("../route");
    const res = await GET(makeReq("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("sends one weekly digest with a holdings mover and a watchlist mover", async () => {
    const sb = makeSupabase();
    createClient.mockReturnValue(sb);
    const { GET } = await import("../route");
    const res = await GET(makeReq());
    const json = await res.json();

    expect(json).toEqual({ ok: true, sent: 1 });
    expect(sendIdempotent).toHaveBeenCalledTimes(1);
    const call = sendIdempotent.mock.calls[0][0];
    expect(call.sendKey).toMatch(/^u1:weekly:\d{4}-W\d{2}$/);
    expect(call.template).toBe("weekly-digest");
    const props = call.body.props;
    expect(props.holdings).toEqual([{ ticker: "SHEL", resilience: { curr: 55, delta: 5 }, risk: { curr: 41, delta: 0 }, priceSwingPct: 0 }]);
    expect(props.watchlist).toEqual([{ ticker: "DGE", resilience: { curr: 60, delta: 0 }, risk: { curr: 50, delta: 0 }, priceSwingPct: -10 }]);
    expect(sb.update).toHaveBeenCalled();
  });

  it("does not send when already sent this week (idempotent)", async () => {
    createClient.mockReturnValue(makeSupabase());
    sendIdempotent.mockResolvedValue({ ok: false, reason: "already_sent" });
    const { GET } = await import("../route");
    const res = await GET(makeReq());
    expect(await res.json()).toEqual({ ok: true, sent: 0 });
  });
});
