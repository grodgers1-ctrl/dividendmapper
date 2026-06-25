import { describe, it, expect } from "vitest";
import { aggregateIncomeByBand } from "../anchors-exposures";
import type { HoldingScore } from "@/lib/scoring/portfolio-scores";
import type { QuoteResult } from "@/lib/market/quote";

function score(buy: number | null, gates: string[] = []): HoldingScore {
  return {
    ticker: "X",
    buy,
    trim: null,
    risk: null,
    buyFailedGates: gates,
    buyGateReason: null,
    dataQuality: "sparse",
    deltas: { buy: null, trim: null, risk: null },
    hidden: { buy: false, trim: false, risk: false },
    actionHint: "Hold",
  };
}

const usd = { GBP: 1, USD: 0.8 };

function quote(dividend: number, currency: string): QuoteResult {
  return {
    ok: true,
    cached: false,
    data: {
      ticker: "TEST",
      source: "FMP",
      price: null,
      dividend,
      dividendYield: null,
      dividendGrowth3yr: null,
      currency,
      exchange: null,
      name: null,
      fetchedAt: "2026-06-25T00:00:00.000Z",
    },
  };
}

describe("aggregateIncomeByBand", () => {
  it("buckets vehicle income by Resilience band, equity income by Quality", () => {
    const holdings = [
      { ticker: "O", quantity: 100, wrapper: "isa" }, // vehicle, R=82 → anchor
      { ticker: "MAIN", quantity: 50, wrapper: "isa" }, // vehicle, R=60 → exposure
      { ticker: "BLND.L", quantity: 200, wrapper: "isa" }, // vehicle, R=40 → risk
      { ticker: "PEP", quantity: 25, wrapper: "isa" }, // equity, Q=80 → anchor
    ];
    const quotes: Record<string, QuoteResult> = {
      O: quote(3, "USD"),
      MAIN: quote(2.4, "USD"),
      "BLND.L": quote(0.2, "GBP"),
      PEP: quote(5, "USD"),
      // deliberately no rate for actuals fallback case below
    };
    const vehicleScoresByTicker = {
      O: { vehicleType: "us_reit" as const, resilienceScore: 82, qualityGatePassed: true },
      MAIN: { vehicleType: "us_bdc" as const, resilienceScore: 60, qualityGatePassed: true },
      "BLND.L": {
        vehicleType: "uk_reit" as const,
        resilienceScore: 40,
        qualityGatePassed: true,
      },
    };
    const scoresByTicker = { PEP: score(80) };

    const result = aggregateIncomeByBand({
      holdings,
      quotes,
      scoresByTicker,
      vehicleScoresByTicker,
      ratesToGbp: usd,
    });

    // anchor = O (100×3×0.8) + PEP (25×5×0.8) = 240 + 100 = 340
    expect(result.totalsGbp.anchor).toBeCloseTo(340, 4);
    // exposure = MAIN (50×2.4×0.8) = 96
    expect(result.totalsGbp.exposure).toBeCloseTo(96, 4);
    // risk = BLND.L (200×0.2×1) = 40
    expect(result.totalsGbp.risk).toBeCloseTo(40, 4);
    expect(result.totalsGbp.unscored).toBe(0);
    expect(result.countsByBand).toEqual({
      anchor: 2,
      exposure: 1,
      risk: 1,
      unscored: 0,
    });
    expect(result.totalGbp).toBeCloseTo(476, 4);
  });

  it("classifies a gate-failed vehicle as risk regardless of resilience", () => {
    const result = aggregateIncomeByBand({
      holdings: [{ ticker: "BAD", quantity: 100, wrapper: "isa" }],
      quotes: {
        BAD: quote(1, "GBP"),
      },
      scoresByTicker: {},
      vehicleScoresByTicker: {
        BAD: {
          vehicleType: "uk_reit",
          resilienceScore: 85,
          qualityGatePassed: false,
        },
      },
      ratesToGbp: usd,
    });
    expect(result.totalsGbp.risk).toBe(100);
    expect(result.totalsGbp.anchor).toBe(0);
  });

  it("counts unscored holdings but contributes zero to that band's GBP", () => {
    const result = aggregateIncomeByBand({
      holdings: [{ ticker: "UNKNOWN", quantity: 10, wrapper: "isa" }],
      quotes: {
        UNKNOWN: quote(1, "USD"),
      },
      scoresByTicker: {},
      vehicleScoresByTicker: {},
      ratesToGbp: usd,
    });
    expect(result.countsByBand.unscored).toBe(1);
    expect(result.totalsGbp.unscored).toBeCloseTo(8, 4); // 10×1×0.8
  });

  it("returns zeros for an empty holdings list", () => {
    const result = aggregateIncomeByBand({
      holdings: [],
      quotes: {},
      scoresByTicker: {},
      vehicleScoresByTicker: {},
      ratesToGbp: usd,
    });
    expect(result.totalGbp).toBe(0);
    expect(result.countsByBand).toEqual({
      anchor: 0,
      exposure: 0,
      risk: 0,
      unscored: 0,
    });
  });
});
