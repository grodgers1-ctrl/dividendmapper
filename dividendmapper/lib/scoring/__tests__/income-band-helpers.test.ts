import { describe, it, expect } from "vitest";
import { classifyHolding } from "../income-band-helpers";

describe("classifyHolding", () => {
  it("classifies a high-resilience vehicle as anchor", () => {
    expect(
      classifyHolding({
        vehicleType: "us_reit",
        resilienceScore: 82,
        buyScore: null,
        qualityGatePassed: true,
      }),
    ).toBe("anchor");
  });

  it("classifies a mid-band vehicle as exposure", () => {
    expect(
      classifyHolding({
        vehicleType: "us_bdc",
        resilienceScore: 60,
        buyScore: null,
        qualityGatePassed: true,
      }),
    ).toBe("exposure");
    // The 50 boundary is inclusive on the bottom of exposure.
    expect(
      classifyHolding({
        vehicleType: "us_bdc",
        resilienceScore: 50,
        buyScore: null,
        qualityGatePassed: true,
      }),
    ).toBe("exposure");
  });

  it("classifies a low-resilience vehicle as risk", () => {
    expect(
      classifyHolding({
        vehicleType: "uk_reit",
        resilienceScore: 38,
        buyScore: null,
        qualityGatePassed: true,
      }),
    ).toBe("risk");
  });

  it("classifies a gate-failed vehicle as risk even if resilience would be high", () => {
    expect(
      classifyHolding({
        vehicleType: "us_reit",
        resilienceScore: 80,
        buyScore: null,
        qualityGatePassed: false,
      }),
    ).toBe("risk");
  });

  it("classifies an equity by Quality (anchor / exposure / risk)", () => {
    // ≥75 = anchor.
    expect(
      classifyHolding({
        vehicleType: "equity",
        resilienceScore: null,
        buyScore: 78,
        qualityGatePassed: true,
      }),
    ).toBe("anchor");
    // 50–74 = exposure.
    expect(
      classifyHolding({
        vehicleType: "equity",
        resilienceScore: null,
        buyScore: 62,
        qualityGatePassed: true,
      }),
    ).toBe("exposure");
    // Sub-50 or gate-failed = risk.
    expect(
      classifyHolding({
        vehicleType: "equity",
        resilienceScore: null,
        buyScore: 30,
        qualityGatePassed: true,
      }),
    ).toBe("risk");
    expect(
      classifyHolding({
        vehicleType: "equity",
        resilienceScore: null,
        buyScore: 80,
        qualityGatePassed: false,
      }),
    ).toBe("risk");
  });

  it("classifies a missing score as unscored", () => {
    expect(
      classifyHolding({
        vehicleType: "us_reit",
        resilienceScore: null,
        buyScore: null,
        qualityGatePassed: true,
      }),
    ).toBe("unscored");
    expect(
      classifyHolding({
        vehicleType: "equity",
        resilienceScore: null,
        buyScore: null,
        qualityGatePassed: true,
      }),
    ).toBe("unscored");
  });
});
