import { describe, it, expect } from "vitest";
import { computeVehicleScoreFromRaw } from "../compute-vehicle-score";
import type {
  RawVehicleData,
  FundamentalsSnapshot,
  PriceSnapshot,
  FinancialRow,
} from "../vehicle-assemble-inputs";
import type { VehicleDividendRow } from "../vehicle-fmp";

function divRow(year: number, month: number, amount: number, ticker = "O"): VehicleDividendRow {
  return {
    ticker,
    ex_date: `${year}-${String(month).padStart(2, "0")}-15`,
    payment_date: null,
    dividend: amount,
  };
}

function monthlyClean(startYear: number, endYear: number, baseAmount: number, ticker = "O"): VehicleDividendRow[] {
  const out: VehicleDividendRow[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const amount = baseAmount + (y - startYear) * 0.005;
    for (let m = 1; m <= 12; m++) out.push(divRow(y, m, amount, ticker));
  }
  return out;
}

function buildUsReitFundamentals(startY: number, endY: number, navStart: number): FundamentalsSnapshot[] {
  const out: FundamentalsSnapshot[] = [];
  for (let y = startY; y <= endY; y++) {
    for (let q = 1; q <= 4; q++) {
      out.push({
        period_end: `${y}-${String(q * 3).padStart(2, "0")}-30`,
        period_type: "quarterly",
        nav_per_share: navStart + (y - startY) * 0.4 + q * 0.05,
        debt_total: 1000,
        equity_total: 2000,
        ebitda: 100,
        interest_expense: 25,
      });
    }
  }
  return out;
}

function buildPrices(startY: number, endY: number, base: number): PriceSnapshot[] {
  const out: PriceSnapshot[] = [];
  for (let y = startY; y <= endY; y++) {
    for (let m = 1; m <= 12; m++) {
      out.push({
        observed_at: `${y}-${String(m).padStart(2, "0")}-15`,
        close_price: base + (y - startY) * 0.5 + Math.sin(m) * 0.5,
      });
    }
  }
  return out;
}

function usReitFmpFixture(): { inc: FinancialRow[]; bal: FinancialRow[] } {
  const inc: FinancialRow[] = [];
  const bal: FinancialRow[] = [];
  // 8 quarters, date-desc — FFO ≈ (40 + 30) / 100 = 0.7/q → TTM = 2.8
  // DPS TTM (from dividends) ≈ 1.95 (monthly 0.155 × 12 + bump)
  // Payout ≈ 0.7 → score 100
  for (let i = 0; i < 8; i++) {
    inc.push({
      date: `2024-${String(12 - i * 3).padStart(2, "0")}-31`,
      netIncome: 40,
      depreciationAndAmortization: 30,
      weightedAverageShsOut: 100,
      ebitda: 80,
      interestExpense: 10,
      revenue: 150,
      operatingExpenses: 70,
    });
    bal.push({
      date: `2024-${String(12 - i * 3).padStart(2, "0")}-31`,
      totalDebt: 1000,
      cashAndShortTermInvestments: 50,
      totalAssets: 2500,
      totalEquity: 1500,
    });
  }
  return { inc, bal };
}

describe("computeVehicleScoreFromRaw", () => {
  it("us_reit anchor (O-like) — gate passes, score in 50-90 band", () => {
    const { inc, bal } = usReitFmpFixture();
    const raw: RawVehicleData = {
      ticker: "O",
      vehicleType: "us_reit",
      subSector: "diversified",
      currency: "USD",
      fundamentals: buildUsReitFundamentals(2020, 2024, 25),
      prices: buildPrices(2020, 2024, 50),
      dividends: monthlyClean(2014, 2024, 0.15).reverse(),
      productSegmentation: [
        { date: "2024-12-31", data: { Industrial: 0.25, Retail: 0.4, Office: 0.2, Other: 0.15 } },
      ],
      geoSegmentation: [
        { date: "2024-12-31", data: { US: 0.85, EU: 0.15 } },
      ],
      rawIncomeStatements: inc,
      rawBalanceSheets: bal,
      asOf: new Date("2025-02-01Z"),
    };
    const r = computeVehicleScoreFromRaw(raw);
    expect(r.qualityGatePassed).toBe(true);
    expect(r.resilienceScore).not.toBeNull();
    expect(r.resilienceScore!).toBeGreaterThanOrEqual(50);
    expect(r.resilienceScore!).toBeLessThanOrEqual(90);
    // FFO payout depends on 12-month dividend window; accept the realistic
    // 75-100 range for synthesised fixtures (lower bound = exactly 11 of 12
    // monthly payments caught by the 360-day window approximation).
    expect(r.signals.find((s) => s.code === "Q_R1")?.rawScore).toBeGreaterThanOrEqual(75);
    expect(r.dataQuality).toBe("full");
    expect(r.priceNavRatio).toBeGreaterThan(0);
  });

  it("us_reit with dividend cut fails G_R2 — score null", () => {
    const { inc, bal } = usReitFmpFixture();
    const cutDividends = [
      divRow(2020, 6, 1.0),
      divRow(2021, 6, 1.0),
      divRow(2022, 6, 1.0),
      divRow(2023, 6, 1.0),
      divRow(2024, 6, 0.7), // 30% cut
    ];
    const raw: RawVehicleData = {
      ticker: "DISTRESSED",
      vehicleType: "us_reit",
      subSector: "diversified",
      currency: "USD",
      fundamentals: buildUsReitFundamentals(2020, 2024, 25),
      prices: buildPrices(2020, 2024, 50),
      dividends: cutDividends.reverse(),
      productSegmentation: [],
      geoSegmentation: [],
      rawIncomeStatements: inc,
      rawBalanceSheets: bal,
      asOf: new Date("2025-02-01Z"),
    };
    const r = computeVehicleScoreFromRaw(raw);
    expect(r.qualityGatePassed).toBe(false);
    expect(r.failedGates).toContain("G_R2");
    expect(r.resilienceScore).toBeNull();
  });

  it("us_bdc — gate passes when NII covers regular DPS", () => {
    // FMP fixture: NII per share TTM = (interest 50 − opex 25) / 100 = 0.25/q
    // → TTM 1.00. Regular DPS (monthly 0.085 × 12 ≈ 1.02) → coverage ~0.98
    const inc: FinancialRow[] = [];
    const bal: FinancialRow[] = [];
    for (let i = 0; i < 8; i++) {
      inc.push({
        date: `2024-${String(12 - i * 3).padStart(2, "0")}-31`,
        totalInterestIncome: 50,
        totalOperatingExpenses: 20,
        weightedAverageShsOut: 100,
        ebitda: 60,
        interestExpense: 15,
      });
      bal.push({
        date: `2024-${String(12 - i * 3).padStart(2, "0")}-31`,
        totalDebt: 1500,
        totalEquity: 1500,
      });
    }
    const dividends: VehicleDividendRow[] = [];
    for (let y = 2020; y <= 2024; y++) {
      for (let m = 1; m <= 12; m++) dividends.push(divRow(y, m, 0.10, "ARCC"));
    }
    const raw: RawVehicleData = {
      ticker: "ARCC",
      vehicleType: "us_bdc",
      subSector: "specialty_finance",
      currency: "USD",
      fundamentals: buildUsReitFundamentals(2020, 2024, 18),
      prices: buildPrices(2020, 2024, 20),
      dividends: dividends.reverse(),
      productSegmentation: [],
      geoSegmentation: [],
      rawIncomeStatements: inc,
      rawBalanceSheets: bal,
      asOf: new Date("2025-02-01Z"),
    };
    const r = computeVehicleScoreFromRaw(raw);
    expect(r.qualityGatePassed).toBe(true);
    expect(r.resilienceScore).not.toBeNull();
    expect(r.signals.find((s) => s.code === "Q_B1")?.rawScore).not.toBeNull();
    expect(r.signals.find((s) => s.code === "Q_B2")?.rawScore).not.toBeNull();
  });

  it("uk_reit BLND-like — gate passes, JSON classification flows through", () => {
    const inc: FinancialRow[] = [
      {
        date: "2024-09-30",
        revenue: 300,
        operatingExpenses: 150,
        ebitda: 200,
        interestExpense: 50,
        weightedAverageShsOut: 900,
        dividendsPaid: -100,
      },
      {
        date: "2024-03-31",
        revenue: 290,
        operatingExpenses: 140,
        ebitda: 195,
        interestExpense: 48,
        weightedAverageShsOut: 900,
        dividendsPaid: -95,
      },
    ];
    const bal: FinancialRow[] = [
      { date: "2024-09-30", totalDebt: 3600, totalAssets: 10000 },
      { date: "2024-03-31", totalDebt: 3500, totalAssets: 9800 },
    ];
    const semi: FundamentalsSnapshot[] = [
      { period_end: "2024-03-31", period_type: "semi_annual", nav_per_share: 6.0, debt_total: 3500, equity_total: 6000, ebitda: 195, interest_expense: 48 },
      { period_end: "2024-09-30", period_type: "semi_annual", nav_per_share: 6.1, debt_total: 3600, equity_total: 6100, ebitda: 200, interest_expense: 50 },
    ];
    const dividends = [
      divRow(2020, 3, 0.20, "BLND.L"), divRow(2020, 9, 0.20, "BLND.L"),
      divRow(2021, 3, 0.21, "BLND.L"), divRow(2021, 9, 0.21, "BLND.L"),
      divRow(2022, 3, 0.22, "BLND.L"), divRow(2022, 9, 0.22, "BLND.L"),
      divRow(2023, 3, 0.23, "BLND.L"), divRow(2023, 9, 0.23, "BLND.L"),
      divRow(2024, 3, 0.24, "BLND.L"), divRow(2024, 9, 0.24, "BLND.L"),
    ];
    const raw: RawVehicleData = {
      ticker: "BLND.L",
      vehicleType: "uk_reit",
      subSector: "diversified",
      currency: "GBP",
      fundamentals: semi,
      prices: buildPrices(2020, 2024, 5),
      dividends: dividends.reverse(),
      productSegmentation: [],
      geoSegmentation: [],
      rawIncomeStatements: inc,
      rawBalanceSheets: bal,
      asOf: new Date("2025-02-01Z"),
    };
    const r = computeVehicleScoreFromRaw(raw);
    expect(r.qualityGatePassed).toBe(true);
    expect(r.resilienceScore).not.toBeNull();
    expect(r.signals.find((s) => s.code === "C_U1")?.rawScore).toBe(100);
    expect(r.signals.find((s) => s.code === "C_U2")?.rawScore).toBe(50);
    expect(r.signals.find((s) => s.code === "Q_U2")?.rawScore).toBe(50); // 36% LTV → 50
  });

  it("contribution weights sum to ~category × effective within category", () => {
    const { inc, bal } = usReitFmpFixture();
    const raw: RawVehicleData = {
      ticker: "O",
      vehicleType: "us_reit",
      subSector: "diversified",
      currency: "USD",
      fundamentals: buildUsReitFundamentals(2020, 2024, 25),
      prices: buildPrices(2020, 2024, 50),
      dividends: monthlyClean(2014, 2024, 0.15).reverse(),
      productSegmentation: [
        { date: "2024-12-31", data: { Industrial: 0.25, Retail: 0.4, Office: 0.35 } },
      ],
      geoSegmentation: [
        { date: "2024-12-31", data: { US: 0.7, EU: 0.3 } },
      ],
      rawIncomeStatements: inc,
      rawBalanceSheets: bal,
      asOf: new Date("2025-02-01Z"),
    };
    const r = computeVehicleScoreFromRaw(raw);
    const totalWeight = r.signals
      .filter((s) => s.rawScore !== null)
      .reduce((a, s) => a + s.weight, 0);
    // All categories contributing → weights sum to 1.0 (within rounding)
    expect(totalWeight).toBeGreaterThan(0.99);
    expect(totalWeight).toBeLessThan(1.01);
  });

  it("UK REIT >50% LTV fails G_U1 — score null", () => {
    const inc: FinancialRow[] = [
      { date: "2024-09-30", revenue: 300, operatingExpenses: 150, ebitda: 200, interestExpense: 60, weightedAverageShsOut: 900 },
      { date: "2024-03-31", revenue: 290, operatingExpenses: 140, ebitda: 195, interestExpense: 58, weightedAverageShsOut: 900 },
    ];
    const bal: FinancialRow[] = [
      { date: "2024-09-30", totalDebt: 5800, totalAssets: 10000 }, // 58% LTV
      { date: "2024-03-31", totalDebt: 5500, totalAssets: 9800 },
    ];
    const raw: RawVehicleData = {
      ticker: "BLND.L",
      vehicleType: "uk_reit",
      subSector: "diversified",
      currency: "GBP",
      fundamentals: [
        { period_end: "2024-03-31", period_type: "semi_annual", nav_per_share: 6.0, debt_total: 5500, equity_total: 4000, ebitda: 195, interest_expense: 58 },
        { period_end: "2024-09-30", period_type: "semi_annual", nav_per_share: 5.9, debt_total: 5800, equity_total: 3900, ebitda: 200, interest_expense: 60 },
      ],
      prices: buildPrices(2020, 2024, 5),
      dividends: [
        divRow(2020, 3, 0.20, "BLND.L"), divRow(2020, 9, 0.20, "BLND.L"),
        divRow(2021, 3, 0.21, "BLND.L"), divRow(2021, 9, 0.21, "BLND.L"),
        divRow(2022, 3, 0.22, "BLND.L"), divRow(2022, 9, 0.22, "BLND.L"),
        divRow(2023, 3, 0.23, "BLND.L"), divRow(2023, 9, 0.23, "BLND.L"),
        divRow(2024, 3, 0.24, "BLND.L"), divRow(2024, 9, 0.24, "BLND.L"),
      ].reverse(),
      productSegmentation: [],
      geoSegmentation: [],
      rawIncomeStatements: inc,
      rawBalanceSheets: bal,
      asOf: new Date("2025-02-01Z"),
    };
    const r = computeVehicleScoreFromRaw(raw);
    expect(r.qualityGatePassed).toBe(false);
    expect(r.failedGates).toContain("G_U1");
    expect(r.resilienceScore).toBeNull();
  });

  it("degraded data flags partial/sparse dataQuality", () => {
    const raw: RawVehicleData = {
      ticker: "PARTIAL",
      vehicleType: "us_reit",
      subSector: "diversified",
      currency: "USD",
      fundamentals: [
        { period_end: "2024-09-30", period_type: "quarterly", nav_per_share: 25, debt_total: 1000, equity_total: 2000, ebitda: 100, interest_expense: 25 },
      ],
      prices: buildPrices(2020, 2024, 50),
      dividends: monthlyClean(2020, 2024, 0.15).reverse(),
      productSegmentation: [], // missing
      geoSegmentation: [],     // missing
      rawIncomeStatements: [], // no FMP → Q_R1, Q_R2, R_R1 cascade
      rawBalanceSheets: [],
      asOf: new Date("2025-02-01Z"),
    };
    const r = computeVehicleScoreFromRaw(raw);
    expect(["partial", "sparse"]).toContain(r.dataQuality);
  });
});
