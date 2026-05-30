import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same shape the holdings POST validates against — letters, digits, dot, dash.
const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;

type ScoreType = "buy" | "trim" | "risk";

type SignalRowDb = {
  score_type: string;
  signal_code: string;
  human_label: string;
  contribution: number | null;
  raw_points: number | null;
  weight: number | null;
  observed_at: string;
};

type SignalRow = {
  signalCode: string;
  humanLabel: string;
  contribution: number | null;
  rawPoints: number | null;
  weight: number | null;
};

/**
 * Public-read score lookup for one ticker. Feeds the holdings-table score
 * drawer (lazy-loaded on open) and, later, the public /scoring pages.
 *
 *   GET /api/scoring/[ticker]
 *
 * equity_scores + equity_score_signals are public-read (RLS), so no auth.
 * 404 when the ticker has not been scored yet.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: raw } = await params;
  const ticker = decodeURIComponent(raw).trim().toUpperCase();
  if (!TICKER_RE.test(ticker)) {
    return NextResponse.json({ error: "invalid_ticker" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: score, error: scoreError } = await supabase
    .from("equity_scores")
    .select(
      "ticker, buy_score, trim_score, risk_score, buy_quality_gate_passed, buy_failed_gates, data_quality, computed_at",
    )
    .eq("ticker", ticker)
    .maybeSingle();

  if (scoreError) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!score) {
    return NextResponse.json({ error: "not_scored" }, { status: 404 });
  }

  const { data: signalsRaw } = await supabase
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

  return NextResponse.json({
    ticker: score.ticker,
    buyScore: score.buy_score,
    trimScore: score.trim_score,
    riskScore: score.risk_score,
    buyQualityGatePassed: score.buy_quality_gate_passed,
    buyFailedGates: score.buy_failed_gates ?? [],
    dataQuality: score.data_quality,
    computedAt: score.computed_at,
    signals,
  });
}
