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
