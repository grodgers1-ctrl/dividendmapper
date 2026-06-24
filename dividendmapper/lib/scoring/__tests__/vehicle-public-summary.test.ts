import { describe, it, expect } from "vitest";
import { vehiclePublicSummary } from "../vehicle-public-summary";
import type { VehicleScoreLoadResult } from "../load-vehicle-score";

function buildResult(overrides: Partial<VehicleScoreLoadResult> = {}): VehicleScoreLoadResult {
  return {
    ticker: "O",
    vehicleType: "us_reit",
    displayName: "Realty Income",
    subSector: "retail_net_lease",
    resilienceScore: 72,
    qualityGatePassed: true,
    failedGates: [],
    dataQuality: "full",
    computedAt: "2026-06-23T09:00:00Z",
    priceNavRatio: 1.08,
    signals: [],
    ...overrides,
  };
}

describe("vehiclePublicSummary", () => {
  it("returns green chip for resilience >= 70", () => {
    const summary = vehiclePublicSummary(buildResult({ resilienceScore: 80 }));
    expect(summary.chipColor).toBe("green");
    expect(summary.headline).toMatch(/resilient/i);
    expect(summary.headline).toContain("Realty Income");
  });

  it("returns amber chip for resilience 50-69", () => {
    const summary = vehiclePublicSummary(buildResult({ resilienceScore: 60 }));
    expect(summary.chipColor).toBe("amber");
    expect(summary.headline).toMatch(/moderately/i);
  });

  it("returns red chip for resilience < 50", () => {
    const summary = vehiclePublicSummary(buildResult({ resilienceScore: 30 }));
    expect(summary.chipColor).toBe("red");
    expect(summary.headline).toMatch(/weakly|low/i);
  });

  it("returns grey chip for gate-failed tickers (null score)", () => {
    const summary = vehiclePublicSummary(
      buildResult({
        resilienceScore: null,
        qualityGatePassed: false,
        failedGates: ["G_S2"],
      }),
    );
    expect(summary.chipColor).toBe("grey");
    expect(summary.headline).toMatch(/quality gate/i);
  });
});
