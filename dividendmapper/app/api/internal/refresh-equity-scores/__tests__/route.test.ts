import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock every FMP helper the cron calls. Minimal valid shapes — the score
// composers degrade gracefully on missing data, so the route runs end-to-end.
vi.mock("@/lib/scoring/fmp-client", () => {
  const arr = () => vi.fn().mockResolvedValue([]);
  return {
    getProfile: vi
      .fn()
      .mockResolvedValue([
        { symbol: "TEST", mktCap: 5_000_000_000, industry: "Software - Application", currency: "USD" },
      ]),
    getRatiosTtm: vi.fn().mockResolvedValue([{ symbol: "TEST", dividendPayoutRatioTTM: 0.4, dividendYieldTTM: 0.03 }]),
    getRatiosQuarterly: arr(),
    getDividends: vi.fn().mockResolvedValue([{ date: "2026-05-01", adjDividend: 0.25, dividend: 0.25 }]),
    getIncomeStatementQuarterly: vi
      .fn()
      .mockResolvedValue([{ operatingIncome: 250, interestExpense: 50, netIncome: 200 }]),
    getCashFlowStatementQuarterly: vi.fn().mockResolvedValue([{ freeCashFlow: 300, netDividendsPaid: -100 }]),
    getBalanceSheetStatementQuarterly: arr(),
    getKeyMetricsTtm: vi.fn().mockResolvedValue([{ netDebtToEBITDATTM: 1.5 }]),
    getKeyMetricsQuarterly: arr(),
    getAnalystEstimates: vi.fn().mockResolvedValue([{ date: "2027-09-27", epsAvg: 10 }]),
    getDcf: vi.fn().mockResolvedValue([{ symbol: "TEST", dcf: 150, "Stock Price": 120 }]),
    getSma: vi.fn().mockResolvedValue([{ date: "2026-05-29", close: 130, high: 131, low: 129, sma: 110 }]),
    getRsi: vi.fn().mockResolvedValue([{ date: "2026-05-29", close: 130, high: 131, low: 129, rsi: 65 }]),
    getHistoricalEod: vi
      .fn()
      .mockResolvedValue([{ symbol: "TEST", date: "2026-05-29", close: 130, high: 131, low: 129 }]),
    getPriceTargetConsensus: vi.fn().mockResolvedValue([{ symbol: "TEST", targetMedian: 155 }]),
    getGradesHistorical: arr(),
    getInsiderTrades: arr(),
    getDividendsCalendar: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const scoresUpsert = vi.fn().mockResolvedValue({ error: null });
const historyUpsert = vi.fn().mockResolvedValue({ error: null });
const signalsUpsert = vi.fn().mockResolvedValue({ error: null });

const tickersResult = {
  data: [{ ticker: "AAPL.US" }, { ticker: "ULVR.L" }, { ticker: "AAPL.US" }],
  error: null,
};

function makeChain(result: unknown, upsertFn?: ReturnType<typeof vi.fn>) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(result)),
    upsert: upsertFn ?? vi.fn().mockResolvedValue({ error: null }),
    then: (resolve: (v: unknown) => void) => resolve(result),
  };
  return chain;
}

const fromMock = vi.fn((table: string) => {
  if (table === "holdings") return makeChain(tickersResult);
  if (table === "equity_score_history") return makeChain({ data: [], error: null }, historyUpsert);
  if (table === "equity_score_signals") return makeChain({ data: [], error: null }, signalsUpsert);
  if (table === "equity_scores") return makeChain({ data: [], error: null }, scoresUpsert);
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

const authedReq = () =>
  new Request("https://example.com/", { headers: { Authorization: "Bearer test-cron-secret" } });

describe("GET /api/internal/refresh-equity-scores", () => {
  it("returns 401 when authorization header is missing", async () => {
    const { GET } = await import("../route");
    expect((await GET(new Request("https://example.com/"))).status).toBe(401);
  });

  it("returns 401 when authorization header is wrong", async () => {
    const { GET } = await import("../route");
    const res = await GET(
      new Request("https://example.com/", { headers: { Authorization: "Bearer wrong" } }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 500 when CRON_SECRET env is missing", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("../route");
    const res = await GET(
      new Request("https://example.com/", { headers: { Authorization: "Bearer anything" } }),
    );
    expect(res.status).toBe(500);
  });

  it("computes + upserts scores/history/signals for each distinct ticker", async () => {
    const { GET } = await import("../route");
    const body = await (await GET(authedReq())).json();
    expect(body.ok).toBe(true);
    expect(body.tickerCount).toBe(2); // AAPL.US dedup
    expect(body.successfulTickerCount).toBe(2);
    expect(scoresUpsert).toHaveBeenCalledTimes(2);
    expect(historyUpsert).toHaveBeenCalledTimes(2);
    expect(signalsUpsert).toHaveBeenCalledTimes(2);
  });

  it("writes a US ticker as data_quality full/sparse and a .L ticker as degraded_uk", async () => {
    const { GET } = await import("../route");
    await (await GET(authedReq())).json();
    const dqByTicker = Object.fromEntries(
      scoresUpsert.mock.calls.map((c) => [c[0].ticker, c[0].data_quality]),
    );
    expect(dqByTicker["ULVR.L"]).toBe("degraded_uk");
    expect(dqByTicker["AAPL.US"]).not.toBe("degraded_uk");
  });

  it("a per-ticker FMP failure does not abort the whole run", async () => {
    const fmp = await import("@/lib/scoring/fmp-client");
    vi.mocked(fmp.getProfile).mockRejectedValueOnce(new Error("FMP down"));
    const { GET } = await import("../route");
    const body = await (await GET(authedReq())).json();
    expect(body.failedTickerCount).toBe(1);
    expect(body.successfulTickerCount).toBe(1);
    expect(scoresUpsert).toHaveBeenCalledTimes(1);
  });
});
