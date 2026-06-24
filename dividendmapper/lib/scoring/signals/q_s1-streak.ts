// Q_S1 — Dividend growth streak (income vehicle, V1).
// Counts consecutive years ending at the most recent complete year where the
// per-payment dividend was held or raised vs the prior year. A modal-amount
// drop of more than 5% resets the streak. The most recent complete year is
// the latest calendar year strictly before asOf — the in-progress year is
// excluded because partial-year totals look like cuts to a naive aggregate.
//
// CAL-3 fix (2026-06-24): compare the modal payment amount per year rather
// than the raw annual sum. FMP occasionally returns a stray 13th monthly
// payment in one calendar year — that inflates the sum and breaks the streak
// at the next year's "drop". The modal amount stays the same regardless of
// stray payments because 12 of the 13 payments still cluster on the
// canonical monthly rate. Same pattern as G_S1's modal-normalised cut
// detector (vehicle-assemble-inputs.ts Day 13).

import type { VehicleDividendRow } from "../vehicle-fmp";
import { modalAmount } from "../utils/modal";

export interface SignalResult {
  score: number | null;
  humanLabel: string;
}

export interface QS1Inputs {
  dividends: VehicleDividendRow[];
  asOf?: Date;
}

const BANDS: Array<{ years: number; score: number }> = [
  { years: 0, score: 0 },
  { years: 5, score: 25 },
  { years: 10, score: 50 },
  { years: 20, score: 75 },
  { years: 25, score: 100 },
];

function modalByYear(dividends: VehicleDividendRow[]): Map<number, number> {
  const byYear = new Map<number, number[]>();
  for (const d of dividends) {
    const year = parseInt(d.ex_date.slice(0, 4), 10);
    if (!Number.isFinite(year)) continue;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(d.dividend);
  }
  const modals = new Map<number, number>();
  for (const [year, amounts] of byYear) {
    const m = modalAmount(amounts);
    if (m !== null && m > 0) modals.set(year, m);
  }
  return modals;
}

function streakToScore(years: number): number {
  for (let i = BANDS.length - 1; i >= 0; i--) {
    const band = BANDS[i];
    if (years >= band.years) {
      if (i === BANDS.length - 1) return band.score;
      const next = BANDS[i + 1];
      const span = next.years - band.years;
      const fraction = (years - band.years) / span;
      return Math.round(band.score + fraction * (next.score - band.score));
    }
  }
  return 0;
}

export function computeQS1Streak(inputs: QS1Inputs): SignalResult {
  if (inputs.dividends.length === 0) {
    return { score: null, humanLabel: "no dividend history" };
  }
  const modals = modalByYear(inputs.dividends);
  const currentYear = (inputs.asOf ?? new Date()).getUTCFullYear();
  const yearsDesc = Array.from(modals.keys())
    .filter((y) => y < currentYear)
    .sort((a, b) => b - a);
  if (yearsDesc.length === 0) {
    return { score: 0, humanLabel: "no complete-year dividend history" };
  }
  let streak = 1;
  for (let i = 0; i < yearsDesc.length - 1; i++) {
    if (yearsDesc[i] - yearsDesc[i + 1] !== 1) break;
    const cur = modals.get(yearsDesc[i])!;
    const prev = modals.get(yearsDesc[i + 1])!;
    if (prev <= 0 || cur / prev < 0.95) break;
    streak++;
  }
  const score = streakToScore(streak);
  return {
    score,
    humanLabel: `${streak}y consecutive dividend streak`,
  };
}
