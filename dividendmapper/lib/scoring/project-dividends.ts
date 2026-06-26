// Bidirectional dividend projection engine. Pure — no DB, no rendering.
// Inputs: per-ticker FMP historical payments + a single holding row.
// Outputs: ProjectedPayment[] for the requested direction.
//
// Algorithm:
//   1. Cadence detection by year-count mode, with median inter-payment gap as fallback.
//   2. 3yr CAGR growth rate over COMPLETE calendar years only (partial-year
//      tails are dropped so YTD payments don't skew the rate). Capped ±20%.
//   3. Cut/freeze dominance: latest payment < 95% of trailing-12m-avg → 0 growth.
//   4. Sub-history fallback (<2 payments) → cadence='unknown' → return [].
//      Histories of 2-3 records use median-gap detection with growth-unknown
//      confidence (year-count requires 2+ complete years).
//   5. Backward direction: floor = max(holding.createdAt, today - 6mo).

export type Cadence = "monthly" | "quarterly" | "semi" | "annual" | "irregular" | "unknown";

export type ProjectionConfidence =
  | "cadence"
  | "cadence+growth"
  | "growth-clipped"
  | "growth-unknown";

export interface HistoricalPayment {
  exDate: string;       // YYYY-MM-DD
  amount: number;       // per-share native
}

export interface ProjectedPayment {
  exDate: string;
  payDate: string;
  perShareAmount: number;
  currency: string;
  confidence: ProjectionConfidence;
}

export interface ProjectDividendsArgs {
  ticker: string;
  historicalPayments: ReadonlyArray<HistoricalPayment>;
  holding: { quantity: number; createdAt: string | null };
  today: Date;
  direction: "forward" | "backward";
  currency: string;
}

const GROWTH_CAP = 0.20;

// Bucket widths chosen to absorb the realistic timing drift we see in FMP
// data without overlapping. Quarterly's upper edge stretches to 110d to
// catch recently-initiated quarterly payers whose first Q1 lands a month
// late (PYPL: 2025-11-19 → 2026-03-04 = 105d). Semi widens to 170-210d to
// catch UK interim/final asymmetries that miss the narrower window.
const CADENCE_BUCKETS: ReadonlyArray<{
  cadence: Cadence;
  min: number;
  max: number;
  payOffsetDays: number;
}> = [
  { cadence: "monthly",   min: 28,  max: 35,  payOffsetDays: 7 },
  { cadence: "quarterly", min: 85,  max: 110, payOffsetDays: 14 },
  { cadence: "semi",      min: 170, max: 210, payOffsetDays: 28 },
  { cadence: "annual",    min: 355, max: 370, payOffsetDays: 28 },
];

export interface CadenceByYearCountResult {
  /** The cadence label that the mode count maps to. */
  cadence: Cadence;
  /** The actual payments-per-year mode (e.g. 3 for UK semi + occasional special). */
  modeCount: number;
}

/**
 * Cadence detection by per-calendar-year payment count.
 *
 * UK semi-annual payers often have asymmetric interim/final timing (e.g.
 * ABDN.L gaps = [224, 140, 217] days), which puts the median outside the
 * narrow median-gap bucket [175, 190] and gets them mis-tagged as
 * 'irregular'. Counting payments per calendar year sidesteps timing drift
 * entirely.
 *
 * Returns the cadence + the actual mode count when the mode payment count
 * appears in 2 or more of the most recent 3 complete calendar years, and
 * the mode maps to a known cadence ({1, 2, 3, 4, 12}). A mode of 3 is read
 * as 'semi' but the modeCount of 3 is preserved so callers (specifically
 * `projectDividends`) can project the right number of payments per year.
 * Otherwise returns null, letting the caller fall back to median-gap
 * bucket detection.
 */
export function detectCadenceByYearCount(
  history: ReadonlyArray<HistoricalPayment>,
): CadenceByYearCountResult | null {
  const countByYear = new Map<number, number>();
  for (const h of history) {
    const y = Number(h.exDate.slice(0, 4));
    countByYear.set(y, (countByYear.get(y) ?? 0) + 1);
  }
  if (countByYear.size === 0) return null;

  // Drop the most recent year as it is partial (this runs from a daily cron
  // on currently-trading securities, so the latest year always has more
  // payments still to come).
  const maxYear = Math.max(...countByYear.keys());
  countByYear.delete(maxYear);
  if (countByYear.size < 2) return null;

  // Take up to the 3 most recent complete years.
  const recent = [...countByYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, 3)
    .map(([, c]) => c);

  // Mode = the count that appears most often. If no count repeats, return
  // null so the caller falls back to the gap-based detector.
  const freq = new Map<number, number>();
  for (const c of recent) freq.set(c, (freq.get(c) ?? 0) + 1);
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const [modeCount, modeFreq] = sorted[0];
  if (modeFreq < 2) return null;

  let cadence: Cadence;
  switch (modeCount) {
    case 12: cadence = "monthly"; break;
    case 4:  cadence = "quarterly"; break;
    case 3:  cadence = "semi"; break;
    case 2:  cadence = "semi"; break;
    case 1:  cadence = "annual"; break;
    default: return null;
  }
  return { cadence, modeCount };
}

/**
 * Number of payments per year implied by the cadence label. Used to decide
 * whether the year-count detector's actual mode count disagrees with the
 * label (e.g. mode 3 mapped to 'semi' — semi implies 2, so we have an extra).
 */
function expectedPaymentsPerYear(cadence: Cadence): number {
  switch (cadence) {
    case "monthly":   return 12;
    case "quarterly": return 4;
    case "semi":      return 2;
    case "annual":    return 1;
    default:          return 1;
  }
}

export function detectCadence(history: ReadonlyArray<HistoricalPayment>): Cadence {
  if (history.length < 2) return "unknown";

  // Primary signal: payments-per-calendar-year mode. Robust to interim/final
  // timing drift that breaks the median-gap detector for UK semi-annual
  // payers. Returns null when ambiguous; we fall through to median-gap below.
  const byYear = detectCadenceByYearCount(history);
  if (byYear) return byYear.cadence;

  // Fallback: median inter-payment gap matched against narrow buckets. Catches
  // payers with a clean rhythm but fewer than 2 complete calendar years of
  // history (e.g. recently initiated payers).
  const sorted = [...history].sort((a, b) => (a.exDate < b.exDate ? -1 : 1));
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const ms = new Date(sorted[i].exDate).getTime() - new Date(sorted[i - 1].exDate).getTime();
    gaps.push(ms / 86_400_000);
  }
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  const bucket = CADENCE_BUCKETS.find((b) => median >= b.min && median <= b.max);
  return bucket?.cadence ?? "irregular";
}

export function computeGrowthRate(history: ReadonlyArray<HistoricalPayment>): number {
  // Aggregate payments per calendar year and count.
  const sumByYear = new Map<number, number>();
  const countByYear = new Map<number, number>();
  for (const h of history) {
    const y = Number(h.exDate.slice(0, 4));
    sumByYear.set(y, (sumByYear.get(y) ?? 0) + h.amount);
    countByYear.set(y, (countByYear.get(y) ?? 0) + 1);
  }
  // "Complete" year = one with the modal payment count (drops partial-year
  // tails like a YTD 2 vs the historical 4).
  const counts = [...countByYear.values()];
  if (counts.length === 0) return 0;
  const maxCount = counts.reduce((m, c) => (c > m ? c : m), 0);
  const completeYears = [...sumByYear.entries()]
    .filter(([y]) => (countByYear.get(y) ?? 0) === maxCount)
    .sort((a, b) => a[0] - b[0]);
  if (completeYears.length < 2) return 0;
  const start = completeYears[0][1];
  const end = completeYears[completeYears.length - 1][1];
  const n = completeYears.length - 1;
  if (start <= 0) return 0;
  const cagr = Math.pow(end / start, 1 / n) - 1;
  if (cagr > GROWTH_CAP) return GROWTH_CAP;
  if (cagr < -GROWTH_CAP) return -GROWTH_CAP;
  return cagr;
}

function trailingTwelveMonthAvg(
  history: ReadonlyArray<HistoricalPayment>,
  today: Date,
): number {
  const cutoff = new Date(today.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const recent = history.filter((h) => h.exDate >= cutoff);
  if (recent.length === 0) return 0;
  return recent.reduce((s, h) => s + h.amount, 0) / recent.length;
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function payOffsetDaysFor(cadence: Cadence): number {
  return CADENCE_BUCKETS.find((b) => b.cadence === cadence)?.payOffsetDays ?? 14;
}

function gapDaysFor(cadence: Cadence): number {
  // Midpoint of the bucket — close enough for projection.
  const b = CADENCE_BUCKETS.find((c) => c.cadence === cadence);
  return b ? (b.min + b.max) / 2 : 0;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function projectDividends(args: ProjectDividendsArgs): ProjectedPayment[] {
  const { historicalPayments: history, holding, today, direction, currency } = args;

  const cadence = detectCadence(history);
  if (cadence === "unknown" || cadence === "irregular") return [];

  const sorted = [...history].sort((a, b) => (a.exDate < b.exDate ? -1 : 1));
  const latest = sorted[sorted.length - 1];
  const ttmAvg = trailingTwelveMonthAvg(history, today);
  const todayIso = today.toISOString().slice(0, 10);
  const sixMoAgoIso = addDays(todayIso, -180);

  // Mode-based projection: when the year-count detector saw more payments
  // per year than the cadence label implies (e.g. UK semi + occasional
  // special = mode 3, cadence='semi' implies 2), project the actual mode
  // count instead. Per-payment base = TTM-sum / modeCount so the annual
  // total tracks reality. Without this, BME.L-style payers under-project
  // by ~30% because the engine emits only 2 payments × latest.amount.
  const byYear = detectCadenceByYearCount(history);
  if (
    byYear !== null &&
    byYear.modeCount > expectedPaymentsPerYear(cadence) &&
    ttmAvg > 0
  ) {
    const cutoffIso = addDays(todayIso, -365);
    const ttmSum = history
      .filter((h) => h.exDate >= cutoffIso)
      .reduce((s, h) => s + h.amount, 0);
    if (ttmSum > 0) {
      const baseAmount = ttmSum / byYear.modeCount;
      const gapDays = 365 / byYear.modeCount;
      const payOffsetDays = payOffsetDaysFor(cadence);
      const out: ProjectedPayment[] = [];

      if (direction === "forward") {
        const endIso = addDays(todayIso, 365);
        let cursor = latest.exDate;
        while (true) {
          cursor = addDays(cursor, gapDays);
          if (cursor > endIso) break;
          if (cursor <= todayIso) continue;
          out.push({
            exDate: cursor,
            payDate: addDays(cursor, payOffsetDays),
            perShareAmount: round4(baseAmount),
            currency,
            confidence: "cadence",
          });
        }
      } else {
        const createdAt = holding.createdAt ? holding.createdAt.slice(0, 10) : sixMoAgoIso;
        const floor = createdAt > sixMoAgoIso ? createdAt : sixMoAgoIso;
        let cursor = sorted[0].exDate;
        while (cursor < todayIso) {
          cursor = addDays(cursor, gapDays);
          if (cursor < floor) continue;
          if (cursor > todayIso) break;
          out.push({
            exDate: cursor,
            payDate: addDays(cursor, payOffsetDays),
            perShareAmount: round4(baseAmount),
            currency,
            confidence: "cadence",
          });
        }
      }
      return out;
    }
  }

  const isCutOrFreeze = ttmAvg > 0 && latest.amount < 0.95 * ttmAvg;
  const growthRate = isCutOrFreeze ? 0 : computeGrowthRate(history);
  const hadEnoughHistory = history.length >= 4;
  const baseAmount = latest.amount;

  const confidence: ProjectionConfidence = isCutOrFreeze
    ? "cadence"
    : !hadEnoughHistory
      ? "growth-unknown"
      : growthRate === GROWTH_CAP || growthRate === -GROWTH_CAP
        ? "growth-clipped"
        : growthRate !== 0
          ? "cadence+growth"
          : "cadence";

  const gapDays = gapDaysFor(cadence);
  const payOffsetDays = payOffsetDaysFor(cadence);

  const out: ProjectedPayment[] = [];

  if (direction === "forward") {
    const endIso = addDays(todayIso, 365);
    let cursor = latest.exDate;
    while (true) {
      cursor = addDays(cursor, gapDays);
      if (cursor > endIso) break;
      if (cursor <= todayIso) continue; // past slot — caller has user_dividends or backward proj
      const yearsFromNow =
        (new Date(cursor).getTime() - today.getTime()) / (365 * 86_400_000);
      const amount = baseAmount * Math.pow(1 + growthRate, Math.max(0, yearsFromNow));
      out.push({
        exDate: cursor,
        payDate: addDays(cursor, payOffsetDays),
        perShareAmount: round4(amount),
        currency,
        confidence,
      });
    }
  } else {
    // Backward: walk forward in cadence from the earliest historical payment,
    // emit only those between max(holding.createdAt, today - 6mo) and today.
    const createdAt = holding.createdAt ? holding.createdAt.slice(0, 10) : sixMoAgoIso;
    const floor = createdAt > sixMoAgoIso ? createdAt : sixMoAgoIso;

    let cursor = sorted[0].exDate;
    while (cursor < todayIso) {
      cursor = addDays(cursor, gapDays);
      if (cursor < floor) continue;
      if (cursor > todayIso) break;
      out.push({
        exDate: cursor,
        payDate: addDays(cursor, payOffsetDays),
        perShareAmount: round4(baseAmount),
        currency,
        confidence,
      });
    }
  }

  return out;
}
