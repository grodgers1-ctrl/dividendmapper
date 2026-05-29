// R4 — forward-EPS revisions vs the consensus we recorded ~90 days ago (read
// from equity_score_history). Steep cut (>=10%) → 15pts; notable (5-10%) →
// 10pts; mild (<5%) → 5pts. Cold-start: until 90 days of history exists the
// signal returns 0pts flagged `sparse` so the cron can mark data_quality.

export interface R4Inputs {
  currentEpsAvg: number;
  pastEpsHistory: { date: string; eps_avg: number | null }[];
  asOf?: Date;
}

export interface R4Result {
  points: number;
  fired: boolean;
  reason: string;
  dataQualityFlag?: "sparse";
}

const COLD_START_DAYS = 90;

export function computeR4EarningsRevisions(inputs: R4Inputs): R4Result {
  const now = inputs.asOf ?? new Date();
  const cutoff = new Date(now.getTime() - COLD_START_DAYS * 24 * 60 * 60 * 1000);
  // Find the most recent eps_avg observation that is at least 90 days old.
  const aged = inputs.pastEpsHistory
    .filter((h) => h.eps_avg != null && new Date(h.date) <= cutoff)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (aged.length === 0) {
    return {
      points: 0,
      fired: false,
      reason: "Earnings-revision signal warming up (need 90 days of history)",
      dataQualityFlag: "sparse",
    };
  }
  const past = aged[0].eps_avg as number;
  if (past <= 0) return { points: 0, fired: false, reason: "Past EPS non-positive" };
  const delta = (inputs.currentEpsAvg - past) / past;
  if (delta <= -0.1) return { points: 15, fired: true, reason: `Forward EPS revised ${(delta * 100).toFixed(0)}% (steep)` };
  if (delta <= -0.05) return { points: 10, fired: true, reason: `Forward EPS revised ${(delta * 100).toFixed(0)}% (notable)` };
  if (delta < 0) return { points: 5, fired: true, reason: `Forward EPS revised ${(delta * 100).toFixed(0)}%` };
  return { points: 0, fired: false, reason: "Forward EPS stable or improving" };
}
