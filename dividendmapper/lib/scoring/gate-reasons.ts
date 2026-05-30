// Phase 2.75 Day 6. Maps a failed quality-gate code to a short, user-facing
// reason for the charcoal "no buy score" chip + drawer. Buy is NULL whenever
// any gate fails (see quality-gates.ts); this turns the opaque code into copy.
//
// GATE_2 wording note: the gate detects a trailing-12-month dividend decline,
// which can be a genuine cut OR a special/one-off dividend rolling off the TTM
// window (the live DLO case). The engine can't yet distinguish them (parked
// Phase 3), so the label stays cause-neutral: "Dividend history irregular".

import type { GateCode } from "./quality-gates";

const REASONS: Record<GateCode, string> = {
  GATE_1: "Dividend not covered by cash flow",
  GATE_2: "Dividend history irregular",
  GATE_3: "Thin interest coverage",
  GATE_4: "ETF or fund — not company-scored",
  GATE_5: "Below scoring size threshold",
};

// Priority: lead with the clearest user-facing story when multiple gates fail.
const PRIORITY: GateCode[] = ["GATE_4", "GATE_2", "GATE_1", "GATE_3", "GATE_5"];

export function gateReason(code: GateCode): string {
  return REASONS[code];
}

export function primaryGateReason(codes: GateCode[]): string | null {
  for (const code of PRIORITY) {
    if (codes.includes(code)) return REASONS[code];
  }
  return null;
}
