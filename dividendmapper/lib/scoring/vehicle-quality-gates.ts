// Phase 4 Sprint 2 Day 10 — Vehicle quality gates.
// Per-family hard cutoffs that, when fired, return resilience_score=null with
// the failing gate codes. Mirrors the equity engine's quality-gates.ts shape.
//
// Gates:
//   G_R1 — US REIT FFO payout > 100% (dividend not earned)
//   G_R2 — US REIT dividend cut in last 5y
//   G_B1 — US BDC NII coverage < 0.95 (regular distribution under-earned)
//   G_B2 — US BDC regular-distribution cut in last 5y
//   G_U1 — UK REIT LTV > sector-aware cap (default 50%, industrial 40%,
//          healthcare/social-housing 60%)
//   G_U2 — UK REIT dividend cut in last 5y
//
// Gate inputs use `undefined` (not null) to signal "value unavailable" — a
// missing piece of data SKIPS the gate rather than failing it, exactly like
// the equity engine.

import type { VehicleType } from "./vehicle-fmp";

export type VehicleGateCode = "G_R1" | "G_R2" | "G_B1" | "G_B2" | "G_U1" | "G_U2";

export interface VehicleQualityGateInputs {
  vehicleType: VehicleType;
  subSector: string | null;
  dividendCutInLast5Years: boolean;
  regularDividendCutInLast5Years?: boolean;
  // US REIT
  ttmDps?: number;
  ttmFfoPerShare?: number;
  // US BDC
  ttmNiiPerShare?: number;
  ttmRegularDps?: number;
  // UK REIT
  totalDebt?: number;
  totalAssets?: number;
}

export interface VehicleQualityGateResult {
  passed: boolean;
  failedGates: VehicleGateCode[];
}

function ukLtvCap(subSector: string | null | undefined): number {
  if (!subSector) return 0.50;
  const s = subSector.toLowerCase();
  if (s.includes("industrial") || s.includes("logistic")) return 0.40;
  if (s.includes("healthcare") || s.includes("medical") || s.includes("primary care")) return 0.60;
  if (s.includes("social_housing") || s.includes("social housing")) return 0.60;
  return 0.50;
}

export function runVehicleQualityGates(inputs: VehicleQualityGateInputs): VehicleQualityGateResult {
  const failed: VehicleGateCode[] = [];

  switch (inputs.vehicleType) {
    case "us_reit": {
      if (
        inputs.ttmFfoPerShare !== undefined &&
        inputs.ttmFfoPerShare > 0 &&
        inputs.ttmDps !== undefined
      ) {
        const payout = inputs.ttmDps / inputs.ttmFfoPerShare;
        if (payout > 1.0) failed.push("G_R1");
      }
      if (inputs.dividendCutInLast5Years) failed.push("G_R2");
      break;
    }
    case "us_bdc": {
      if (
        inputs.ttmNiiPerShare !== undefined &&
        inputs.ttmRegularDps !== undefined &&
        inputs.ttmRegularDps > 0
      ) {
        const cov = inputs.ttmNiiPerShare / inputs.ttmRegularDps;
        if (cov < 0.95) failed.push("G_B1");
      }
      if (inputs.regularDividendCutInLast5Years) failed.push("G_B2");
      break;
    }
    case "uk_reit": {
      if (
        inputs.totalDebt !== undefined &&
        inputs.totalAssets !== undefined &&
        inputs.totalAssets > 0
      ) {
        const ltv = inputs.totalDebt / inputs.totalAssets;
        if (ltv > ukLtvCap(inputs.subSector)) failed.push("G_U1");
      }
      if (inputs.dividendCutInLast5Years) failed.push("G_U2");
      break;
    }
  }

  return { passed: failed.length === 0, failedGates: failed };
}
