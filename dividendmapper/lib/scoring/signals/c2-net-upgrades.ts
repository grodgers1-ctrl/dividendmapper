// Buy C2 — Net analyst grade changes (upgrades − downgrades) over the last 90
// days. More net upgrades = more bullish sentiment. Map: +5 → 100; 0 → 50;
// -5 → 0. Returns N/A when fewer than 3 events in 90d (analyst coverage is
// thin for LSE small/mid caps, so don't fabricate a signal from noise).

import type { SignalResult } from "./a1-yield-percentile";

export interface GradeChange {
  action: string;
  date: string; // ISO date
}

export interface C2Inputs {
  events: GradeChange[];
  asOf?: Date;
}

const MIN_EVENTS = 3;
const WINDOW_DAYS = 90;

export function computeC2NetUpgrades(inputs: C2Inputs): SignalResult {
  const now = inputs.asOf ?? new Date();
  const cutoff = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recent = inputs.events.filter((e) => new Date(e.date) >= cutoff);
  if (recent.length < MIN_EVENTS) {
    return { score: null, humanLabel: `Analyst-grade coverage thin (${recent.length} in 90d)` };
  }
  const ups = recent.filter((e) => /Upgrade/i.test(e.action)).length;
  const downs = recent.filter((e) => /Downgrade/i.test(e.action)).length;
  const net = ups - downs;
  // -5 → 0, 0 → 50, +5 → 100
  const raw = 50 + (net / 5) * 50;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return {
    score,
    humanLabel: `${ups} upgrade${ups === 1 ? "" : "s"}, ${downs} downgrade${downs === 1 ? "" : "s"} in 90d`,
  };
}
