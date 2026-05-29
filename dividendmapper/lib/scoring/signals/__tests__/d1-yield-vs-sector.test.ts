import { describe, it, expect } from "vitest";
import { computeD1YieldVsSector } from "../d1-yield-vs-sector";

describe("computeD1YieldVsSector", () => {
  it("returns 100 when yield is 50%+ above the sector median", () => {
    expect(computeD1YieldVsSector({ stockYield: 0.045, sectorMedianYield: 0.03 }).score).toBe(100);
  });

  it("returns 0 when yield is 50%+ below the sector median", () => {
    expect(computeD1YieldVsSector({ stockYield: 0.015, sectorMedianYield: 0.03 }).score).toBe(0);
  });

  it("returns 50 at parity with the sector median", () => {
    expect(computeD1YieldVsSector({ stockYield: 0.03, sectorMedianYield: 0.03 }).score).toBe(50);
  });

  it("returns N/A when the sector median is unavailable", () => {
    expect(computeD1YieldVsSector({ stockYield: 0.04, sectorMedianYield: null }).score).toBeNull();
  });

  it("returns N/A when the stock yield is non-positive", () => {
    expect(computeD1YieldVsSector({ stockYield: 0, sectorMedianYield: 0.03 }).score).toBeNull();
  });
});
