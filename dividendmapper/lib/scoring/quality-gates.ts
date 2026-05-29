// Phase 2.75 quality gates. If ANY gate fails, Buy Score = NULL with
// buy_quality_gate_passed = false and buy_failed_gates = [...].
// Gate thresholds are sector-aware: REITs allow looser FCF coverage
// (AFFO-style cash flow is structurally lower); Utilities tolerate
// 0.95 (regulated cash flow stability).

import type { Sector } from "./sector";
import { isRealEstate, isUtility } from "./sector";

export type GateCode = "GATE_1" | "GATE_2" | "GATE_3" | "GATE_4" | "GATE_5";

export interface QualityGateInputs {
  sector: Sector;
  fcfTtm: number;
  dividendsPaidTtm: number;
  dividendCutInLast5Years: boolean;
  ebitTtm: number;
  interestExpenseTtm: number;
  netIncomeTtm: number;
  marketCapUsd: number;
}

export interface QualityGateResult {
  passed: boolean;
  failedGates: GateCode[];
}

function fcfCoverageThreshold(sector: Sector): number {
  if (isRealEstate(sector)) return 1.0;
  if (isUtility(sector)) return 0.95;
  return 1.1;
}

export function runQualityGates(inputs: QualityGateInputs): QualityGateResult {
  const failed: GateCode[] = [];

  const coverage = inputs.dividendsPaidTtm > 0
    ? inputs.fcfTtm / inputs.dividendsPaidTtm
    : Number.POSITIVE_INFINITY;
  if (coverage < fcfCoverageThreshold(inputs.sector)) failed.push("GATE_1");

  if (inputs.dividendCutInLast5Years) failed.push("GATE_2");

  const interestCoverage = inputs.interestExpenseTtm > 0
    ? inputs.ebitTtm / inputs.interestExpenseTtm
    : Number.POSITIVE_INFINITY;
  if (interestCoverage < 2.0) failed.push("GATE_3");

  if (inputs.netIncomeTtm <= 0) failed.push("GATE_4");

  if (inputs.marketCapUsd < 500_000_000) failed.push("GATE_5");

  return { passed: failed.length === 0, failedGates: failed };
}
