import { describe, it, expect } from "vitest";
import { runQualityGates, type QualityGateInputs } from "../quality-gates";

const baseInputs = (overrides: Partial<QualityGateInputs> = {}): QualityGateInputs => ({
  sector: "technology",
  fcfTtm: 1000,
  dividendsPaidTtm: 500,
  dividendCutInLast5Years: false,
  ebitTtm: 1000,
  interestExpenseTtm: 200,
  netIncomeTtm: 800,
  marketCapUsd: 5_000_000_000,
  ...overrides,
});

describe("runQualityGates", () => {
  it("passes a healthy stock", () => {
    const result = runQualityGates(baseInputs());
    expect(result.passed).toBe(true);
    expect(result.failedGates).toEqual([]);
  });

  it("fails GATE_1 when FCF coverage < 1.1 for default sector", () => {
    const result = runQualityGates(baseInputs({ fcfTtm: 500, dividendsPaidTtm: 500 }));
    expect(result.passed).toBe(false);
    expect(result.failedGates).toContain("GATE_1");
  });

  it("REIT uses 1.0 coverage threshold (not 1.1)", () => {
    const result = runQualityGates(
      baseInputs({ sector: "real_estate", fcfTtm: 500, dividendsPaidTtm: 500 }),
    );
    expect(result.passed).toBe(true);
    expect(result.failedGates).not.toContain("GATE_1");
  });

  it("Utility uses 0.95 coverage threshold", () => {
    const result = runQualityGates(
      baseInputs({ sector: "utility", fcfTtm: 475, dividendsPaidTtm: 500 }),
    );
    expect(result.passed).toBe(true);
  });

  it("fails GATE_2 when there was a dividend cut in last 5y", () => {
    const result = runQualityGates(baseInputs({ dividendCutInLast5Years: true }));
    expect(result.failedGates).toContain("GATE_2");
  });

  it("fails GATE_3 when interest coverage < 2.0", () => {
    const result = runQualityGates(baseInputs({ ebitTtm: 100, interestExpenseTtm: 100 }));
    expect(result.failedGates).toContain("GATE_3");
  });

  it("fails GATE_4 when net income TTM <= 0", () => {
    const result = runQualityGates(baseInputs({ netIncomeTtm: -50 }));
    expect(result.failedGates).toContain("GATE_4");
  });

  it("fails GATE_5 when market cap < $500M", () => {
    const result = runQualityGates(baseInputs({ marketCapUsd: 100_000_000 }));
    expect(result.failedGates).toContain("GATE_5");
  });

  it("returns all failed gates, not just the first", () => {
    const result = runQualityGates(
      baseInputs({ fcfTtm: 100, ebitTtm: 100, netIncomeTtm: -10 }),
    );
    expect(result.passed).toBe(false);
    expect(result.failedGates.length).toBeGreaterThanOrEqual(3);
  });

  it("skips GATE_1 for financials even when FCF coverage is poor", () => {
    // Banks/insurers have no conventional operating-FCF line, so the
    // coverage gate is meaningless for them (e.g. LGEN.L was failing spuriously).
    const result = runQualityGates(
      baseInputs({ sector: "financial", fcfTtm: -50, dividendsPaidTtm: 100 }),
    );
    expect(result.failedGates).not.toContain("GATE_1");
  });

  it("still fires GATE_1 for a non-financial with poor coverage", () => {
    const result = runQualityGates(
      baseInputs({ sector: "healthcare", fcfTtm: 50, dividendsPaidTtm: 100 }),
    );
    expect(result.failedGates).toContain("GATE_1");
  });
});
