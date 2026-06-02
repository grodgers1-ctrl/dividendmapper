import { describe, it, expect } from "vitest";
import { buildDigest, type AlertPrefs, type HoldingObservation } from "../build-digest";

const prefs: AlertPrefs = {
  riskEnabled: true,
  riskThreshold: 75,
  qualityEnabled: true,
  qualityThreshold: 30,
};

function obs(over: Partial<HoldingObservation>): HoldingObservation {
  return {
    ticker: "TST",
    prevRisk: 50,
    currRisk: 50,
    prevQuality: 60,
    currQuality: 60,
    dataQuality: "full",
    ...over,
  };
}

describe("buildDigest", () => {
  it("fires a Risk crossing when risk rises through the threshold", () => {
    const d = buildDigest(prefs, [obs({ prevRisk: 70, currRisk: 80 })]);
    expect(d).not.toBeNull();
    expect(d!.riskCrossings).toEqual([{ ticker: "TST", from: 70, to: 80 }]);
    expect(d!.qualityCrossings).toEqual([]);
  });

  it("fires a Quality crossing when quality falls through the threshold", () => {
    const d = buildDigest(prefs, [obs({ prevQuality: 40, currQuality: 20 })]);
    expect(d!.qualityCrossings).toEqual([{ ticker: "TST", from: 40, to: 20 }]);
    expect(d!.riskCrossings).toEqual([]);
  });

  it("does NOT fire when risk was already above the threshold yesterday", () => {
    const d = buildDigest(prefs, [obs({ prevRisk: 80, currRisk: 85 })]);
    expect(d).toBeNull();
  });

  it("does NOT fire when there is no prior observation (first-run guard)", () => {
    const d = buildDigest(prefs, [obs({ prevRisk: null, currRisk: 90 })]);
    expect(d).toBeNull();
  });

  it("suppresses ALL crossings on a degraded_uk holding", () => {
    const d = buildDigest(prefs, [
      obs({ dataQuality: "degraded_uk", prevRisk: 70, currRisk: 80, prevQuality: 40, currQuality: 10 }),
    ]);
    expect(d).toBeNull();
  });

  it("does NOT treat a Quality numeric->null (gate-fail) transition as a crossing", () => {
    const d = buildDigest(prefs, [obs({ prevQuality: 40, currQuality: null })]);
    expect(d).toBeNull();
  });

  it("respects disabled prefs", () => {
    const off: AlertPrefs = { ...prefs, riskEnabled: false, qualityEnabled: false };
    const d = buildDigest(off, [obs({ prevRisk: 70, currRisk: 80, prevQuality: 40, currQuality: 10 })]);
    expect(d).toBeNull();
  });

  it("returns null when nothing fires", () => {
    expect(buildDigest(prefs, [obs({})])).toBeNull();
  });

  it("collects crossings across multiple holdings", () => {
    const d = buildDigest(prefs, [
      obs({ ticker: "AAA", prevRisk: 70, currRisk: 80 }),
      obs({ ticker: "BBB", prevQuality: 35, currQuality: 25 }),
    ]);
    expect(d!.riskCrossings).toEqual([{ ticker: "AAA", from: 70, to: 80 }]);
    expect(d!.qualityCrossings).toEqual([{ ticker: "BBB", from: 35, to: 25 }]);
  });
});
