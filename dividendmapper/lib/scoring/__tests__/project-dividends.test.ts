import { describe, it, expect } from "vitest";
import {
  detectCadence,
  detectCadenceByYearCount,
  computeGrowthRate,
  projectDividends,
  type HistoricalPayment,
} from "../project-dividends";

const today = new Date("2026-06-23T00:00:00Z");

describe("detectCadence", () => {
  it("returns 'quarterly' for 4 payments at ~90d gaps", () => {
    expect(
      detectCadence([
        { exDate: "2026-03-15", amount: 0.25 },
        { exDate: "2025-12-15", amount: 0.25 },
        { exDate: "2025-09-15", amount: 0.25 },
        { exDate: "2025-06-15", amount: 0.25 },
      ]),
    ).toBe("quarterly");
  });

  it("returns 'monthly' for monthly-pay tickers like O", () => {
    expect(
      detectCadence([
        { exDate: "2026-05-30", amount: 0.265 },
        { exDate: "2026-04-30", amount: 0.265 },
        { exDate: "2026-03-30", amount: 0.265 },
        { exDate: "2026-02-28", amount: 0.265 },
        { exDate: "2026-01-30", amount: 0.265 },
      ]),
    ).toBe("monthly");
  });

  it("returns 'semi' for UK-style half-yearly payers", () => {
    expect(
      detectCadence([
        { exDate: "2026-04-10", amount: 1.2 },
        { exDate: "2025-10-10", amount: 1.1 },
        { exDate: "2025-04-10", amount: 1.0 },
        { exDate: "2024-10-10", amount: 1.0 },
      ]),
    ).toBe("semi");
  });

  it("returns 'annual' for once-yearly payers", () => {
    expect(
      detectCadence([
        { exDate: "2026-04-10", amount: 1.2 },
        { exDate: "2025-04-10", amount: 1.1 },
        { exDate: "2024-04-10", amount: 1.0 },
        { exDate: "2023-04-10", amount: 1.0 },
      ]),
    ).toBe("annual");
  });

  it("returns 'unknown' when fewer than 4 payments", () => {
    expect(detectCadence([{ exDate: "2026-04-10", amount: 1 }])).toBe("unknown");
    expect(
      detectCadence([
        { exDate: "2026-04-10", amount: 1 },
        { exDate: "2026-01-10", amount: 1 },
        { exDate: "2025-10-10", amount: 1 },
      ]),
    ).toBe("unknown");
  });

  it("returns 'irregular' for special-divvy-shaped history", () => {
    expect(
      detectCadence([
        { exDate: "2026-06-01", amount: 10 },
        { exDate: "2025-12-15", amount: 1 },
        { exDate: "2025-03-20", amount: 1 },
        { exDate: "2023-05-10", amount: 1 },
      ]),
    ).toBe("irregular");
  });

  // Regression tests from the 2026-06-25 calendar v2 audit. Each ticker was
  // previously tagged 'irregular' by the median-gap path even though FMP
  // shows a reliable cadence over multiple complete years.

  it("ABDN.L: semi-annual with asymmetric gaps (audit regression)", () => {
    const history = [
      { exDate: "2026-03-19", amount: 7.3 },
      { exDate: "2025-08-14", amount: 7.3 },
      { exDate: "2025-03-27", amount: 7.3 },
      { exDate: "2024-08-15", amount: 7.3 },
      { exDate: "2024-03-15", amount: 7.0 },
      { exDate: "2023-08-15", amount: 7.0 },
      { exDate: "2023-03-15", amount: 7.0 },
      { exDate: "2022-08-15", amount: 6.6 },
      { exDate: "2022-03-15", amount: 6.6 },
    ];
    expect(detectCadence(history)).toBe("semi");
  });

  it("LGEN.L: semi-annual with ~245d median gap (audit regression)", () => {
    const history = [
      { exDate: "2026-04-23", amount: 15.67 },
      { exDate: "2025-08-21", amount: 6.12 },
      { exDate: "2025-04-24", amount: 15.36 },
      { exDate: "2024-08-22", amount: 6.0 },
      { exDate: "2024-04-23", amount: 14.9 },
      { exDate: "2023-08-22", amount: 5.71 },
      { exDate: "2023-04-23", amount: 14.37 },
      { exDate: "2022-08-22", amount: 5.44 },
      { exDate: "2022-04-23", amount: 13.27 },
    ];
    expect(detectCadence(history)).toBe("semi");
  });

  it("RIO.L: semi-annual with ~203d median gap (audit regression)", () => {
    const history = [
      { exDate: "2026-03-05", amount: 191.77 },
      { exDate: "2025-08-14", amount: 108.58 },
      { exDate: "2025-03-06", amount: 175.99 },
      { exDate: "2024-08-15", amount: 134.22 },
      { exDate: "2024-03-05", amount: 165.0 },
      { exDate: "2023-08-15", amount: 144.4 },
      { exDate: "2023-03-05", amount: 225.0 },
    ];
    expect(detectCadence(history)).toBe("semi");
  });

  it("PHP.L: quarterly hidden behind median-gap 98 (audit regression)", () => {
    const history = [
      { exDate: "2026-07-02", amount: 1.68 },
      { exDate: "2026-03-26", amount: 1.825 },
      { exDate: "2026-01-29", amount: 1.825 },
      { exDate: "2025-10-09", amount: 1.775 },
      { exDate: "2025-07-03", amount: 1.775 },
      { exDate: "2025-03-27", amount: 1.775 },
      { exDate: "2025-01-30", amount: 1.775 },
      { exDate: "2024-10-09", amount: 1.7 },
      { exDate: "2024-07-04", amount: 1.7 },
      { exDate: "2024-03-28", amount: 1.7 },
      { exDate: "2024-01-30", amount: 1.7 },
    ];
    expect(detectCadence(history)).toBe("quarterly");
  });

  it("BBOX.L: genuinely irregular falls through to median-gap and stays irregular", () => {
    const history = [
      { exDate: "2026-05-21", amount: 2.0 },
      { exDate: "2026-03-12", amount: 2.255 },
      { exDate: "2025-11-06", amount: 1.915 },
      { exDate: "2025-08-14", amount: 1.915 },
      { exDate: "2025-05-22", amount: 1.915 },
      { exDate: "2025-03-13", amount: 2.185 },
      { exDate: "2024-08-15", amount: 1.85 },
    ];
    expect(detectCadence(history)).toBe("irregular");
  });
});

describe("computeGrowthRate", () => {
  it("CAGR over 3 complete years of quarterly payments", () => {
    // Yearly sums: 2023:4.00, 2024:4.20, 2025:4.41. CAGR = (4.41/4.00)^(1/2)-1 ≈ 5%.
    const history = [
      { exDate: "2023-03-15", amount: 1.00 }, { exDate: "2023-06-15", amount: 1.00 },
      { exDate: "2023-09-15", amount: 1.00 }, { exDate: "2023-12-15", amount: 1.00 },
      { exDate: "2024-03-15", amount: 1.05 }, { exDate: "2024-06-15", amount: 1.05 },
      { exDate: "2024-09-15", amount: 1.05 }, { exDate: "2024-12-15", amount: 1.05 },
      { exDate: "2025-03-15", amount: 1.1025 }, { exDate: "2025-06-15", amount: 1.1025 },
      { exDate: "2025-09-15", amount: 1.1025 }, { exDate: "2025-12-15", amount: 1.1025 },
    ];
    expect(computeGrowthRate(history)).toBeCloseTo(0.05, 2);
  });

  it("clips growth at +20% per year", () => {
    const history = [
      { exDate: "2023-03-15", amount: 1 }, { exDate: "2023-06-15", amount: 1 },
      { exDate: "2023-09-15", amount: 1 }, { exDate: "2023-12-15", amount: 1 },
      { exDate: "2024-03-15", amount: 2 }, { exDate: "2024-06-15", amount: 2 },
      { exDate: "2024-09-15", amount: 2 }, { exDate: "2024-12-15", amount: 2 },
      { exDate: "2025-03-15", amount: 4 }, { exDate: "2025-06-15", amount: 4 },
      { exDate: "2025-09-15", amount: 4 }, { exDate: "2025-12-15", amount: 4 },
    ];
    // Raw CAGR ~ 100%/yr — clipped to +20%.
    expect(computeGrowthRate(history)).toBeCloseTo(0.20, 4);
  });

  it("excludes the latest year when it's a partial-year tail (e.g. 2 payments YTD vs 4 historic)", () => {
    // 2023, 2024, 2025 all have 4 payments. 2026 has only 2 (YTD). Drop 2026
    // so CAGR computes over 2023-2025 only and yields ~5% (not skewed by partial).
    const history = [
      { exDate: "2023-03-15", amount: 1.00 }, { exDate: "2023-06-15", amount: 1.00 },
      { exDate: "2023-09-15", amount: 1.00 }, { exDate: "2023-12-15", amount: 1.00 },
      { exDate: "2024-03-15", amount: 1.05 }, { exDate: "2024-06-15", amount: 1.05 },
      { exDate: "2024-09-15", amount: 1.05 }, { exDate: "2024-12-15", amount: 1.05 },
      { exDate: "2025-03-15", amount: 1.1025 }, { exDate: "2025-06-15", amount: 1.1025 },
      { exDate: "2025-09-15", amount: 1.1025 }, { exDate: "2025-12-15", amount: 1.1025 },
      { exDate: "2026-03-15", amount: 1.158 }, { exDate: "2026-06-15", amount: 1.158 },
    ];
    expect(computeGrowthRate(history)).toBeCloseTo(0.05, 2);
  });

  it("returns 0 when fewer than 2 complete years are available", () => {
    expect(
      computeGrowthRate([
        { exDate: "2025-12-15", amount: 0.50 },
        { exDate: "2026-03-15", amount: 0.50 },
      ]),
    ).toBe(0);
  });
});

describe("projectDividends — forward", () => {
  it("projects forward at the detected cadence and tags 'cadence' when growth is 0", () => {
    const history: HistoricalPayment[] = [
      { exDate: "2026-03-15", amount: 0.50 },
      { exDate: "2025-12-15", amount: 0.50 },
      { exDate: "2025-09-15", amount: 0.50 },
      { exDate: "2025-06-15", amount: 0.50 },
    ];
    const result = projectDividends({
      ticker: "EXMPL",
      historicalPayments: history,
      holding: { quantity: 10, createdAt: "2024-01-01" },
      today,
      direction: "forward",
      currency: "USD",
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.perShareAmount === 0.50)).toBe(true);
    expect(result.every((r) => r.confidence === "cadence")).toBe(true);
    expect(result.every((r) => r.currency === "USD")).toBe(true);
    expect(result.every((r) => r.exDate > "2026-06-23")).toBe(true);
  });

  it("applies growth-adjusted amounts and tags 'cadence+growth'", () => {
    const history: HistoricalPayment[] = [
      { exDate: "2023-03-15", amount: 1.00 }, { exDate: "2023-06-15", amount: 1.00 },
      { exDate: "2023-09-15", amount: 1.00 }, { exDate: "2023-12-15", amount: 1.00 },
      { exDate: "2024-03-15", amount: 1.05 }, { exDate: "2024-06-15", amount: 1.05 },
      { exDate: "2024-09-15", amount: 1.05 }, { exDate: "2024-12-15", amount: 1.05 },
      { exDate: "2025-03-15", amount: 1.1025 }, { exDate: "2025-06-15", amount: 1.1025 },
      { exDate: "2025-09-15", amount: 1.1025 }, { exDate: "2025-12-15", amount: 1.1025 },
      { exDate: "2026-03-15", amount: 1.158 }, { exDate: "2026-06-15", amount: 1.158 },
    ];
    const result = projectDividends({
      ticker: "GROW",
      historicalPayments: history,
      holding: { quantity: 10, createdAt: "2022-01-01" },
      today,
      direction: "forward",
      currency: "USD",
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.confidence === "cadence+growth")).toBe(true);
    expect(result[0].perShareAmount).toBeGreaterThan(1.158);
  });

  it("freezes growth when latest payment is < 95% of trailing-12m avg", () => {
    const history: HistoricalPayment[] = [
      { exDate: "2025-06-15", amount: 1.00 }, { exDate: "2025-09-15", amount: 1.00 },
      { exDate: "2025-12-15", amount: 1.00 }, { exDate: "2026-03-15", amount: 1.00 },
      // Latest payment cut to 0.80 → < 0.95 × 0.96 ttm avg.
      { exDate: "2026-06-15", amount: 0.80 },
    ];
    const result = projectDividends({
      ticker: "CUT",
      historicalPayments: history,
      holding: { quantity: 10, createdAt: "2024-01-01" },
      today,
      direction: "forward",
      currency: "USD",
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.perShareAmount === 0.80)).toBe(true);
    expect(result.every((r) => r.confidence === "cadence")).toBe(true);
  });

  it("returns [] when fewer than 4 payments (cadence unknown)", () => {
    const history: HistoricalPayment[] = [
      { exDate: "2026-03-15", amount: 0.50 },
      { exDate: "2025-12-15", amount: 0.50 },
      { exDate: "2025-09-15", amount: 0.50 },
    ];
    const result = projectDividends({
      ticker: "NEW",
      historicalPayments: history,
      holding: { quantity: 10, createdAt: "2024-01-01" },
      today,
      direction: "forward",
      currency: "USD",
    });
    expect(result).toHaveLength(0);
  });

  it("returns [] when cadence is irregular", () => {
    const history: HistoricalPayment[] = [
      { exDate: "2026-06-01", amount: 10 },
      { exDate: "2025-12-15", amount: 1 },
      { exDate: "2025-03-20", amount: 1 },
      { exDate: "2023-05-10", amount: 1 },
    ];
    const result = projectDividends({
      ticker: "WEIRD",
      historicalPayments: history,
      holding: { quantity: 10, createdAt: "2024-01-01" },
      today,
      direction: "forward",
      currency: "USD",
    });
    expect(result).toHaveLength(0);
  });
});

describe("projectDividends — backward (holdings.createdAt floor)", () => {
  it("does NOT back-project before the user owned the position", () => {
    const history: HistoricalPayment[] = [
      { exDate: "2025-06-15", amount: 1.00 }, { exDate: "2025-09-15", amount: 1.00 },
      { exDate: "2025-12-15", amount: 1.00 }, { exDate: "2026-03-15", amount: 1.00 },
    ];
    const result = projectDividends({
      ticker: "HELD",
      historicalPayments: history,
      holding: { quantity: 10, createdAt: "2026-04-01" },
      today,
      direction: "backward",
      currency: "USD",
    });
    expect(result.every((p) => p.exDate >= "2026-04-01")).toBe(true);
  });

  it("falls back to today - 6mo when createdAt is null", () => {
    const history: HistoricalPayment[] = [
      { exDate: "2025-06-15", amount: 1.00 }, { exDate: "2025-09-15", amount: 1.00 },
      { exDate: "2025-12-15", amount: 1.00 }, { exDate: "2026-03-15", amount: 1.00 },
    ];
    const result = projectDividends({
      ticker: "LEGACY",
      historicalPayments: history,
      holding: { quantity: 10, createdAt: null },
      today,
      direction: "backward",
      currency: "USD",
    });
    // Floor = max(createdAt || -6mo, -6mo) ≈ 2025-12-24 to 2025-12-25
    // depending on month lengths. All emissions must be at or after.
    expect(result.every((p) => p.exDate >= "2025-12-20")).toBe(true);
  });

  it("only emits between floor and today, never beyond", () => {
    const history: HistoricalPayment[] = [
      { exDate: "2025-06-15", amount: 1.00 }, { exDate: "2025-09-15", amount: 1.00 },
      { exDate: "2025-12-15", amount: 1.00 }, { exDate: "2026-03-15", amount: 1.00 },
    ];
    const result = projectDividends({
      ticker: "HELD",
      historicalPayments: history,
      holding: { quantity: 10, createdAt: "2025-01-01" },
      today,
      direction: "backward",
      currency: "USD",
    });
    expect(result.every((p) => p.exDate <= "2026-06-23")).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("detectCadenceByYearCount", () => {
  it("returns 'quarterly' when the mode of payments-per-year is 4", () => {
    const history = [
      { exDate: "2026-03-15", amount: 0.25 },
      { exDate: "2025-12-15", amount: 0.25 },
      { exDate: "2025-09-15", amount: 0.25 },
      { exDate: "2025-06-15", amount: 0.25 },
      { exDate: "2025-03-15", amount: 0.25 },
      { exDate: "2024-12-15", amount: 0.24 },
      { exDate: "2024-09-15", amount: 0.24 },
      { exDate: "2024-06-15", amount: 0.24 },
      { exDate: "2024-03-15", amount: 0.24 },
    ];
    expect(detectCadenceByYearCount(history)).toBe("quarterly");
  });

  it("returns 'semi' for a UK-style payer paying twice a year", () => {
    const history = [
      { exDate: "2026-03-19", amount: 7.3 },
      { exDate: "2025-08-14", amount: 7.3 },
      { exDate: "2025-03-27", amount: 7.3 },
      { exDate: "2024-08-15", amount: 7.3 },
      { exDate: "2024-03-15", amount: 7.0 },
      { exDate: "2023-08-15", amount: 7.0 },
      { exDate: "2023-03-15", amount: 7.0 },
    ];
    expect(detectCadenceByYearCount(history)).toBe("semi");
  });

  it("returns 'monthly' when the mode is 12", () => {
    const history: { exDate: string; amount: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      history.push({ exDate: `2025-${String(m).padStart(2, "0")}-15`, amount: 0.26 });
      history.push({ exDate: `2024-${String(m).padStart(2, "0")}-15`, amount: 0.25 });
    }
    history.push({ exDate: "2026-01-15", amount: 0.27 });
    expect(detectCadenceByYearCount(history)).toBe("monthly");
  });

  it("returns 'annual' when the mode is 1", () => {
    const history = [
      { exDate: "2026-04-10", amount: 1.2 },
      { exDate: "2025-04-10", amount: 1.1 },
      { exDate: "2024-04-10", amount: 1.0 },
      { exDate: "2023-04-10", amount: 0.9 },
    ];
    expect(detectCadenceByYearCount(history)).toBe("annual");
  });

  it("returns null when there are fewer than 2 complete years", () => {
    const history = [
      { exDate: "2026-03-15", amount: 0.25 },
      { exDate: "2025-12-15", amount: 0.25 },
      { exDate: "2025-09-15", amount: 0.25 },
      { exDate: "2025-06-15", amount: 0.25 },
    ];
    expect(detectCadenceByYearCount(history)).toBeNull();
  });

  it("returns null when no count appears in 2 or more years (no mode)", () => {
    const history = [
      { exDate: "2026-06-01", amount: 10 },
      { exDate: "2025-09-15", amount: 1 },
      { exDate: "2024-12-15", amount: 1 },
      { exDate: "2024-08-15", amount: 1 },
      { exDate: "2024-03-15", amount: 1 },
      { exDate: "2023-06-15", amount: 1 },
      { exDate: "2023-03-15", amount: 1 },
    ];
    expect(detectCadenceByYearCount(history)).toBeNull();
  });

  it("returns null when the mode count maps to none of {1, 2, 4, 12}", () => {
    const history = [
      { exDate: "2026-06-15", amount: 1 },
      { exDate: "2025-09-15", amount: 1 },
      { exDate: "2025-06-15", amount: 1 },
      { exDate: "2025-03-15", amount: 1 },
      { exDate: "2024-09-15", amount: 1 },
      { exDate: "2024-06-15", amount: 1 },
      { exDate: "2024-03-15", amount: 1 },
    ];
    expect(detectCadenceByYearCount(history)).toBeNull();
  });

  it("tolerates one outlier year in the mode window (semi with one bonus year)", () => {
    const history = [
      { exDate: "2026-03-19", amount: 7.3 },
      { exDate: "2025-08-14", amount: 7.3 },
      { exDate: "2025-03-27", amount: 7.3 },
      { exDate: "2024-11-28", amount: 4 },
      { exDate: "2024-08-15", amount: 7.3 },
      { exDate: "2024-03-15", amount: 7.0 },
      { exDate: "2023-08-15", amount: 7.0 },
      { exDate: "2023-03-15", amount: 7.0 },
    ];
    expect(detectCadenceByYearCount(history)).toBe("semi");
  });
});
