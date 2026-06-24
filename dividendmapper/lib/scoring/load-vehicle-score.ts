import type { SupabaseClient } from "@supabase/supabase-js";

// Shared loader for the public vehicle pages (/reits/[ticker], /bdcs/[ticker],
// /uk-reits/[ticker]). Mirrors load-score.ts but reads vehicle_scores +
// vehicle_score_signals + vehicle_universe + vehicle_score_history. Takes the
// Supabase client by injection so the ISR page can pass the cookieless public
// client (lib/supabase/public.ts) and stay statically rendered.

export type VehicleType = "us_reit" | "us_bdc" | "uk_reit";

export interface VehicleSignalRow {
  code: string;
  rawScore: number | null;
  weight: number;
  contribution: number;
  humanLabel: string;
}

export interface VehicleScoreLoadResult {
  ticker: string;
  vehicleType: VehicleType;
  displayName: string;
  subSector: string | null;
  resilienceScore: number | null;
  qualityGatePassed: boolean;
  failedGates: string[];
  dataQuality: "full" | "partial" | "sparse";
  computedAt: string;
  priceNavRatio: number | null;
  signals: VehicleSignalRow[];
}

export interface VehicleScoreHistoryRow {
  observed_at: string;
  price_nav_ratio: number | null;
}

// Same shape the equity loader allows: letters, digits, dot, dash.
const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;

export function normalizeTicker(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const ticker = decoded.trim().toUpperCase();
  return TICKER_RE.test(ticker) ? ticker : null;
}

type ScoreRowDb = {
  ticker: string;
  vehicle_type: VehicleType;
  resilience_score: number | null;
  quality_gate_passed: boolean;
  failed_gates: string[] | null;
  data_quality: "full" | "partial" | "sparse";
  computed_at: string;
};

type SignalRowDb = {
  signal_code: string;
  raw_score: number | null;
  weight: number | null;
  contribution: number | null;
  human_label: string;
  observed_at: string;
};

type HistoryRowDb = {
  observed_at: string;
  price_nav_ratio: number | null;
};

type UniverseRowDb = {
  ticker: string;
  display_name: string;
  sub_sector: string | null;
};

/**
 * Load the latest vehicle score + signals + universe metadata for a normalised
 * ticker. Returns null when the ticker has not been scored. Throws on a real
 * lookup error so the route can distinguish 500 from 404.
 */
export async function loadVehicleScore(
  client: SupabaseClient,
  ticker: string,
): Promise<VehicleScoreLoadResult | null> {
  const { data: score, error: scoreError } = await client
    .from("vehicle_scores")
    .select(
      "ticker, vehicle_type, resilience_score, quality_gate_passed, failed_gates, data_quality, computed_at",
    )
    .eq("ticker", ticker)
    .maybeSingle();
  if (scoreError) throw new Error("vehicle_score_lookup_failed");
  if (!score) return null;
  const row = score as ScoreRowDb;

  const { data: universe } = await client
    .from("vehicle_universe")
    .select("ticker, display_name, sub_sector")
    .eq("ticker", ticker)
    .maybeSingle();
  const universeRow = (universe as UniverseRowDb | null) ?? null;

  const { data: signalsRaw } = await client
    .from("vehicle_score_signals")
    .select("signal_code, raw_score, weight, contribution, human_label, observed_at")
    .eq("ticker", ticker)
    .order("observed_at", { ascending: false });
  const allSignals = (signalsRaw ?? []) as SignalRowDb[];
  // Keep only the most-recent observed_at — the table accumulates one set per run.
  const latestObservedAt = allSignals[0]?.observed_at ?? null;
  const latest = latestObservedAt
    ? allSignals.filter((s) => s.observed_at === latestObservedAt)
    : [];

  const { data: historyRaw } = await client
    .from("vehicle_score_history")
    .select("observed_at, price_nav_ratio")
    .eq("ticker", ticker)
    .order("observed_at", { ascending: false });
  const history = (historyRaw ?? []) as HistoryRowDb[];
  const latestPriceNavRatio =
    history.length > 0 ? toNumber(history[0].price_nav_ratio) : null;

  const signals: VehicleSignalRow[] = latest.map((s) => ({
    code: s.signal_code,
    rawScore: toNumber(s.raw_score),
    weight: toNumber(s.weight) ?? 0,
    contribution: toNumber(s.contribution) ?? 0,
    humanLabel: s.human_label,
  }));
  // Largest contribution first so the template + Pro detail share the order.
  signals.sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0));

  return {
    ticker: row.ticker,
    vehicleType: row.vehicle_type,
    displayName: universeRow?.display_name ?? row.ticker,
    subSector: universeRow?.sub_sector ?? null,
    resilienceScore: toNumber(row.resilience_score),
    qualityGatePassed: row.quality_gate_passed,
    failedGates: row.failed_gates ?? [],
    dataQuality: row.data_quality,
    computedAt: row.computed_at,
    priceNavRatio: latestPriceNavRatio,
    signals,
  };
}

/**
 * Load the price/NAV history for the sparkline. Window is `days` calendar days
 * back from today.
 */
export async function loadVehicleScoreHistory(
  client: SupabaseClient,
  ticker: string,
  days: number,
): Promise<VehicleScoreHistoryRow[]> {
  const from = new Date(Date.now() - days * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data, error } = await client
    .from("vehicle_score_history")
    .select("observed_at, price_nav_ratio")
    .eq("ticker", ticker)
    .gte("observed_at", from)
    .order("observed_at", { ascending: true });
  if (error) throw new Error("vehicle_score_history_lookup_failed");
  return (data ?? []) as VehicleScoreHistoryRow[];
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
