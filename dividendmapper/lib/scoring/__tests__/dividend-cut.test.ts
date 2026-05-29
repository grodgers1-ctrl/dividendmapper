import { describe, it, expect } from "vitest";
import { detectDividendCut } from "../dividend-cut";

const asOf = new Date("2026-05-29T00:00:00Z");
const daysAgo = (n: number) => new Date(asOf.getTime() - n * 86400000).toISOString().slice(0, 10);
const pay = (n: number, adj: number, raw = adj) => ({ date: daysAgo(n), adjDividend: adj, dividend: raw });

describe("detectDividendCut", () => {
  it("does NOT flag a semi-annual payer with interim/final asymmetry (LGEN regression)", () => {
    // Each year: large final + small interim. Annual total is stable (~21).
    const divs = [
      pay(30, 15), pay(210, 6),
      pay(395, 15), pay(575, 6),
      pay(760, 15), pay(940, 6),
    ];
    expect(detectDividendCut(divs, { asOf }).isCut).toBe(false);
  });

  it("flags a genuine >10% year-over-year decline", () => {
    const divs = [
      pay(30, 0.2), pay(120, 0.2), pay(210, 0.2), pay(300, 0.2), // TTM 0.80
      pay(395, 0.3), pay(485, 0.3), pay(575, 0.3), pay(665, 0.3), // prior TTM 1.20
    ];
    const r = detectDividendCut(divs, { asOf });
    expect(r.isCut).toBe(true);
    expect(r.cutDate).toBe(daysAgo(30));
  });

  it("is split-safe: uses adjDividend, so a split (raw halves, adj stable) is NOT a cut", () => {
    const divs = [
      pay(30, 1.0, 0.5), pay(120, 1.0, 0.5), pay(210, 1.0, 0.5), pay(300, 1.0, 0.5), // adj TTM 4.0
      pay(395, 1.0, 1.0), pay(485, 1.0, 1.0), pay(575, 1.0, 1.0), pay(665, 1.0, 1.0), // adj TTM 4.0
    ];
    expect(detectDividendCut(divs, { asOf }).isCut).toBe(false);
  });

  it("does not flag stable quarterly dividends", () => {
    const divs = [30, 120, 210, 300, 395, 485, 575, 665].map((d) => pay(d, 0.25));
    expect(detectDividendCut(divs, { asOf }).isCut).toBe(false);
  });

  it("does not flag with under two years of history (no prior-year baseline)", () => {
    const divs = [pay(30, 0.25), pay(120, 0.25), pay(210, 0.25), pay(300, 0.25)];
    expect(detectDividendCut(divs, { asOf }).isCut).toBe(false);
  });

  it("flags a suspension (positive prior year -> ~zero current year)", () => {
    const divs = [pay(395, 0.3), pay(485, 0.3), pay(575, 0.3), pay(665, 0.3)]; // only prior year
    expect(detectDividendCut(divs, { asOf }).isCut).toBe(true);
  });

  it("lookbackYears=1 ignores an old cut that the 5y scan would catch", () => {
    // Annual payer: stable 1.0 for recent years, but year-4 was 1.5 -> a cut happened ~3yr ago.
    const divs = [pay(30, 1.0), pay(395, 1.0), pay(760, 1.0), pay(1125, 1.0), pay(1490, 1.5)];
    expect(detectDividendCut(divs, { asOf, lookbackYears: 5 }).isCut).toBe(true);
    expect(detectDividendCut(divs, { asOf, lookbackYears: 1 }).isCut).toBe(false);
  });
});
