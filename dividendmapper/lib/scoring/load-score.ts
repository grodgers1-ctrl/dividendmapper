import type { SupabaseClient } from "@supabase/supabase-js";

// Shared score loader for one ticker. The public data API
// (app/api/scoring/[ticker]/route.ts) and the public /scoring/[ticker] page
// both read the same equity_scores + equity_score_signals shape, so the query
// lives here once and takes the Supabase client by injection: the route passes
// the cookie-bound server client; the ISR page passes the cookieless public
// client (lib/supabase/public.ts) so it can stay statically rendered.

export type ScoreType = "buy" | "trim" | "risk";

export interface SignalRow {
  signalCode: string;
  humanLabel: string;
  contribution: number | null;
  rawPoints: number | null;
  weight: number | null;
}

export interface ScoreResult {
  ticker: string;
  buyScore: number | null;
  trimScore: number | null;
  riskScore: number | null;
  buyQualityGatePassed: boolean;
  buyFailedGates: string[];
  dataQuality: string;
  computedAt: string;
  // FundamentalsCard inputs persisted by the nightly scoring cron. Null until
  // the first cron run after migration 0014.
  sector: string | null;
  forwardPe: number | null;
  trailingPe: number | null;
  payoutRatio: number | null;
  fcfCoverage: number | null;
  dividendCagr5y: number | null;
  signals: Record<ScoreType, SignalRow[]>;
}

type ScoreRowDb = {
  ticker: string;
  buy_score: number | null;
  trim_score: number | null;
  risk_score: number | null;
  buy_quality_gate_passed: boolean;
  buy_failed_gates: string[] | null;
  data_quality: string;
  computed_at: string;
  sector: string | null;
  forward_pe: number | null;
  trailing_pe: number | null;
  payout_ratio: number | null;
  fcf_coverage: number | null;
  dividend_cagr_5y: number | null;
};

type SignalRowDb = {
  score_type: string;
  signal_code: string;
  human_label: string;
  contribution: number | null;
  raw_points: number | null;
  weight: number | null;
  observed_at: string;
};

// Same shape the holdings POST validates against: letters, digits, dot, dash.
const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;

/**
 * Decode, trim, and uppercase a raw ticker from a URL segment. Returns null for
 * anything that fails the character/length whitelist (callers turn that into a
 * 400 / notFound), including malformed percent-encoding.
 */
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

/**
 * Load the latest score + signals for an already-normalised ticker. Returns
 * null when the ticker has not been scored. Throws on a real lookup error so
 * the route can distinguish 500 from 404.
 */
export async function loadScore(
  client: SupabaseClient,
  ticker: string,
): Promise<ScoreResult | null> {
  const { data: score, error: scoreError } = await client
    .from("equity_scores")
    .select(
      "ticker, buy_score, trim_score, risk_score, buy_quality_gate_passed, buy_failed_gates, data_quality, computed_at, sector, forward_pe, trailing_pe, payout_ratio, fcf_coverage, dividend_cagr_5y",
    )
    .eq("ticker", ticker)
    .maybeSingle();

  if (scoreError) throw new Error("score_lookup_failed");
  if (!score) return null;
  const row = score as ScoreRowDb;

  const { data: signalsRaw } = await client
    .from("equity_score_signals")
    .select(
      "score_type, signal_code, human_label, contribution, raw_points, weight, observed_at",
    )
    .eq("ticker", ticker)
    .order("observed_at", { ascending: false });

  const allSignals = (signalsRaw ?? []) as SignalRowDb[];
  // Keep only the most recent run; the table accumulates one set per observed_at.
  const latestObservedAt = allSignals[0]?.observed_at ?? null;
  const latest = latestObservedAt
    ? allSignals.filter((s) => s.observed_at === latestObservedAt)
    : [];

  const signals: Record<ScoreType, SignalRow[]> = { buy: [], trim: [], risk: [] };
  for (const s of latest) {
    if (s.score_type !== "buy" && s.score_type !== "trim" && s.score_type !== "risk") {
      continue;
    }
    signals[s.score_type].push({
      signalCode: s.signal_code,
      humanLabel: s.human_label,
      contribution: s.contribution,
      rawPoints: s.raw_points,
      weight: s.weight,
    });
  }
  for (const key of ["buy", "trim", "risk"] as ScoreType[]) {
    signals[key].sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0));
  }

  return {
    ticker: row.ticker,
    buyScore: row.buy_score,
    trimScore: row.trim_score,
    riskScore: row.risk_score,
    buyQualityGatePassed: row.buy_quality_gate_passed,
    buyFailedGates: row.buy_failed_gates ?? [],
    dataQuality: row.data_quality,
    computedAt: row.computed_at,
    sector: row.sector,
    forwardPe: row.forward_pe != null ? Number(row.forward_pe) : null,
    trailingPe: row.trailing_pe != null ? Number(row.trailing_pe) : null,
    payoutRatio: row.payout_ratio != null ? Number(row.payout_ratio) : null,
    fcfCoverage: row.fcf_coverage != null ? Number(row.fcf_coverage) : null,
    dividendCagr5y: row.dividend_cagr_5y != null ? Number(row.dividend_cagr_5y) : null,
    signals,
  };
}
