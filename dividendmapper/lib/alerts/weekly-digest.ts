// Pure weekly-digest logic. No I/O.
//
// Two responsibilities:
//   1. pickCurrentAndBaseline — from a ticker's history (newest-first), choose the
//      current snapshot and the closest snapshot on/before a cutoff date (~7d ago).
//   2. selectWeeklyMovers — decide which tickers "moved" over the window, and
//      separately count how many fresh tickers have no baseline yet so the email
//      can tell users honestly that some of their portfolio is too new to compare.
//
// Inclusion rule: resilience delta != 0 OR risk delta != 0 OR |price swing %| >= 5.
// A degraded_uk data gap can move a score artificially; never report it (mirrors
// build-digest.ts). A ticker missing a baseline cannot have a delta and is skipped
// from the movers list — but counted in pendingBaselineCount so the email can
// surface "your recap will fill out once we have a week of scores" copy instead
// of silently rendering the quiet-week message.

export const PRICE_SWING_THRESHOLD = 5; // percent

export interface HistoryRow {
  observed_at: string; // YYYY-MM-DD
  buy_score: number | null;
  risk_score: number | null;
  current_price: number | null;
}

export interface CurrentBaseline {
  current: HistoryRow | null;
  baseline: HistoryRow | null;
}

export interface WeeklyObservation {
  ticker: string;
  currResilience: number | null;
  baseResilience: number | null;
  currRisk: number | null;
  baseRisk: number | null;
  currPrice: number | null;
  basePrice: number | null;
  dataQuality: "full" | "degraded_uk" | "sparse";
}

export interface MetricMove {
  curr: number;
  delta: number;
  direction: "up" | "down" | "flat";
}

export interface PriceMove {
  swingPct: number; // signed, one decimal place
  direction: "up" | "down" | "flat";
}

export interface WeeklyMover {
  ticker: string;
  resilience: MetricMove | null;
  risk: MetricMove | null;
  price: PriceMove | null;
}

export interface WeeklyDigestSelection {
  movers: WeeklyMover[];
  pendingBaselineCount: number;
}

export function pickCurrentAndBaseline(rowsDesc: HistoryRow[], cutoff: string): CurrentBaseline {
  const current = rowsDesc[0] ?? null;
  const baseline = rowsDesc.find((r) => r.observed_at <= cutoff) ?? null;
  return { current, baseline };
}

function dir(delta: number): "up" | "down" | "flat" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

function scoreMove(curr: number | null, base: number | null): MetricMove | null {
  if (curr === null || base === null) return null;
  const delta = curr - base;
  return { curr, delta, direction: dir(delta) };
}

function priceMove(curr: number | null, base: number | null): PriceMove | null {
  if (curr === null || base === null || base === 0) return null;
  const swingPct = Math.round(((curr - base) / base) * 1000) / 10; // 1 dp
  return { swingPct, direction: dir(swingPct) };
}

export function selectWeeklyMovers(observations: WeeklyObservation[]): WeeklyDigestSelection {
  const movers: WeeklyMover[] = [];
  let pendingBaselineCount = 0;
  for (const o of observations) {
    if (o.dataQuality === "degraded_uk") continue;

    const resilience = scoreMove(o.currResilience, o.baseResilience);
    const risk = scoreMove(o.currRisk, o.baseRisk);
    const price = priceMove(o.currPrice, o.basePrice);

    const qualifies =
      (resilience !== null && resilience.delta !== 0) ||
      (risk !== null && risk.delta !== 0) ||
      (price !== null && Math.abs(price.swingPct) >= PRICE_SWING_THRESHOLD);

    if (qualifies) {
      movers.push({ ticker: o.ticker, resilience, risk, price });
      continue;
    }

    // Did not qualify. If it's because we have current data but no baseline at
    // all (fresh ticker added < 7d ago, or cron only started recently), count
    // it so the email can distinguish "all steady" from "too new to compare".
    const hasAnyCurrent = o.currResilience !== null || o.currRisk !== null || o.currPrice !== null;
    const hasNoBaseline = o.baseResilience === null && o.baseRisk === null && o.basePrice === null;
    if (hasAnyCurrent && hasNoBaseline) {
      pendingBaselineCount++;
    }
  }
  return { movers, pendingBaselineCount };
}
