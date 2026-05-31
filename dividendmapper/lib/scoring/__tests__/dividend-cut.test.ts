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

  it("does NOT flag a strictly-increasing quarterly payer when a rolling window clips a payment (PEP regression)", () => {
    // Real PEP ex-dates/amounts (2020-2026). The dividend rose every single year
    // (1.0225 -> 1.075 -> 1.15 -> 1.265 -> 1.355 -> 1.4225 -> 1.48), so a "cut" is
    // impossible. The old trailing-TTM-sum detector false-tripped because the
    // 365-day window ending ~2024-05-31 clipped 2023-06-01 onto its strict
    // boundary, leaving 3 payments in that window vs 5 in the prior one.
    const pep = [
      ["2026-06-05", 1.48], ["2026-03-06", 1.4225], ["2025-12-05", 1.4225], ["2025-09-05", 1.4225],
      ["2025-06-06", 1.4225], ["2025-03-07", 1.355], ["2024-12-06", 1.355], ["2024-09-06", 1.355],
      ["2024-06-07", 1.355], ["2024-02-29", 1.265], ["2023-11-30", 1.265], ["2023-08-31", 1.265],
      ["2023-06-01", 1.265], ["2023-03-02", 1.15], ["2022-12-01", 1.15], ["2022-09-01", 1.15],
      ["2022-06-02", 1.15], ["2022-03-03", 1.075], ["2021-12-02", 1.075], ["2021-09-02", 1.075],
      ["2021-06-03", 1.075], ["2021-03-04", 1.0225], ["2020-12-03", 1.0225], ["2020-09-03", 1.0225],
    ].map(([date, adj]) => ({ date: date as string, adjDividend: adj as number, dividend: adj as number }));
    expect(detectDividendCut(pep, { asOf: new Date("2026-05-31T00:00:00Z") }).isCut).toBe(false);
  });
});
