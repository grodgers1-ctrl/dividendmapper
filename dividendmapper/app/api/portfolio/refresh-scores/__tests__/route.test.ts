import { describe, it, expect, beforeEach, vi } from "vitest";

const scoreTicker = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/scoring/score-ticker", () => ({
  scoreTicker: (...a: unknown[]) => scoreTicker(...a),
  isoDateOffset: (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10),
}));
vi.mock("@/lib/scoring/fmp-client", () => ({ getDividendsCalendar: vi.fn().mockResolvedValue([]) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const adminUpdate = vi.fn().mockResolvedValue({ error: null });
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: vi.fn(() => ({ update: vi.fn(() => ({ eq: adminUpdate })) })),
  }),
}));

// Configurable per-test fixtures for the RLS user client.
let tier: "free" | "pro" | "premium" = "pro";
let lastRefresh: string | null = null;
let holdings: { ticker: string }[] = [];
let tracked: { ticker: string }[] = [];
let scores: { ticker: string; computed_at: string }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } } }) },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { tier, last_score_refresh_at: lastRefresh } }) }),
          }),
        };
      }
      if (table === "holdings") {
        return { select: () => ({ is: async () => ({ data: holdings, error: null }) }) };
      }
      if (table === "tracked_tickers") {
        return { select: async () => ({ data: tracked, error: null }) };
      }
      if (table === "equity_scores") {
        return { select: () => ({ in: async () => ({ data: scores, error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "../route";

function req() {
  return new Request("http://localhost/api/portfolio/refresh-scores", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  tier = "pro";
  lastRefresh = null;
  holdings = [];
  tracked = [];
  scores = [];
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://sb";
  // NODE_ENV is already "test" under vitest, which zeroes the inter-ticker pad.
});

describe("POST /api/portfolio/refresh-scores", () => {
  it("403 for free tier", async () => {
    tier = "free";
    holdings = [{ ticker: "AAPL.US" }];
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("pro_required");
    expect(scoreTicker).not.toHaveBeenCalled();
  });

  it("scores missing tickers and stamps last_score_refresh_at", async () => {
    holdings = [{ ticker: "AAPL.US" }, { ticker: "MSFT.US" }];
    scores = []; // both missing
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scored).toBe(2);
    expect(body.remaining).toBe(0);
    expect(scoreTicker).toHaveBeenCalledTimes(2);
    expect(adminUpdate).toHaveBeenCalled(); // timestamp stamped
  });

  it("selects stale (>24h) and skips fresh (<24h)", async () => {
    holdings = [{ ticker: "AAPL.US" }, { ticker: "MSFT.US" }];
    const old = new Date(Date.now() - 25 * 3600_000).toISOString();
    const fresh = new Date(Date.now() - 1 * 3600_000).toISOString();
    scores = [
      { ticker: "AAPL.US", computed_at: old },
      { ticker: "MSFT.US", computed_at: fresh },
    ];
    const res = await POST(req());
    const body = await res.json();
    expect(body.scored).toBe(1);
    expect(scoreTicker).toHaveBeenCalledWith(
      expect.anything(),
      "AAPL.US",
      expect.anything(),
      expect.anything(),
    );
  });

  it("caps at 20 and reports remaining", async () => {
    holdings = Array.from({ length: 25 }, (_, i) => ({ ticker: `T${i}.US` }));
    scores = [];
    const res = await POST(req());
    const body = await res.json();
    expect(body.scored).toBe(20);
    expect(body.remaining).toBe(5);
    expect(scoreTicker).toHaveBeenCalledTimes(20);
  });

  it("orders missing-first before stale", async () => {
    holdings = [{ ticker: "STALE.US" }, { ticker: "MISS.US" }];
    const old = new Date(Date.now() - 25 * 3600_000).toISOString();
    scores = [{ ticker: "STALE.US", computed_at: old }];
    await POST(req());
    expect(scoreTicker.mock.calls[0][1]).toBe("MISS.US");
    expect(scoreTicker.mock.calls[1][1]).toBe("STALE.US");
  });

  it("429 cooldown when nothing missing and within 15min", async () => {
    holdings = [{ ticker: "AAPL.US" }];
    const old = new Date(Date.now() - 25 * 3600_000).toISOString(); // stale → eligible but gated
    scores = [{ ticker: "AAPL.US", computed_at: old }];
    lastRefresh = new Date(Date.now() - 5 * 60_000).toISOString();
    const res = await POST(req());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("cooldown");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(scoreTicker).not.toHaveBeenCalled();
  });

  it("cooldown is bypassed when there are missing tickers", async () => {
    holdings = [{ ticker: "AAPL.US" }];
    scores = []; // missing
    lastRefresh = new Date(Date.now() - 1 * 60_000).toISOString(); // within 15min
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(scoreTicker).toHaveBeenCalledTimes(1);
  });

  it("upToDate when nothing eligible and no cooldown active", async () => {
    holdings = [{ ticker: "AAPL.US" }];
    scores = [{ ticker: "AAPL.US", computed_at: new Date().toISOString() }];
    lastRefresh = new Date(Date.now() - 60 * 60_000).toISOString(); // > 15min ago
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ scored: 0, remaining: 0, upToDate: true });
  });
});
