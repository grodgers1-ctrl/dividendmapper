import { describe, it, expect } from "vitest";
import { computeCR1PropertyHhi } from "../c_r1-property-hhi";

describe("computeCR1PropertyHhi", () => {
  it("10 equal segments (HHI 1000) scores 100", () => {
    const shares = Array.from({ length: 10 }, () => 0.10);
    expect(computeCR1PropertyHhi({ segmentShares: shares }).score).toBe(100);
  });

  it("HHI in 1500-2500 band scores 75", () => {
    // Two segments of 30% + four of 10% → HHI = 2×900 + 4×100 = 2200
    const shares = [0.3, 0.3, 0.1, 0.1, 0.1, 0.1];
    expect(computeCR1PropertyHhi({ segmentShares: shares }).score).toBe(75);
  });

  it("HHI in 2500-4000 band scores 50", () => {
    // 40% + 40% + 20% → HHI = 1600 + 1600 + 400 = 3600
    expect(computeCR1PropertyHhi({ segmentShares: [0.4, 0.4, 0.2] }).score).toBe(50);
  });

  it("HHI in 4000-6000 band scores 25", () => {
    // 50% + 30% + 20% → HHI = 2500 + 900 + 400 = 3800; bump to 60/30/10 → 3600+900+100=4600
    expect(computeCR1PropertyHhi({ segmentShares: [0.6, 0.3, 0.1] }).score).toBe(25);
  });

  it("single segment (HHI 10000) scores 0", () => {
    expect(computeCR1PropertyHhi({ segmentShares: [1.0] }).score).toBe(0);
  });

  it("empty segment list cascades (null)", () => {
    const r = computeCR1PropertyHhi({ segmentShares: [] });
    expect(r.score).toBeNull();
    expect(r.humanLabel).toMatch(/segment data unavailable/);
  });
});
