import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pickLeverageHeadline,
  buildVehicleUniverseDisplayRow,
} from "../vehicle-universe-display";
import type {
  VehicleScoreResult,
  SignalContribution,
} from "../compute-vehicle-score";

function signal(code: string, humanLabel: string): SignalContribution {
  return { code, humanLabel, rawScore: 50, weight: 1, contribution: 50 };
}

function scoreResult(overrides: Partial<VehicleScoreResult>): VehicleScoreResult {
  return {
    ticker: "X",
    vehicleType: "us_reit",
    resilienceScore: 75,
    qualityGatePassed: true,
    failedGates: [],
    signals: [],
    dataQuality: "full",
    priceNavRatio: null,
    ...overrides,
  };
}

describe("pickLeverageHeadline", () => {
  it("returns the Q_R1 (FFO payout) label for US REITs", () => {
    const r = scoreResult({
      vehicleType: "us_reit",
      signals: [signal("Q_R1", "FFO payout 81%"), signal("Q_S1", "12 consecutive years of growth")],
    });
    expect(pickLeverageHeadline(r)).toBe("FFO payout 81%");
  });

  it("returns the Q_B1 (NII coverage) label for US BDCs", () => {
    const r = scoreResult({
      vehicleType: "us_bdc",
      signals: [signal("Q_B1", "NII covers regular dividend 1.05×")],
    });
    expect(pickLeverageHeadline(r)).toBe("NII covers regular dividend 1.05×");
  });

  it("returns the Q_U2 (LTV) label for UK REITs", () => {
    const r = scoreResult({
      vehicleType: "uk_reit",
      signals: [signal("Q_U2", "LTV 33.0%")],
    });
    expect(pickLeverageHeadline(r)).toBe("LTV 33.0%");
  });

  it("returns null when the headline signal is missing from the result", () => {
    const r = scoreResult({
      vehicleType: "us_reit",
      signals: [signal("Q_S1", "12 consecutive years of growth")],
    });
    expect(pickLeverageHeadline(r)).toBeNull();
  });
});

describe("buildVehicleUniverseDisplayRow", () => {
  beforeEach(() => vi.resetModules());

  it("composes the upsert row from score result + FMP yield", async () => {
    const fetchYield = vi.fn(async () => 0.0562);
    const row = await buildVehicleUniverseDisplayRow(
      scoreResult({
        ticker: "O",
        vehicleType: "us_reit",
        signals: [signal("Q_R1", "FFO payout 81%")],
      }),
      fetchYield,
    );
    expect(row).toEqual({
      ticker: "O",
      dividend_yield: 0.0562,
      leverage_headline: "FFO payout 81%",
    });
    expect(fetchYield).toHaveBeenCalledWith("O");
  });

  it("tolerates a missing yield (null) and a missing headline", async () => {
    const fetchYield = vi.fn(async () => null);
    const row = await buildVehicleUniverseDisplayRow(
      scoreResult({ ticker: "BAD", vehicleType: "us_reit", signals: [] }),
      fetchYield,
    );
    expect(row).toEqual({
      ticker: "BAD",
      dividend_yield: null,
      leverage_headline: null,
    });
  });

  it("swallows fetchYield errors and stores null yield", async () => {
    const fetchYield = vi.fn(async () => {
      throw new Error("fmp down");
    });
    const row = await buildVehicleUniverseDisplayRow(
      scoreResult({
        ticker: "O",
        vehicleType: "us_reit",
        signals: [signal("Q_R1", "FFO payout 81%")],
      }),
      fetchYield,
    );
    expect(row.dividend_yield).toBeNull();
    expect(row.leverage_headline).toBe("FFO payout 81%");
  });
});
