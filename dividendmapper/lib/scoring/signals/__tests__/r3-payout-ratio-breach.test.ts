import { describe, it, expect } from "vitest";
import { computeR3PayoutRatioBreach } from "../r3-payout-ratio-breach";

describe("computeR3PayoutRatioBreach", () => {
  it("fires 20 when a default-sector payout breaches 80%", () => {
    expect(computeR3PayoutRatioBreach({ payoutRatio: 0.85, sector: "technology" }).points).toBe(20);
  });

  it("does not fire for a REIT at 85% (95% threshold)", () => {
    const r = computeR3PayoutRatioBreach({ payoutRatio: 0.85, sector: "real_estate" });
    expect(r.points).toBe(0);
  });

  it("fires 10 when within 5pts of the threshold", () => {
    expect(computeR3PayoutRatioBreach({ payoutRatio: 0.77, sector: "technology" }).points).toBe(10);
  });

  it("returns 0 for a healthy payout", () => {
    expect(computeR3PayoutRatioBreach({ payoutRatio: 0.5, sector: "technology" }).points).toBe(0);
  });
});
