import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/scoring/fmp-client", () => ({
  getProfile: vi.fn().mockResolvedValue([{ symbol: "TEST", mktCap: 1e9 }]),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const upsertMock = vi.fn().mockResolvedValue({ error: null });
const selectMock = vi.fn(() =>
  Promise.resolve({
    data: [{ ticker: "AAPL.US" }, { ticker: "ULVR.L" }, { ticker: "AAPL.US" }],
    error: null,
  }),
);
const fromMock = vi.fn((table: string) => {
  if (table === "holdings") {
    return { select: selectMock };
  }
  if (table === "equity_score_history") {
    return { upsert: upsertMock };
  }
  throw new Error(`unexpected table ${table}`);
});
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: fromMock })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
});

describe("GET /api/internal/refresh-equity-scores", () => {
  it("returns 401 when authorization header is missing", async () => {
    const { GET } = await import("../route");
    const req = new Request("https://example.com/");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when authorization header is wrong", async () => {
    const { GET } = await import("../route");
    const req = new Request("https://example.com/", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 when CRON_SECRET env is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("../route");
    const req = new Request("https://example.com/", {
      headers: { Authorization: "Bearer anything" },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it("on valid auth: fetches distinct tickers, calls FMP per ticker, upserts history rows, returns OK", async () => {
    const { GET } = await import("../route");
    const req = new Request("https://example.com/", {
      headers: { Authorization: "Bearer test-cron-secret" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    // 3 holdings rows but only 2 unique tickers (AAPL.US dup)
    expect(body.tickerCount).toBe(2);
    expect(upsertMock).toHaveBeenCalledTimes(2);
  });

  it("per-ticker FMP failure does not fail the whole job", async () => {
    const fmp = await import("@/lib/scoring/fmp-client");
    vi.mocked(fmp.getProfile)
      .mockRejectedValueOnce(new Error("FMP down for AAPL.US"))
      .mockResolvedValueOnce([{ symbol: "ULVR.L", mktCap: 1e10 }]);
    const { GET } = await import("../route");
    const req = new Request("https://example.com/", {
      headers: { Authorization: "Bearer test-cron-secret" },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.failedTickerCount).toBe(1);
    expect(body.successfulTickerCount).toBe(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
