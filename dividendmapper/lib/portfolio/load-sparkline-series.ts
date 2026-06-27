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

  const since = daysAgoIso(RANGE_DAYS[range]);
  const { data, error } = await supabase
    .from("ticker_price_history")
    .select("ticker, trade_date, close, currency")
    .in("ticker", tickers)
    .gte("trade_date", since)
    .order("ticker", { ascending: true })
    .order("trade_date", { ascending: true });

  if (error || !data) return out;

  const grouped = new Map<string, { close: number; currency: string }[]>();
  for (const row of data as { ticker: string; close: number; currency: string }[]) {
    if (!grouped.has(row.ticker)) grouped.set(row.ticker, []);
    grouped.get(row.ticker)!.push({ close: Number(row.close), currency: row.currency });
  }

  for (const [ticker, rows] of grouped) {
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
