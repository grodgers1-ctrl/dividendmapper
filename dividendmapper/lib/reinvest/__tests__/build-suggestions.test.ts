import { describe, it, expect } from "vitest";
import { buildSuggestions, type Holding } from "../build-suggestions";

const holding = (over: Partial<Holding>): Holding => ({
  id: "x",
  ticker: "XXX",
  sector: "technology",
  quantity: 10,
  buyScore: 70,
  qualityGatePassed: true,
  hasActiveOverride: false,
  annualDivGbp: 100,
  ...over,
});

const base = {
  triggerHoldingId: "trigger",
  triggerPaymentGbp: 200,
  totalPortfolioIncomeGbp: 1000,
};

describe("buildSuggestions", () => {
  it("excludes the trigger holding itself", () => {
    const out = buildSuggestions({
      ...base,
      holdings: [holding({ id: "trigger" }), holding({ id: "a" })],
    });
    expect(out.map((s) => s.holdingId)).not.toContain("trigger");
  });

  it("excludes holdings with an active override", () => {
    const out = buildSuggestions({
      ...base,
      holdings: [holding({ id: "a", hasActiveOverride: true }), holding({ id: "b" })],
    });
    expect(out.map((s) => s.holdingId)).toEqual(["b"]);
  });

  it("excludes holdings that failed the quality gate (buyScore null)", () => {
    const out = buildSuggestions({
      ...base,
      holdings: [holding({ id: "a", buyScore: null, qualityGatePassed: false }), holding({ id: "b" })],
    });
    expect(out.map((s) => s.holdingId)).toEqual(["b"]);
  });

  it("excludes holdings in sectors_to_avoid", () => {
    const out = buildSuggestions({
      ...base,
      sectorsToAvoid: ["Energy"],
      holdings: [holding({ id: "a", sector: "energy" }), holding({ id: "b", sector: "technology" })],
    });
    expect(out.map((s) => s.holdingId)).toEqual(["b"]);
  });

  it("returns however many are eligible when the portfolio is sparse", () => {
    const out = buildSuggestions({
      ...base,
      holdings: [holding({ id: "a" }), holding({ id: "b" })],
    });
    expect(out.length).toBe(2);
  });

  it("ranks higher reinvest scores first", () => {
    const out = buildSuggestions({
      ...base,
      holdings: [holding({ id: "low", buyScore: 50 }), holding({ id: "high", buyScore: 90 })],
    });
    expect(out[0].holdingId).toBe("high");
    expect(out[0].reinvestScore).toBeGreaterThanOrEqual(out[1].reinvestScore);
  });

  it("caps suggestions at the explicit limit", () => {
    const holdings = Array.from({ length: 8 }, (_, i) => holding({ id: `h${i}`, buyScore: 50 + i }));
    const out = buildSuggestions({ ...base, holdings, limit: 5 });
    expect(out.length).toBe(5);
  });

  it("demotes a candidate already over the concentration cap below an under-weight peer", () => {
    const out = buildSuggestions({
      ...base,
      holdings: [
        holding({ id: "fat", ticker: "FAT", buyScore: 90 }),
        holding({ id: "lean", ticker: "LEAN", buyScore: 70 }),
      ],
      currentWeightByHolding: { fat: 0.35, lean: 0.03 },
    });
    // FAT has the higher quality but is over-cap (×0.5); LEAN's bonus lifts it above.
    expect(out[0].holdingId).toBe("lean");
  });

  it("returns currentWeight and a diversification note for the copy", () => {
    const out = buildSuggestions({
      ...base,
      holdings: [holding({ id: "a", ticker: "AAA", sector: "utilities" })],
      currentWeightByHolding: { a: 0.04 },
      triggerSector: "consumer_defensive",
    });
    expect(out[0].currentWeight).toBeCloseTo(0.04, 5);
    expect(out[0].diversificationNote).toMatch(/sector|position|spread|smaller|large/i);
  });

  it("respects the default limit of 10", () => {
    const holdings = Array.from({ length: 12 }, (_, i) =>
      holding({ id: `h${i}`, ticker: `H${i}`, buyScore: 50 + i }),
    );
    expect(buildSuggestions({ ...base, holdings }).length).toBe(10);
  });
});
