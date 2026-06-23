import { describe, it, expect } from "vitest";
import { computeQB1NiiCoverage } from "../q_b1-nii-coverage";

describe("computeQB1NiiCoverage", () => {
  it("ratio < 0.95 scores 0 (gate-fail)", () => {
    const r = computeQB1NiiCoverage({ ttmNiiPerShare: 0.90, ttmRegularDps: 1.0 });
    expect(r.score).toBe(0);
    expect(r.humanLabel).toMatch(/0\.90×/);
  });

  it("0.95-1.00 scores 25", () => {
    expect(computeQB1NiiCoverage({ ttmNiiPerShare: 0.97, ttmRegularDps: 1.0 }).score).toBe(25);
  });

  it("1.00-1.05 scores 50", () => {
    expect(computeQB1NiiCoverage({ ttmNiiPerShare: 1.02, ttmRegularDps: 1.0 }).score).toBe(50);
  });

  it("1.05-1.15 scores 75", () => {
    expect(computeQB1NiiCoverage({ ttmNiiPerShare: 1.10, ttmRegularDps: 1.0 }).score).toBe(75);
  });

  it("≥ 1.15 scores 100", () => {
    expect(computeQB1NiiCoverage({ ttmNiiPerShare: 1.20, ttmRegularDps: 1.0 }).score).toBe(100);
  });

  it("zero / non-positive regular DPS returns null", () => {
    expect(computeQB1NiiCoverage({ ttmNiiPerShare: 1.0, ttmRegularDps: 0 }).score).toBeNull();
  });
});
