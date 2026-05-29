// R1 — dividend cut detection + 12-month full + decay schedule.
// Fresh-cut detection uses the shared robust detector (trailing-12-month YoY on
// split-adjusted dividends) with a 1-year lookback, so it fires only on a
// genuinely recent cut; older cuts are kept alive by the cooldown/decay below
// reading the persisted risk_score series. On first detection the cron writes
// risk_score with R1=60 into equity_score_history (60 for 12mo, then decaying
// 50/40/30/20, gone by month 25).

import { detectDividendCut } from "../dividend-cut";

export interface DividendEvent {
  date: string; // ISO
  adjDividend: number;
  dividend: number;
}

export interface R1Inputs {
  dividends: DividendEvent[]; // chronological, latest first
  pastRiskHistory: { date: string; r1Points: number }[]; // last 25 months
  asOf?: Date;
}

export interface R1Result {
  points: number; // 0-60
  fired: boolean;
  reason: string;
}

const FULL_MONTHS = 12;
const DECAY_SCHEDULE: Array<{ untilMonth: number; points: number }> = [
  { untilMonth: 15, points: 50 },
  { untilMonth: 18, points: 40 },
  { untilMonth: 21, points: 30 },
  { untilMonth: 24, points: 20 },
];

function monthsBetween(a: Date, b: Date): number {
  return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
}

export function computeR1DividendCut(inputs: R1Inputs): R1Result {
  const now = inputs.asOf ?? new Date();

  // 1. Did we detect a recent cut in the current dividend stream? (1-year
  //    lookback — older cuts are handled by the cooldown step below.)
  const detected = detectDividendCut(inputs.dividends, { asOf: now, lookbackYears: 1 });
  if (detected.isCut) {
    return { points: 60, fired: true, reason: `Dividend cut detected ${detected.cutDate}` };
  }

  // 2. Cooldown lookup — find the most recent R1=60 in history.
  const priorCuts = inputs.pastRiskHistory
    .filter((h) => h.r1Points >= 60)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (priorCuts.length === 0) {
    return { points: 0, fired: false, reason: "No dividend cut in last 25 months" };
  }
  const cutDate = new Date(priorCuts[0].date);
  const monthsSince = monthsBetween(now, cutDate);
  if (monthsSince <= FULL_MONTHS) {
    return { points: 60, fired: true, reason: `Within 12mo of cut (${cutDate.toISOString().slice(0, 10)})` };
  }
  for (const step of DECAY_SCHEDULE) {
    if (monthsSince <= step.untilMonth) {
      return { points: step.points, fired: true, reason: `${monthsSince}mo post-cut (decaying)` };
    }
  }
  return { points: 0, fired: false, reason: "Past 24mo decay window" };
}
