// Q_S1 — Dividend growth streak (income vehicle, V1).
// Counts consecutive years ending at the most recent complete year where total
// annual dividend ≥ 95% of the prior year's total (a YoY decline > 5% resets
// the streak). The most recent complete year is the latest calendar year
// strictly before asOf — the in-progress year is excluded because partial-year
// totals look like cuts to a naive aggregate.

import type { VehicleDividendRow } from "../vehicle-fmp";

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

function totalsByYear(dividends: VehicleDividendRow[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const d of dividends) {
    const year = parseInt(d.ex_date.slice(0, 4), 10);
    if (!Number.isFinite(year)) continue;
    totals.set(year, (totals.get(year) ?? 0) + d.dividend);
  }
  return totals;
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
  const totals = totalsByYear(inputs.dividends);
  const currentYear = (inputs.asOf ?? new Date()).getUTCFullYear();
  const yearsDesc = Array.from(totals.keys())
    .filter((y) => y < currentYear)
    .sort((a, b) => b - a);
  if (yearsDesc.length === 0) {
    return { score: 0, humanLabel: "no complete-year dividend history" };
  }
  let streak = 1;
  for (let i = 0; i < yearsDesc.length - 1; i++) {
    if (yearsDesc[i] - yearsDesc[i + 1] !== 1) break;
    const cur = totals.get(yearsDesc[i])!;
    const prev = totals.get(yearsDesc[i + 1])!;
    if (prev <= 0 || cur / prev < 0.95) break;
    streak++;
  }
  const score = streakToScore(streak);
  return {
    score,
    humanLabel: `${streak}y consecutive dividend streak`,
  };
}
