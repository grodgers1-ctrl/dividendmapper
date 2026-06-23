import { describe, it, expect } from "vitest";
import { computeRS1Cut } from "../r_s1-cut";
import type { VehicleDividendRow } from "../../vehicle-fmp";

function row(year: number, month: number, amount: number): VehicleDividendRow {
  return {
    ticker: "TEST",
    ex_date: `${year}-${String(month).padStart(2, "0")}-15`,
    payment_date: null,
    dividend: amount,
  };
}

describe("computeRS1Cut", () => {
  it("clean 5y of monthly payments scores 100", () => {
    const dividends: VehicleDividendRow[] = [];
    for (let year = 2020; year <= 2024; year++) {
      for (let month = 1; month <= 12; month++) {
        dividends.push(row(year, month, 0.10 + (year - 2020) * 0.01));
      }
    }
    const result = computeRS1Cut({
      dividends,
      excludeSpecials: false,
      asOf: new Date("2025-02-01Z"),
    });
    expect(result.score).toBe(100);
    expect(result.humanLabel).toMatch(/no dividend cuts/);
  });

  it(">5% YoY drop in the last 5y scores 0", () => {
    // 2024 total = 0.45, 2023 total = 0.60 → 25% cut
    const dividends = [
      row(2020, 6, 0.60),
      row(2021, 6, 0.60),
      row(2022, 6, 0.60),
      row(2023, 6, 0.60),
      row(2024, 6, 0.45),
    ];
    const result = computeRS1Cut({
      dividends,
      excludeSpecials: false,
      asOf: new Date("2025-02-01Z"),
    });
    expect(result.score).toBe(0);
    expect(result.humanLabel).toMatch(/cut 2024/);
    expect(result.humanLabel).toMatch(/25%/);
  });

  it("excludeSpecials filters one-off ≥ 1.5× modal — masking the apparent drop", () => {
    // Without filtering: 2023 total = 12 × 0.30 + 1 × 1.50 = 5.10, 2024 = 12 × 0.30 = 3.60
    //   → 3.60/5.10 = 0.706 → looks like a 29% cut.
    // With filtering: special (1.50 ≥ 1.5 × 0.30) is dropped from 2023 → 2023 total = 3.60, equal.
    const dividends: VehicleDividendRow[] = [];
    for (let year = 2020; year <= 2024; year++) {
      for (let month = 1; month <= 12; month++) {
        dividends.push(row(year, month, 0.30));
      }
    }
    // Add a 2023 special
    dividends.push(row(2023, 12, 1.50));
    const naive = computeRS1Cut({
      dividends,
      excludeSpecials: false,
      asOf: new Date("2025-02-01Z"),
    });
    expect(naive.score).toBe(0);
    const filtered = computeRS1Cut({
      dividends,
      excludeSpecials: true,
      asOf: new Date("2025-02-01Z"),
    });
    expect(filtered.score).toBe(100);
  });

  it("empty history returns null", () => {
    const result = computeRS1Cut({
      dividends: [],
      excludeSpecials: false,
      asOf: new Date("2025-02-01Z"),
    });
    expect(result.score).toBeNull();
    expect(result.humanLabel).toMatch(/no dividend history/);
  });

  it("ignores cuts older than the 5y lookback window", () => {
    // 2018 → 2019 a 30% cut; well outside the 5y window from 2025.
    const dividends = [
      row(2018, 6, 1.00),
      row(2019, 6, 0.70),
      row(2020, 6, 0.70),
      row(2021, 6, 0.70),
      row(2022, 6, 0.70),
      row(2023, 6, 0.70),
      row(2024, 6, 0.70),
    ];
    const result = computeRS1Cut({
      dividends,
      excludeSpecials: false,
      asOf: new Date("2025-02-01Z"),
    });
    expect(result.score).toBe(100);
  });
});
