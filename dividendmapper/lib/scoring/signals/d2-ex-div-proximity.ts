// Buy D2 — Proximity to the next ex-dividend date. Closer = more attractive for
// income capture timing. Bands: ≤14d → 100; ≤30d → 70; ≤60d → 50; >60d → 30.
// N/A when there is no upcoming ex-div on the calendar (or it has passed).

import type { SignalResult } from "./a1-yield-percentile";

export interface D2Inputs {
  nextExDivDate: string | null;
  asOf?: Date;
}

export function computeD2ExDivProximity(inputs: D2Inputs): SignalResult {
  if (!inputs.nextExDivDate) {
    return { score: null, humanLabel: "No upcoming ex-dividend on calendar" };
  }
  const now = inputs.asOf ?? new Date();
  const exDate = new Date(inputs.nextExDivDate);
  const daysAway = Math.floor((exDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (daysAway < 0) {
    return { score: null, humanLabel: "Ex-dividend date is in the past" };
  }
  let score: number;
  if (daysAway <= 14) score = 100;
  else if (daysAway <= 30) score = 70;
  else if (daysAway <= 60) score = 50;
  else score = 30;
  return { score, humanLabel: `Ex-dividend in ${daysAway} day${daysAway === 1 ? "" : "s"}` };
}
