import { describe, it, expect } from "vitest";
import { runVehicleQualityGates } from "../vehicle-quality-gates";

describe("runVehicleQualityGates", () => {
  describe("us_reit", () => {
    it("passes when FFO payout ≤ 100% and no cut", () => {
      const r = runVehicleQualityGates({
        vehicleType: "us_reit",
        subSector: "diversified",
        dividendCutInLast5Years: false,
        ttmDps: 2.0,
        ttmFfoPerShare: 3.0,
      });
      expect(r.passed).toBe(true);
      expect(r.failedGates).toEqual([]);
    });

    it("fails G_R1 when FFO payout > 100%", () => {
      const r = runVehicleQualityGates({
        vehicleType: "us_reit",
        subSector: "diversified",
        dividendCutInLast5Years: false,
        ttmDps: 3.5,
        ttmFfoPerShare: 3.0,
      });
      expect(r.failedGates).toContain("G_R1");
    });

    it("fails G_R2 on dividend cut", () => {
      const r = runVehicleQualityGates({
        vehicleType: "us_reit",
        subSector: "diversified",
        dividendCutInLast5Years: true,
        ttmDps: 2.0,
        ttmFfoPerShare: 3.0,
      });
      expect(r.failedGates).toContain("G_R2");
    });

    it("skips G_R1 when FFO data unavailable", () => {
      const r = runVehicleQualityGates({
        vehicleType: "us_reit",
        subSector: "diversified",
        dividendCutInLast5Years: false,
      });
      expect(r.passed).toBe(true);
    });
  });

  describe("us_bdc", () => {
    it("passes when NII coverage ≥ 0.95 and no regular cut", () => {
      const r = runVehicleQualityGates({
        vehicleType: "us_bdc",
        subSector: "specialty_finance",
        dividendCutInLast5Years: false,
        regularDividendCutInLast5Years: false,
        ttmNiiPerShare: 1.0,
        ttmRegularDps: 1.0,
      });
      expect(r.passed).toBe(true);
    });

    it("fails G_B1 when NII coverage < 0.95", () => {
      const r = runVehicleQualityGates({
        vehicleType: "us_bdc",
        subSector: "specialty_finance",
        dividendCutInLast5Years: false,
        regularDividendCutInLast5Years: false,
        ttmNiiPerShare: 0.90,
        ttmRegularDps: 1.0,
      });
      expect(r.failedGates).toContain("G_B1");
    });

    it("fails G_B2 on regular distribution cut", () => {
      const r = runVehicleQualityGates({
        vehicleType: "us_bdc",
        subSector: "specialty_finance",
        dividendCutInLast5Years: true,
        regularDividendCutInLast5Years: true,
        ttmNiiPerShare: 1.0,
        ttmRegularDps: 1.0,
      });
      expect(r.failedGates).toContain("G_B2");
    });
  });

  describe("uk_reit", () => {
    it("passes when LTV ≤ 50% (default cap) and no cut", () => {
      const r = runVehicleQualityGates({
        vehicleType: "uk_reit",
        subSector: "diversified",
        dividendCutInLast5Years: false,
        totalDebt: 400,
        totalAssets: 1000,
      });
      expect(r.passed).toBe(true);
    });

    it("fails G_U1 when default LTV > 50%", () => {
      const r = runVehicleQualityGates({
        vehicleType: "uk_reit",
        subSector: "diversified",
        dividendCutInLast5Years: false,
        totalDebt: 550,
        totalAssets: 1000,
      });
      expect(r.failedGates).toContain("G_U1");
    });

    it("allows industrial REIT up to 40% LTV (tighter cap)", () => {
      const ok = runVehicleQualityGates({
        vehicleType: "uk_reit",
        subSector: "industrial",
        dividendCutInLast5Years: false,
        totalDebt: 350,
        totalAssets: 1000,
      });
      expect(ok.passed).toBe(true);
      const fail = runVehicleQualityGates({
        vehicleType: "uk_reit",
        subSector: "industrial",
        dividendCutInLast5Years: false,
        totalDebt: 450,
        totalAssets: 1000,
      });
      expect(fail.failedGates).toContain("G_U1");
    });

    it("allows healthcare REIT up to 60% LTV (loosest cap)", () => {
      const ok = runVehicleQualityGates({
        vehicleType: "uk_reit",
        subSector: "healthcare",
        dividendCutInLast5Years: false,
        totalDebt: 550,
        totalAssets: 1000,
      });
      expect(ok.passed).toBe(true);
      const fail = runVehicleQualityGates({
        vehicleType: "uk_reit",
        subSector: "healthcare",
        dividendCutInLast5Years: false,
        totalDebt: 650,
        totalAssets: 1000,
      });
      expect(fail.failedGates).toContain("G_U1");
    });

    it("allows social housing REIT up to 60% LTV", () => {
      const r = runVehicleQualityGates({
        vehicleType: "uk_reit",
        subSector: "social housing",
        dividendCutInLast5Years: false,
        totalDebt: 580,
        totalAssets: 1000,
      });
      expect(r.passed).toBe(true);
    });

    it("fails G_U2 on dividend cut", () => {
      const r = runVehicleQualityGates({
        vehicleType: "uk_reit",
        subSector: "diversified",
        dividendCutInLast5Years: true,
        totalDebt: 400,
        totalAssets: 1000,
      });
      expect(r.failedGates).toContain("G_U2");
    });
  });
});
