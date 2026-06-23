import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

beforeEach(() => {
  fetchMock.mockReset();
  process.env.FMP_API_KEY = "test-key-abc";
});

afterEach(() => {
  vi.resetModules();
});

// Minimal canned EOD response covering 5 days for USD-quoted ticker O. The
// fetcher should pass close through unchanged and return rows shaped for
// vehicle_prices: { ticker, observed_at, close_price }.
const O_EOD_USD = [
  { symbol: "O", date: "2026-06-20", close: 57.12, high: 57.5, low: 56.9 },
  { symbol: "O", date: "2026-06-19", close: 56.84, high: 57.1, low: 56.6 },
  { symbol: "O", date: "2026-06-18", close: 56.95, high: 57.3, low: 56.7 },
  { symbol: "O", date: "2026-06-17", close: 57.21, high: 57.4, low: 57.0 },
  { symbol: "O", date: "2026-06-16", close: 57.05, high: 57.2, low: 56.8 },
];

// LSE-quoted ticker in pence (GBp / GBX). Source close is in pence; the
// fetcher must normalise to GBP (divide by 100) so the persisted price is
// consistent with the USD denomination across families.
const BLND_EOD_GBX = [
  { symbol: "BLND.L", date: "2026-06-20", close: 412.6, high: 415.0, low: 410.2 },
  { symbol: "BLND.L", date: "2026-06-19", close: 410.8, high: 412.0, low: 408.5 },
];

// One US REIT quarter (Realty Income) — values approximate enough to drive
// the shape test. Realistic enough that hand-checked period_end maps cleanly.
const O_INCOME_Q = [
  { date: "2026-03-31", calendarYear: "2026", period: "Q1", revenue: 1320000000, ebitda: 1180000000, interestExpense: 230000000, netIncome: 250000000, weightedAverageShsOut: 870000000 },
  { date: "2025-12-31", calendarYear: "2025", period: "Q4", revenue: 1280000000, ebitda: 1140000000, interestExpense: 220000000, netIncome: 240000000, weightedAverageShsOut: 868000000 },
];
const O_BALANCE_Q = [
  { date: "2026-03-31", totalDebt: 27000000000, totalEquity: 38000000000, totalAssets: 70000000000 },
  { date: "2025-12-31", totalDebt: 26500000000, totalEquity: 37800000000, totalAssets: 69500000000 },
];
const O_KEYMETRICS_Q = [
  { date: "2026-03-31", bookValuePerShare: 43.68, debtToEquity: 0.71 },
  { date: "2025-12-31", bookValuePerShare: 43.55, debtToEquity: 0.70 },
];

const ARCC_INCOME_Q = [
  { date: "2026-03-31", calendarYear: "2026", period: "Q1", interestIncome: 580000000, totalOtherIncomeExpensesNet: -120000000, netIncome: 460000000, weightedAverageShsOut: 630000000 },
];
const ARCC_BALANCE_Q = [
  { date: "2026-03-31", totalDebt: 12000000000, totalEquity: 12300000000, totalAssets: 26800000000 },
];
const ARCC_KEYMETRICS_Q = [
  { date: "2026-03-31", bookValuePerShare: 19.52, debtToEquity: 0.97 },
];

// UK REIT — semi-annual cadence; FMP reports as "annual" period for half-year
// interims and annuals indiscriminately, distinguished by date spacing.
const BLND_INCOME_A = [
  { date: "2026-03-31", calendarYear: "2026", period: "FY", revenue: 540000000, ebitda: 380000000, interestExpense: 95000000, netIncome: 120000000, weightedAverageShsOut: 970000000 },
  { date: "2025-09-30", calendarYear: "2026", period: "H1", revenue: 270000000, ebitda: 195000000, interestExpense: 48000000, netIncome: 65000000, weightedAverageShsOut: 970000000 },
];
const BLND_BALANCE_A = [
  { date: "2026-03-31", totalDebt: 4200000000, totalEquity: 6900000000, totalAssets: 11800000000 },
  { date: "2025-09-30", totalDebt: 4150000000, totalEquity: 6850000000, totalAssets: 11700000000 },
];
const BLND_KEYMETRICS_A = [
  { date: "2026-03-31", bookValuePerShare: 711.34, debtToEquity: 0.61 },
  { date: "2025-09-30", bookValuePerShare: 706.18, debtToEquity: 0.61 },
];

describe("vehicle-fmp / fetchVehicleFundamentals", () => {
  it("us_reit: returns quarterly rows with NAV, debt, EBITDA, interest expense populated", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(O_INCOME_Q), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(O_BALANCE_Q), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(O_KEYMETRICS_Q), { status: 200 }));
    const mod = await import("../vehicle-fmp");
    const rows = await mod.fetchVehicleFundamentals("O", "us_reit", "USD");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      ticker: "O",
      period_end: "2026-03-31",
      period_type: "quarterly",
      nav_per_share: 43.68,
      debt_total: 27000000000,
      equity_total: 38000000000,
      ebitda: 1180000000,
      interest_expense: 230000000,
    });
  });

  it("us_bdc: returns quarterly rows; NII left to signal-time derivation", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(ARCC_INCOME_Q), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ARCC_BALANCE_Q), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ARCC_KEYMETRICS_Q), { status: 200 }));
    const mod = await import("../vehicle-fmp");
    const rows = await mod.fetchVehicleFundamentals("ARCC", "us_bdc", "USD");
    expect(rows[0]).toMatchObject({
      ticker: "ARCC",
      period_end: "2026-03-31",
      period_type: "quarterly",
      nav_per_share: 19.52,
      debt_total: 12000000000,
      equity_total: 12300000000,
    });
  });

  it("uk_reit: returns semi_annual rows; debt+equity left in GBP (no ÷100 — already absolute)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(BLND_INCOME_A), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(BLND_BALANCE_A), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(BLND_KEYMETRICS_A), { status: 200 }));
    const mod = await import("../vehicle-fmp");
    const rows = await mod.fetchVehicleFundamentals("BLND.L", "uk_reit", "GBX");
    expect(rows[0]).toMatchObject({
      ticker: "BLND.L",
      period_end: "2026-03-31",
      period_type: "semi_annual",
      debt_total: 4200000000,   // absolute £, NOT ÷100 (only per-share quantities scale)
      equity_total: 6900000000,
    });
    expect(rows[0].nav_per_share).toBe(7.1134); // 711.34p ÷ 100 = £7.1134 per share
  });

  it("uk_reit uses 'income-statement?period=annual' (UK semi-annuals report there)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../vehicle-fmp");
    await mod.fetchVehicleFundamentals("BLND.L", "uk_reit", "GBX");
    const incomeUrl = fetchMock.mock.calls[0][0] as string;
    expect(incomeUrl).toContain("/stable/income-statement?");
    expect(incomeUrl).toContain("period=annual");
  });
});

const O_DIVS_USD = [
  { date: "2026-06-01", dividend: 0.2725, adjDividend: 0.2725, paymentDate: "2026-06-15" },
  { date: "2026-05-01", dividend: 0.265,  adjDividend: 0.265,  paymentDate: "2026-05-15" },
];

const BLND_DIVS_GBX = [
  { date: "2026-02-12", dividend: 11.52, adjDividend: 11.52, paymentDate: "2026-05-15" },
  { date: "2025-11-13", dividend: 6.39,  adjDividend: 6.39,  paymentDate: "2026-02-12" },
];

describe("vehicle-fmp / fetchVehicleDividendHistory", () => {
  it("returns dividend rows for a USD ticker", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(O_DIVS_USD), { status: 200 }));
    const mod = await import("../vehicle-fmp");
    const rows = await mod.fetchVehicleDividendHistory("O", 5, "USD");
    expect(rows[0]).toEqual({
      ticker: "O",
      ex_date: "2026-06-01",
      payment_date: "2026-06-15",
      dividend: 0.2725,
    });
  });

  it("converts GBX dividend to GBP (÷100) for UK tickers", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(BLND_DIVS_GBX), { status: 200 }));
    const mod = await import("../vehicle-fmp");
    const rows = await mod.fetchVehicleDividendHistory("BLND.L", 5, "GBX");
    expect(rows[0].dividend).toBe(0.1152);
    expect(rows[1].dividend).toBe(0.0639);
  });

  it("requests yearsBack × 12 records (monthly-payer pessimistic)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../vehicle-fmp");
    await mod.fetchVehicleDividendHistory("O", 10, "USD");
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/stable/dividends?");
    expect(calledUrl).toContain("limit=120");
  });

  it("handles missing paymentDate gracefully", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ date: "2026-06-01", dividend: 0.27, adjDividend: 0.27 }]), { status: 200 }),
    );
    const mod = await import("../vehicle-fmp");
    const rows = await mod.fetchVehicleDividendHistory("O", 1, "USD");
    expect(rows[0].payment_date).toBeNull();
  });
});

describe("vehicle-fmp / fetchVehiclePrices", () => {
  it("returns close_price rows for a USD ticker", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(O_EOD_USD), { status: 200 }));
    const mod = await import("../vehicle-fmp");
    const rows = await mod.fetchVehiclePrices("O", 10, "USD");
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({ ticker: "O", observed_at: "2026-06-20", close_price: 57.12 });
    expect(rows[4]).toEqual({ ticker: "O", observed_at: "2026-06-16", close_price: 57.05 });
  });

  it("converts LSE GBX close to GBP (÷100) for UK tickers", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(BLND_EOD_GBX), { status: 200 }));
    const mod = await import("../vehicle-fmp");
    const rows = await mod.fetchVehiclePrices("BLND.L", 10, "GBX");
    expect(rows[0]).toEqual({ ticker: "BLND.L", observed_at: "2026-06-20", close_price: 4.126 });
    expect(rows[1]).toEqual({ ticker: "BLND.L", observed_at: "2026-06-19", close_price: 4.108 });
  });

  it("returns [] when FMP returns an empty array", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../vehicle-fmp");
    expect(await mod.fetchVehiclePrices("ZZZ", 10, "USD")).toEqual([]);
  });

  it("calls FMP historical-price-eod/full with computed from/to range", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../vehicle-fmp");
    await mod.fetchVehiclePrices("O", 30, "USD");
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/stable/historical-price-eod/full?");
    expect(calledUrl).toContain("symbol=O");
    expect(calledUrl).toMatch(/from=\d{4}-\d{2}-\d{2}/);
    expect(calledUrl).toMatch(/to=\d{4}-\d{2}-\d{2}/);
  });
});
