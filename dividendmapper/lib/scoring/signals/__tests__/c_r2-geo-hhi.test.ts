import { describe, it, expect } from "vitest";
import { computeCR2GeoHhi } from "../c_r2-geo-hhi";

describe("computeCR2GeoHhi", () => {
  it("10 equal regions (HHI 1000) scores 100", () => {
    const shares = Array.from({ length: 10 }, () => 0.10);
    expect(computeCR2GeoHhi({ segmentShares: shares }).score).toBe(100);
  });

  it("US-coastal concentration (HHI ~3400) scores 50", () => {
    // 40% NY + 40% CA + 20% TX → 1600+1600+400 = 3600
    expect(computeCR2GeoHhi({ segmentShares: [0.4, 0.4, 0.2] }).score).toBe(50);
  });

  it("single-state concentration (HHI 10000) scores 0", () => {
    expect(computeCR2GeoHhi({ segmentShares: [1.0] }).score).toBe(0);
  });

  it("empty cascade", () => {
    const r = computeCR2GeoHhi({ segmentShares: [] });
    expect(r.score).toBeNull();
    expect(r.humanLabel).toMatch(/geographic segment data unavailable/);
  });
});
