import type { SupabaseClient } from "@supabase/supabase-js";

export type SparklineRange = "30D" | "1Y" | "5Y";

export const RANGE_DAYS: Record<SparklineRange, number> = {
  "30D": 30,
  "1Y": 365,
  "5Y": 1825,
};

const DOWNSAMPLE_TARGET = 100;

export interface SparklineSeries {
  points: number[];
  firstClose: number;
  lastClose: number;
  currency: string;
}

export function downsampleSeries(points: number[], target: number): number[] {
  if (points.length <= target) return points;
  const stride = Math.ceil(points.length / target);
  const out: number[] = [];
  for (let i = 0; i < points.length; i += stride) out.push(points[i]);
  // Always retain the last point so the line ends where reality ends.
  if (out.at(-1) !== points.at(-1)) out.push(points.at(-1)!);
  return out;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function loadSparklineSeriesByTicker(
  supabase: SupabaseClient,
  tickers: string[],
  range: SparklineRange,
): Promise<Map<string, SparklineSeries>> {
  const out = new Map<string, SparklineSeries>();
  if (tickers.length === 0) return out;

  // Per-ticker queries in parallel — Supabase/PostgREST hard-caps responses at
  // 1000 rows, and a single `.in("ticker", [...])` over a multi-year window
  // silently truncates: only the alphabetically-first ticker comes back full,
  // the rest get partial or zero rows. Each per-ticker query is bounded by
  // <= 5Y daily closes (~1300 rows worst case, ~965 typical) so we slice with
  // `.range(0, 2999)` to stay well above the realistic ceiling.
  const since = daysAgoIso(RANGE_DAYS[range]);
  const perTicker = await Promise.all(
    tickers.map(async (ticker) => {
      const { data, error } = await supabase
        .from("ticker_price_history")
        .select("trade_date, close, currency")
        .eq("ticker", ticker)
        .gte("trade_date", since)
        .order("trade_date", { ascending: true })
        .range(0, 2999);
      if (error || !data) return { ticker, rows: [] as { close: number; currency: string }[] };
      return {
        ticker,
        rows: data.map((r) => ({
          close: Number((r as { close: number }).close),
          currency: (r as { currency: string }).currency,
        })),
      };
    }),
  );

  for (const { ticker, rows } of perTicker) {
    if (rows.length === 0) continue;
    const points = rows.map((r) => r.close);
    const downsampled =
      range === "5Y" ? downsampleSeries(points, DOWNSAMPLE_TARGET) : points;
    out.set(ticker, {
      points: downsampled,
      firstClose: points[0],
      lastClose: points.at(-1)!,
      currency: rows[0].currency,
    });
  }

  return out;
}
