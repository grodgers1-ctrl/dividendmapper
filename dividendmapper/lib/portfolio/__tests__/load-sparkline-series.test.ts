import { describe, it, expect } from "vitest";
import {
  loadSparklineSeriesByTicker,
  downsampleSeries,
  RANGE_DAYS,
} from "../load-sparkline-series";

function fakeSupabase(
  rows: { ticker: string; trade_date: string; close: number; currency: string }[],
) {
  return {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        in: (_col: string, _vals: string[]) => ({
          gte: (_col2: string, _val: string) => ({
            order: () => ({
              order: () => Promise.resolve({ data: rows, error: null }),
            }),
          }),
        }),
      }),
    }),
  };
}

describe("downsampleSeries", () => {
  it("returns input unchanged when under target", () => {
    const xs = [1, 2, 3, 4, 5];
    expect(downsampleSeries(xs, 100)).toEqual(xs);
  });

  it("strides 1260 points down to ~100", () => {
    const xs = Array.from({ length: 1260 }, (_, i) => i);
    const out = downsampleSeries(xs, 100);
    expect(out.length).toBeGreaterThan(95);
    expect(out.length).toBeLessThanOrEqual(110);
    expect(out[0]).toBe(0);
    expect(out.at(-1)).toBe(1259);
  });
});

describe("loadSparklineSeriesByTicker", () => {
  it("returns sliced series keyed by ticker", async () => {
    const rows = [
      { ticker: "AAPL", trade_date: "2026-05-01", close: 200, currency: "USD" },
      { ticker: "AAPL", trade_date: "2026-05-02", close: 202, currency: "USD" },
      { ticker: "AAPL", trade_date: "2026-05-03", close: 201, currency: "USD" },
      { ticker: "PYPL", trade_date: "2026-05-03", close: 70, currency: "USD" },
    ];
    const supabase = fakeSupabase(rows);
    const out = await loadSparklineSeriesByTicker(
      supabase as never,
      ["AAPL", "PYPL"],
      "30D",
    );
    expect(out.get("AAPL")?.points).toEqual([200, 202, 201]);
    expect(out.get("AAPL")?.firstClose).toBe(200);
    expect(out.get("AAPL")?.lastClose).toBe(201);
    expect(out.get("AAPL")?.currency).toBe("USD");
    expect(out.get("PYPL")?.points).toEqual([70]);
  });

  it("returns empty map when no tickers requested", async () => {
    const supabase = fakeSupabase([]);
    const out = await loadSparklineSeriesByTicker(supabase as never, [], "30D");
    expect(out.size).toBe(0);
  });

  it("uses range-appropriate days threshold", () => {
    expect(RANGE_DAYS["30D"]).toBe(30);
    expect(RANGE_DAYS["1Y"]).toBe(365);
    expect(RANGE_DAYS["5Y"]).toBe(1825);
  });

  it("downsamples 5Y range to ~100 points per ticker", async () => {
    const rows = Array.from({ length: 1260 }, (_, i) => ({
      ticker: "AAPL",
      trade_date: `2021-01-${String((i % 28) + 1).padStart(2, "0")}`,
      close: 200 + i,
      currency: "USD",
    }));
    const supabase = fakeSupabase(rows);
    const out = await loadSparklineSeriesByTicker(supabase as never, ["AAPL"], "5Y");
    const series = out.get("AAPL")!;
    expect(series.points.length).toBeGreaterThan(95);
    expect(series.points.length).toBeLessThanOrEqual(110);
    expect(series.firstClose).toBe(200);
    expect(series.lastClose).toBe(200 + 1259);
  });
});
