// Phase 2.75 Day 6. Maps a failed quality-gate code to a short, user-facing
// reason for the charcoal "no buy score" chip + drawer. Buy is NULL whenever
// any gate fails (see quality-gates.ts); this turns the opaque code into copy.
//
// GATE_2 wording note: the gate detects a trailing-12-month dividend decline,
// which can be a genuine cut OR a special/one-off dividend rolling off the TTM
// window (the live DLO case). The engine can't yet distinguish them (parked
// Phase 3), so the label stays cause-neutral: "Dividend history irregular".
//
// GATE_4 wording note: the gate fires when TTM net income is a genuine
// non-null value <= 0 (quality-gates.ts). That covers loss-making companies
// (e.g. VOD.L) and funds with no corporate earnings (e.g. the SCHD ETF), but
// NOT names where FMP returned no income data — those now read as null and the
// gate is SKIPPED, not failed, so a UK fundamentals gap no longer masquerades
// as a loss. It is not an ETF-only signal, so the label stays cause-neutral:
// "No positive earnings to score" (the old "ETF or fund" copy wrongly called
// loss-makers funds).

import type { GateCode } from "./quality-gates";

const REASONS: Record<GateCode, string> = {
  GATE_1: "Dividend not covered by cash flow",
  GATE_2: "Dividend history irregular",
  GATE_3: "Thin interest coverage",
  GATE_4: "No positive earnings to score",
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
