// R_B2 — BDC special-distribution mix over the trailing 2 years.
// Sum of specials ÷ sum of regulars. A ratio above 1.0 means the firm is
// distributing more in supplementals than the headline-rate dividend can
// fund from current earnings — the classic pre-cut pattern (cf. PSEC 2017,
// ARES 2020).
//
// Heuristic: FMP does not label special vs regular. We treat the per-year
// modal-amount payment as "regular" and anything ≥ 1.5× that modal value
// in the same year as a "special". This will misfire on tickers that
// stepped their regular rate mid-year — flagged as a Day 13 calibration
// item if > 1 false positive surfaces in the spot-check. V1.1 may replace
// this with EDGAR 8-K parsing.

import type { VehicleDividendRow } from "../vehicle-fmp";

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface RB2Inputs {
  dividends: VehicleDividendRow[];
  asOf?: Date;
}

function modalAmount(amounts: number[]): number | null {
  if (amounts.length === 0) return null;
  const counts = new Map<string, number>();
  for (const a of amounts) {
    const key = a.toFixed(4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let modeKey = "";
  let modeCount = 0;
  for (const [k, c] of counts) {
    if (c > modeCount) {
      modeCount = c;
      modeKey = k;
    }
  }
  return parseFloat(modeKey);
}

export function computeRB2SpecialMix(inputs: RB2Inputs): SignalResult {
  if (inputs.dividends.length === 0) {
    return { score: null, humanLabel: "no dividend history" };
  }
  const currentYear = (inputs.asOf ?? new Date()).getUTCFullYear();
  const lookbackStart = currentYear - 2;
  const byYear = new Map<number, VehicleDividendRow[]>();
  for (const d of inputs.dividends) {
    const year = parseInt(d.ex_date.slice(0, 4), 10);
    if (!Number.isFinite(year) || year < lookbackStart || year >= currentYear) continue;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(d);
  }
  let specials = 0;
  let regulars = 0;
  for (const [, rows] of byYear) {
    const modal = modalAmount(rows.map((r) => r.dividend));
    if (modal === null) continue;
    const threshold = modal * 1.5;
    for (const r of rows) {
      if (r.dividend >= threshold) specials += r.dividend;
      else regulars += r.dividend;
    }
  }
  if (regulars <= 0) {
    return { score: null, humanLabel: "no regular distributions detected" };
  }
  const ratio = specials / regulars;
  let score: number;
  if (ratio <= 0.2) score = 100;
  else if (ratio <= 0.5) score = 75;
  else if (ratio <= 1.0) score = 50;
  else if (ratio <= 1.5) score = 25;
  else score = 0;
  return {
    score,
    humanLabel: `Specials ${(ratio * 100).toFixed(0)}% of regulars over 2y`,
  };
}
