import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/scoring/fmp-client", () => {
  const arr = () => vi.fn().mockResolvedValue([]);
  return {
    getProfile: vi.fn().mockResolvedValue([
      { symbol: "TEST", mktCap: 5_000_000_000, industry: "Software - Application", currency: "USD", companyName: "Test Co" },
    ]),
    getRatiosTtm: vi.fn().mockResolvedValue([{ symbol: "TEST", dividendPayoutRatioTTM: 0.4, dividendYieldTTM: 0.03 }]),
    getRatiosQuarterly: arr(),
    getDividends: vi.fn().mockResolvedValue([{ date: "2026-05-01", adjDividend: 0.25, dividend: 0.25 }]),
    getIncomeStatementQuarterly: vi.fn().mockResolvedValue([{ operatingIncome: 250, interestExpense: 50, netIncome: 200 }]),
    getCashFlowStatementQuarterly: vi.fn().mockResolvedValue([{ freeCashFlow: 300, netDividendsPaid: -100 }]),
    getBalanceSheetStatementQuarterly: arr(),
    getKeyMetricsTtm: vi.fn().mockResolvedValue([{ netDebtToEBITDATTM: 1.5 }]),
    getKeyMetricsQuarterly: arr(),
    getAnalystEstimates: vi.fn().mockResolvedValue([{ date: "2027-09-27", epsAvg: 10 }]),
    getDcf: vi.fn().mockResolvedValue([{ symbol: "TEST", dcf: 150, "Stock Price": 120 }]),
    getSma: vi.fn().mockResolvedValue([{ date: "2026-05-29", close: 130, high: 131, low: 129, sma: 110 }]),
    getRsi: vi.fn().mockResolvedValue([{ date: "2026-05-29", close: 130, high: 131, low: 129, rsi: 65 }]),
    getHistoricalEod: vi.fn().mockResolvedValue([{ symbol: "TEST", date: "2026-05-29", close: 130, high: 131, low: 129 }]),
    getPriceTargetConsensus: vi.fn().mockResolvedValue([{ symbol: "TEST", targetMedian: 155 }]),
    getGradesHistorical: arr(),
    getInsiderTrades: arr(),
    // getDividendsCalendar is NOT called by scoreTicker (calendar is passed in),
    // but the module imports it — keep a stub so the import resolves.
    getDividendsCalendar: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { scoreTicker } from "@/lib/scoring/score-ticker";

function makeAdmin() {
  const upserts: Record<string, unknown[]> = {};
  const chain = (table: string) => ({
    select: vi.fn(() => chain(table)),
    eq: vi.fn(() => chain(table)),
    order: vi.fn(() => chain(table)),
    limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    upsert: vi.fn((rows: unknown) => {
      upserts[table] = (upserts[table] ?? []).concat(rows as unknown[]);
      return Promise.resolve({ error: null });
    }),
  });
  return {
    upserts,
    client: { from: vi.fn((table: string) => chain(table)) } as unknown as import("@supabase/supabase-js").SupabaseClient,
  };
}

describe("scoreTicker", () => {
  it("upserts equity_scores, equity_score_history and equity_score_signals", async () => {
    const { client, upserts } = makeAdmin();
    await scoreTicker(client, "TEST", [], "2026-06-12");
    expect(upserts["equity_scores"]).toBeDefined();
    expect((upserts["equity_scores"][0] as { ticker: string }).ticker).toBe("TEST");
    expect(upserts["equity_score_history"]).toBeDefined();
    expect(upserts["equity_score_signals"]).toBeDefined();
    expect((upserts["equity_score_signals"] as unknown[]).length).toBeGreaterThan(0);
  });

  it("persists the FundamentalsCard fields on equity_scores", async () => {
    const { client, upserts } = makeAdmin();
    await scoreTicker(client, "TEST", [], "2026-06-12");
    const row = upserts["equity_scores"][0] as Record<string, unknown>;
    // sector is classified from FMP profile.industry — "Software - Application" → "technology".
    expect(row.sector).toBe("technology");
    // payout_ratio comes from FMP ratiosTtm.dividendPayoutRatioTTM (0.4 in the mock).
    expect(row.payout_ratio).toBe(0.4);
    // forward_pe: US ticker, price (latest close 130) / fwdEps (10) = 13.
    expect(row.forward_pe).toBe(13);
    // fcf_coverage: TTM fcf (300) / TTM dividends paid (100) = 3.
    expect(row.fcf_coverage).toBe(3);
    // Only one dividend in the mock — cannot compute 5y CAGR; expect null.
    expect(row.dividend_cagr_5y).toBeNull();
  });

  it("throws when an upsert returns an error (so the caller can count it)", async () => {
    // Reads (loadPriorHistory) succeed; every upsert errors. The first upsert is
    // equity_scores, so scoreTicker should reject before finishing.
    const chain = (): Record<string, unknown> => ({
      select: vi.fn(() => chain()),
      eq: vi.fn(() => chain()),
      order: vi.fn(() => chain()),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      upsert: vi.fn(() => Promise.resolve({ error: { message: "boom" } })),
    });
    const client = { from: vi.fn(() => chain()) } as unknown as import("@supabase/supabase-js").SupabaseClient;
    await expect(scoreTicker(client, "TEST", [], "2026-06-12")).rejects.toBeTruthy();
  });
});
