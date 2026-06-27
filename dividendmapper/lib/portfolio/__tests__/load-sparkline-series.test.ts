import { describe, it, expect } from "vitest";
import {
  loadSparklineSeriesByTicker,
  downsampleSeries,
  sliceSeriesForRange,
  RANGE_DAYS,
} from "../load-sparkline-series";

function fakeSupabase(
  rows: { ticker: string; trade_date: string; close: number; currency: string }[],
) {
  // Mirrors the per-ticker `from().select().eq().gte().order().range()` chain
  // that load-sparkline-series uses to dodge PostgREST's 1000-row hard cap.
  return {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, ticker: string) => ({
          gte: (_col2: string, _val: string) => ({
            order: () => ({
              range: () =>
                Promise.resolve({
                  data: rows.filter((r) => r.ticker === ticker),
                  error: null,
                }),
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

  it("returns raw daily points for 5Y range (client re-slices per active range)", async () => {
    const rows = Array.from({ length: 1260 }, (_, i) => ({
      ticker: "AAPL",
      trade_date: `2021-01-${String((i % 28) + 1).padStart(2, "0")}`,
      close: 200 + i,
      currency: "USD",
    }));
    const supabase = fakeSupabase(rows);
    const out = await loadSparklineSeriesByTicker(supabase as never, ["AAPL"], "5Y");
    const series = out.get("AAPL")!;
    expect(series.points.length).toBe(1260);
    expect(series.firstClose).toBe(200);
    expect(series.lastClose).toBe(200 + 1259);
  });
});

describe("sliceSeriesForRange", () => {
  const full = {
    points: Array.from({ length: 1260 }, (_, i) => 100 + i),
    firstClose: 100,
    lastClose: 100 + 1259,
    currency: "USD",
  };

  it("returns null for missing or empty series", () => {
    expect(sliceSeriesForRange(undefined, "30D")).toBeNull();
    expect(
      sliceSeriesForRange(
        { points: [], firstClose: 0, lastClose: 0, currency: "USD" },
        "30D",
      ),
    ).toBeNull();
  });

  it("30D slices the last ~22 trading days", () => {
    const s = sliceSeriesForRange(full, "30D")!;
    expect(s.points.length).toBe(22);
    expect(s.lastClose).toBe(full.lastClose);
    expect(s.firstClose).toBe(full.points[full.points.length - 22]);
  });

  it("1Y slices the last ~252 trading days", () => {
    const s = sliceSeriesForRange(full, "1Y")!;
    expect(s.points.length).toBe(252);
    expect(s.lastClose).toBe(full.lastClose);
  });

  it("5Y returns the full window, downsampled to ~100 points", () => {
    const s = sliceSeriesForRange(full, "5Y")!;
    expect(s.points.length).toBeGreaterThan(95);
    expect(s.points.length).toBeLessThanOrEqual(110);
    expect(s.firstClose).toBe(100);
    expect(s.lastClose).toBe(100 + 1259);
  });

  it("preserves currency through the slice", () => {
    const gbp = { ...full, currency: "GBp" };
    expect(sliceSeriesForRange(gbp, "30D")!.currency).toBe("GBp");
  });
});
