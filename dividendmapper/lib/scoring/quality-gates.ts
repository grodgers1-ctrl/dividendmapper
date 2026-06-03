// Phase 2.75 quality gates. If ANY gate fails, Buy Score = NULL with
// buy_quality_gate_passed = false and buy_failed_gates = [...].
// Gate thresholds are sector-aware: REITs allow looser FCF coverage
// (AFFO-style cash flow is structurally lower); Utilities tolerate
// 0.95 (regulated cash flow stability).

import type { Sector } from "./sector";
import { isRealEstate, isUtility, isFinancial } from "./sector";

export type GateCode = "GATE_1" | "GATE_2" | "GATE_3" | "GATE_4" | "GATE_5";

export interface QualityGateInputs {
  sector: Sector;
  // null = FMP returned no rows for this fundamental (data unavailable). The
  // gate that depends on it SKIPS rather than failing, so a fundamentals gap is
  // not mistaken for a genuine zero/negative.
  fcfTtm: number | null;
  dividendsPaidTtm: number;
  dividendCutInLast5Years: boolean;
  ebitTtm: number | null;
  interestExpenseTtm: number | null;
  netIncomeTtm: number | null;
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

  // GATE_1 — FCF coverage of dividends. Skipped for financials (no conventional
  // operating-FCF line; was failing healthy names like LGEN.L) and skipped when
  // FCF data is unavailable (null) rather than treating a gap as poor coverage.
  if (!isFinancial(inputs.sector) && inputs.fcfTtm !== null) {
    const coverage = inputs.dividendsPaidTtm > 0
      ? inputs.fcfTtm / inputs.dividendsPaidTtm
      : Number.POSITIVE_INFINITY;
    if (coverage < fcfCoverageThreshold(inputs.sector)) failed.push("GATE_1");
  }

  if (inputs.dividendCutInLast5Years) failed.push("GATE_2");

  // GATE_3 — interest coverage. Skipped when EBIT or interest expense is
  // unavailable (null).
  if (inputs.ebitTtm !== null && inputs.interestExpenseTtm !== null) {
    const interestCoverage = inputs.interestExpenseTtm > 0
      ? inputs.ebitTtm / inputs.interestExpenseTtm
      : Number.POSITIVE_INFINITY;
    if (interestCoverage < 2.0) failed.push("GATE_3");
  }

  // GATE_4 — positive earnings. Skipped when net income is unavailable (null);
  // only a genuine non-null <= 0 is a loss.
  if (inputs.netIncomeTtm !== null && inputs.netIncomeTtm <= 0) failed.push("GATE_4");

  if (inputs.marketCapUsd < 500_000_000) failed.push("GATE_5");

  return { passed: failed.length === 0, failedGates: failed };
}
