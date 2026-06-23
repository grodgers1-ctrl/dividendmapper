import { describe, it, expect } from "vitest";
import {
  assembleVehicleInputs,
  type RawVehicleData,
  type FundamentalsSnapshot,
  type PriceSnapshot,
  type FinancialRow,
  type SegmentationEntry,
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

function buildPriceSeries(startYear: number, endYear: number, basePrice: number): PriceSnapshot[] {
  const prices: PriceSnapshot[] = [];
  for (let y = startYear; y <= endYear; y++) {
    for (let q = 1; q <= 4; q++) {
      prices.push({
        observed_at: `${y}-${String(q * 3).padStart(2, "0")}-15`,
        close_price: basePrice + (y - startYear) * 0.5,
      });
    }
  }
  return prices;
}

function buildFundamentals(
  startYear: number,
  endYear: number,
  navStart: number,
): FundamentalsSnapshot[] {
  const out: FundamentalsSnapshot[] = [];
  for (let y = startYear; y <= endYear; y++) {
    for (let q = 1; q <= 4; q++) {
      out.push({
        period_end: `${y}-${String(q * 3).padStart(2, "0")}-30`,
        period_type: "quarterly",
        nav_per_share: navStart + (y - startYear) * 0.5,
        debt_total: 1000,
        equity_total: 2000,
        ebitda: 100,
        interest_expense: 25,
      });
    }
  }
  return out;
}

function buildFmpIncomeQuarterly(n: number): FinancialRow[] {
  // FMP convention: date-desc
  const rows: FinancialRow[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      date: `2024-${String(12 - i * 3).padStart(2, "0")}-31`,
      netIncome: 30,
      depreciationAndAmortization: 40,
      weightedAverageShsOut: 100,
      totalInterestIncome: 50,
      totalOperatingExpenses: 25,
      ebitda: 80,
      interestExpense: 10,
      revenue: 100,
      operatingExpenses: 60,
    });
  }
  return rows;
}

function buildFmpBalanceQuarterly(n: number): FinancialRow[] {
  const rows: FinancialRow[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      date: `2024-${String(12 - i * 3).padStart(2, "0")}-31`,
      totalDebt: 1000,
      cashAndShortTermInvestments: 50,
      totalAssets: 2500,
      totalEquity: 1500,
    });
  }
  return rows;
}

describe("assembleVehicleInputs", () => {
  describe("us_reit", () => {
    it("populates all signal inputs when full data is available", () => {
      const dividends: VehicleDividendRow[] = [];
      for (let y = 2020; y <= 2024; y++) {
        for (let m = 1; m <= 12; m++) dividends.push(divRow(y, m, 0.30));
      }
      const raw: RawVehicleData = {
        ticker: "O",
        vehicleType: "us_reit",
        subSector: "diversified",
        currency: "USD",
        fundamentals: buildFundamentals(2020, 2024, 25),
        prices: buildPriceSeries(2020, 2024, 50),
        dividends: dividends.slice().reverse(), // date-desc
        productSegmentation: [
          {
            date: "2024-12-31",
            data: { Industrial: 0.3, Retail: 0.4, Office: 0.3 },
          },
        ],
        geoSegmentation: [
          {
            date: "2024-12-31",
            data: { US: 0.7, EU: 0.3 },
          },
        ],
        rawIncomeStatements: buildFmpIncomeQuarterly(8),
        rawBalanceSheets: buildFmpBalanceQuarterly(8),
        asOf: new Date("2025-02-01Z"),
      };
      const bundle = assembleVehicleInputs(raw);
      expect(bundle.vehicleType).toBe("us_reit");
      expect(bundle.dataQuality).toBe("full");
      expect(bundle.qR1).toBeDefined();
      expect(bundle.qR1!.ttmFfoPerShare).toBeGreaterThan(0);
      expect(bundle.qR2).toBeDefined();
      expect(bundle.cR1!.segmentShares.length).toBe(3);
      expect(bundle.cR2!.segmentShares.length).toBe(2);
      expect(bundle.rR1).toBeDefined();
      expect(bundle.gateInputs.vehicleType).toBe("us_reit");
      expect(bundle.gateInputs.ttmFfoPerShare).toBeDefined();
    });

    it("cascades when segmentation is missing", () => {
      const raw: RawVehicleData = {
        ticker: "O",
        vehicleType: "us_reit",
        subSector: "diversified",
        currency: "USD",
        fundamentals: buildFundamentals(2020, 2024, 25),
        prices: buildPriceSeries(2020, 2024, 50),
        dividends: [],
        productSegmentation: [],
        geoSegmentation: [],
        rawIncomeStatements: buildFmpIncomeQuarterly(8),
        rawBalanceSheets: buildFmpBalanceQuarterly(8),
        asOf: new Date("2025-02-01Z"),
      };
      const bundle = assembleVehicleInputs(raw);
      expect(bundle.cR1!.segmentShares).toEqual([]);
      expect(bundle.cR2!.segmentShares).toEqual([]);
      expect(bundle.dataQuality).not.toBe("full");
    });

    it("detects a 5y dividend cut for gate input", () => {
      const dividends = [
        divRow(2020, 6, 1.0),
        divRow(2021, 6, 1.0),
        divRow(2022, 6, 1.0),
        divRow(2023, 6, 1.0),
        divRow(2024, 6, 0.7), // 30% cut
      ];
      const raw: RawVehicleData = {
        ticker: "O",
        vehicleType: "us_reit",
        subSector: "diversified",
        currency: "USD",
        fundamentals: buildFundamentals(2020, 2024, 25),
        prices: buildPriceSeries(2020, 2024, 50),
        dividends: dividends.reverse(),
        productSegmentation: [],
        geoSegmentation: [],
        rawIncomeStatements: buildFmpIncomeQuarterly(8),
        rawBalanceSheets: buildFmpBalanceQuarterly(8),
        asOf: new Date("2025-02-01Z"),
      };
      const bundle = assembleVehicleInputs(raw);
      expect(bundle.gateInputs.dividendCutInLast5Years).toBe(true);
    });
  });

  describe("us_bdc", () => {
    it("populates NII coverage and NAV trend", () => {
      const dividends: VehicleDividendRow[] = [];
      for (let y = 2023; y <= 2024; y++) {
        for (let m = 1; m <= 12; m++) dividends.push(divRow(y, m, 0.30, "ARCC"));
      }
      const raw: RawVehicleData = {
        ticker: "ARCC",
        vehicleType: "us_bdc",
        subSector: "specialty_finance",
        currency: "USD",
        fundamentals: buildFundamentals(2022, 2024, 18),
        prices: buildPriceSeries(2022, 2024, 20),
        dividends: dividends.reverse(),
        productSegmentation: [],
        geoSegmentation: [],
        rawIncomeStatements: buildFmpIncomeQuarterly(8),
        rawBalanceSheets: buildFmpBalanceQuarterly(8),
        asOf: new Date("2025-02-01Z"),
      };
      const bundle = assembleVehicleInputs(raw);
      expect(bundle.vehicleType).toBe("us_bdc");
      expect(bundle.qB1).toBeDefined();
      expect(bundle.qB1!.ttmRegularDps).toBeGreaterThan(0);
      expect(bundle.qB2!.navPerShareHistory.length).toBe(12);
      expect(bundle.cB1).toBeDefined();
      expect(bundle.rB2).toBeDefined();
    });
  });

  describe("uk_reit", () => {
    it("populates LTV + EPRA proxy + JSON classification", () => {
      const dividends = [
        divRow(2020, 3, 0.20, "BLND.L"),
        divRow(2020, 9, 0.20, "BLND.L"),
        divRow(2021, 3, 0.21, "BLND.L"),
        divRow(2021, 9, 0.21, "BLND.L"),
        divRow(2022, 3, 0.22, "BLND.L"),
        divRow(2022, 9, 0.22, "BLND.L"),
        divRow(2023, 3, 0.23, "BLND.L"),
        divRow(2023, 9, 0.23, "BLND.L"),
        divRow(2024, 3, 0.24, "BLND.L"),
        divRow(2024, 9, 0.24, "BLND.L"),
      ];
      const semiAnnualFundamentals: FundamentalsSnapshot[] = [
        {
          period_end: "2024-03-31",
          period_type: "semi_annual",
          nav_per_share: 6.0,
          debt_total: 3500,
          equity_total: 6000,
          ebitda: 250,
          interest_expense: 60,
        },
        {
          period_end: "2024-09-30",
          period_type: "semi_annual",
          nav_per_share: 6.1,
          debt_total: 3600,
          equity_total: 6100,
          ebitda: 260,
          interest_expense: 62,
        },
      ];
      const raw: RawVehicleData = {
        ticker: "BLND.L",
        vehicleType: "uk_reit",
        subSector: "diversified",
        currency: "GBP",
        fundamentals: semiAnnualFundamentals,
        prices: buildPriceSeries(2020, 2024, 5),
        dividends: dividends.reverse(),
        productSegmentation: [],
        geoSegmentation: [],
        rawIncomeStatements: [
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
        ],
        rawBalanceSheets: [
          { date: "2024-09-30", totalDebt: 3600, totalAssets: 10000 },
          { date: "2024-03-31", totalDebt: 3500, totalAssets: 9800 },
        ],
        asOf: new Date("2025-02-01Z"),
      };
      const bundle = assembleVehicleInputs(raw);
      expect(bundle.vehicleType).toBe("uk_reit");
      expect(bundle.qU1).toBeDefined();
      expect(bundle.qU2).toBeDefined();
      expect(bundle.qU2!.totalDebt).toBe(3600);
      expect(bundle.qU2!.totalAssets).toBe(10000);
      expect(bundle.cU1!.propertyType).toBe("diversified");
      expect(bundle.cU2!.geographicScope).toBe("uk_only");
      expect(bundle.rU1).toBeDefined();
      expect(bundle.gateInputs.totalAssets).toBe(10000);
    });

    it("cascades C_U1/C_U2 when ticker not in classification JSON", () => {
      const raw: RawVehicleData = {
        ticker: "UNKNOWN.L",
        vehicleType: "uk_reit",
        subSector: "diversified",
        currency: "GBP",
        fundamentals: [],
        prices: [],
        dividends: [],
        productSegmentation: [],
        geoSegmentation: [],
        rawIncomeStatements: [],
        rawBalanceSheets: [],
        asOf: new Date("2025-02-01Z"),
      };
      const bundle = assembleVehicleInputs(raw);
      expect(bundle.cU1).toBeUndefined();
      expect(bundle.cU2).toBeUndefined();
    });
  });
});
