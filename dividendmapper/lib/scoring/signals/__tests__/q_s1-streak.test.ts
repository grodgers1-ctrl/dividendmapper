import { describe, it, expect } from "vitest";
import { computeQS1Streak } from "../q_s1-streak";
import type { VehicleDividendRow } from "../../vehicle-fmp";

function row(year: number, month: number, amount: number): VehicleDividendRow {
  return {
    ticker: "TEST",
    ex_date: `${year}-${String(month).padStart(2, "0")}-15`,
    payment_date: null,
    dividend: amount,
  };
}

describe("computeQS1Streak", () => {
  it("monthly payer with 10y clean streak scores 50", () => {
    // 2015..2024 inclusive = 10 complete years, asOf 2025
    const dividends: VehicleDividendRow[] = [];
    for (let year = 2015; year <= 2024; year++) {
      const amount = 0.10 + (year - 2015) * 0.005;
      for (let month = 1; month <= 12; month++) {
        dividends.push(row(year, month, amount));
      }
    }
    const result = computeQS1Streak({ dividends, asOf: new Date("2025-01-15Z") });
    expect(result.score).toBe(50);
    expect(result.humanLabel).toMatch(/10y/);
  });

  it("semi-annual payer with 25y clean streak scores 100", () => {
    const dividends: VehicleDividendRow[] = [];
    for (let year = 2000; year <= 2024; year++) {
      const amount = 0.5 + (year - 2000) * 0.05;
      dividends.push(row(year, 3, amount));
      dividends.push(row(year, 9, amount));
    }
    const result = computeQS1Streak({ dividends, asOf: new Date("2025-01-15Z") });
    expect(result.score).toBe(100);
    expect(result.humanLabel).toMatch(/25y/);
  });

  it("ticker with a 7% YoY drop in 2022 resets — current streak = 3", () => {
    // asOf 2025; most recent complete year = 2024.
    // 2022 → 93 vs 2021 → 100 = 7% drop. Streak runs 2024, 2023, 2022 (=3y).
    const totals: Record<number, number> = {
      2018: 100,
      2019: 100,
      2020: 100,
      2021: 100,
      2022: 93,
      2023: 95,
      2024: 100,
    };
    const dividends: VehicleDividendRow[] = [];
    for (const [yearStr, total] of Object.entries(totals)) {
      const year = parseInt(yearStr, 10);
      dividends.push(row(year, 6, total));
    }
    const result = computeQS1Streak({ dividends, asOf: new Date("2025-01-15Z") });
    // streak=3, band [0,5] → 3/5 × 25 = 15
    expect(result.score).toBe(15);
    expect(result.humanLabel).toMatch(/3y/);
  });

  it("empty history returns null with humanLabel", () => {
    const result = computeQS1Streak({ dividends: [], asOf: new Date("2025-01-15Z") });
    expect(result.score).toBeNull();
    expect(result.humanLabel).toMatch(/no dividend history/);
  });

  it("only data in current calendar year (incomplete) scores 0", () => {
    // No complete year of data — only the in-progress 2025 year exists.
    const dividends = [row(2025, 1, 0.10), row(2025, 4, 0.10)];
    const result = computeQS1Streak({ dividends, asOf: new Date("2025-06-15Z") });
    expect(result.score).toBe(0);
    expect(result.humanLabel).toMatch(/no complete-year/);
  });
});
