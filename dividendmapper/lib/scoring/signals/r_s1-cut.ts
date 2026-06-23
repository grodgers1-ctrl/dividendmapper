// R_S1 — Has the regular dividend been cut in the last 5 calendar years?
// Binary risk signal (0 if any year-over-year decline > 5%, 100 if clean).
// Risk signals are sign-inverted at composite time so this becomes a penalty
// when fired.
//
// For BDCs the orchestrator passes excludeSpecials=true; specials are detected
// per-year by the modal-amount heuristic (anything ≥ 1.5× the year's modal
// payment is treated as a one-off and filtered out before totalling). The
// special-mix surface itself is covered by R_B2.

import type { VehicleDividendRow } from "../vehicle-fmp";

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface RS1Inputs {
  dividends: VehicleDividendRow[];
  excludeSpecials: boolean;
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

function filterSpecialsByYear(dividends: VehicleDividendRow[]): VehicleDividendRow[] {
  const byYear = new Map<number, VehicleDividendRow[]>();
  for (const d of dividends) {
    const year = parseInt(d.ex_date.slice(0, 4), 10);
    if (!Number.isFinite(year)) continue;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(d);
  }
  const out: VehicleDividendRow[] = [];
  for (const [, rows] of byYear) {
    const modal = modalAmount(rows.map((r) => r.dividend));
    if (modal === null) continue;
    const threshold = modal * 1.5;
    for (const r of rows) {
      if (r.dividend < threshold) out.push(r);
    }
  }
  return out;
}

export function computeRS1Cut(inputs: RS1Inputs): SignalResult {
  if (inputs.dividends.length === 0) {
    return { score: null, humanLabel: "no dividend history" };
  }
  const source = inputs.excludeSpecials
    ? filterSpecialsByYear(inputs.dividends)
    : inputs.dividends;
  const currentYear = (inputs.asOf ?? new Date()).getUTCFullYear();
  const lookbackStart = currentYear - 5;
  const totals = new Map<number, number>();
  for (const d of source) {
    const year = parseInt(d.ex_date.slice(0, 4), 10);
    if (!Number.isFinite(year) || year < lookbackStart || year >= currentYear) continue;
    totals.set(year, (totals.get(year) ?? 0) + d.dividend);
  }
  const yearsAsc = Array.from(totals.keys()).sort((a, b) => a - b);
  if (yearsAsc.length < 2) {
    return { score: 100, humanLabel: "insufficient history for cut detection" };
  }
  for (let i = 1; i < yearsAsc.length; i++) {
    const cur = totals.get(yearsAsc[i])!;
    const prev = totals.get(yearsAsc[i - 1])!;
    if (prev > 0 && cur / prev < 0.95) {
      const pct = Math.round((1 - cur / prev) * 100);
      return {
        score: 0,
        humanLabel: `dividend cut ${yearsAsc[i]} (${pct}% YoY)`,
      };
    }
  }
  return { score: 100, humanLabel: "no dividend cuts in last 5 years" };
}
