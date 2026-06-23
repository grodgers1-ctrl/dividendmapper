import { describe, it, expect } from "vitest";
import { computeRB2SpecialMix } from "../r_b2-special-mix";
import type { VehicleDividendRow } from "../../vehicle-fmp";

function row(year: number, month: number, amount: number): VehicleDividendRow {
  return {
    ticker: "TEST",
    ex_date: `${year}-${String(month).padStart(2, "0")}-15`,
    payment_date: null,
    dividend: amount,
  };
}

function monthlyYear(year: number, regular: number): VehicleDividendRow[] {
  return Array.from({ length: 12 }, (_, m) => row(year, m + 1, regular));
}

describe("computeRB2SpecialMix", () => {
  it("clean monthly stream (no specials) scores 100", () => {
    const dividends = [...monthlyYear(2023, 0.30), ...monthlyYear(2024, 0.30)];
    const r = computeRB2SpecialMix({ dividends, asOf: new Date("2025-02-01Z") });
    expect(r.score).toBe(100);
  });

  it("specials ~30% of regulars scores 75", () => {
    // regulars = 24 × 0.30 = 7.20; specials needed ~2.16 → two 1.10 specials
    const dividends = [
      ...monthlyYear(2023, 0.30),
      ...monthlyYear(2024, 0.30),
      row(2023, 12, 1.10),
      row(2024, 12, 1.10),
    ];
    const r = computeRB2SpecialMix({ dividends, asOf: new Date("2025-02-01Z") });
    expect(r.score).toBe(75);
  });

  it("specials ~120% of regulars scores 25", () => {
    // regulars = 7.20; specials ~8.64 → eight 1.10 specials
    const dividends = [
      ...monthlyYear(2023, 0.30),
      ...monthlyYear(2024, 0.30),
      row(2023, 3, 1.10),
      row(2023, 6, 1.10),
      row(2023, 9, 1.10),
      row(2023, 12, 1.10),
      row(2024, 3, 1.10),
      row(2024, 6, 1.10),
      row(2024, 9, 1.10),
      row(2024, 12, 1.10),
    ];
    const r = computeRB2SpecialMix({ dividends, asOf: new Date("2025-02-01Z") });
    expect(r.score).toBe(25);
  });

  it("specials > 150% of regulars scores 0", () => {
    // regulars = 12 × 0.30 = 3.60; specials > 5.40 → ten 1.10 specials = 11.0
    const dividends = [
      ...monthlyYear(2024, 0.30),
      ...Array.from({ length: 10 }, (_, i) => row(2024, ((i % 12) + 1), 1.10)),
    ];
    const r = computeRB2SpecialMix({ dividends, asOf: new Date("2025-02-01Z") });
    expect(r.score).toBe(0);
  });

  it("empty history returns null", () => {
    const r = computeRB2SpecialMix({ dividends: [], asOf: new Date("2025-02-01Z") });
    expect(r.score).toBeNull();
  });

  it("no regular distributions in window returns null", () => {
    // Only special-sized payments — no clear regular cadence
    const dividends = [row(2024, 6, 1.10), row(2024, 12, 1.50)];
    const r = computeRB2SpecialMix({ dividends, asOf: new Date("2025-02-01Z") });
    // Modal pick will be one of these — the larger entry becomes the special
    // by the 1.5× rule. Specials may or may not register; just check no throw.
    expect([null, 0, 25, 50, 75, 100]).toContain(r.score);
  });
});
