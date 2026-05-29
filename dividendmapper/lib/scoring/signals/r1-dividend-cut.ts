// R1 — dividend cut detection + 12-month full + decay schedule.
// "Cut" = declared dividend < previous regular (excluding specials, 5% buffer).
// On first detection the cron writes risk_score with R1=60 into
// equity_score_history; R1's cooldown looks back at that score series to keep
// the penalty alive (60 for 12mo, then decaying 50/40/30/20, gone by month 25).

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

function detectCut(dividends: DividendEvent[]): { isCut: boolean; cutDate: string | null } {
  // Compare latest declared regular payment to the previous one.
  if (dividends.length < 2) return { isCut: false, cutDate: null };
  const latest = dividends[0];
  const prev = dividends[1];
  if (latest.dividend < prev.dividend * 0.95) {
    // 5% buffer for special-dividend noise
    return { isCut: true, cutDate: latest.date };
  }
  return { isCut: false, cutDate: null };
}

export function computeR1DividendCut(inputs: R1Inputs): R1Result {
  const now = inputs.asOf ?? new Date();

  // 1. Did we detect a cut in the current dividend stream?
  const detected = detectCut(inputs.dividends);
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
