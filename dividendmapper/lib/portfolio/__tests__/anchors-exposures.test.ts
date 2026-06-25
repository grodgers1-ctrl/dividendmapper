import { describe, it, expect } from "vitest";
import { aggregateIncomeByBand } from "../anchors-exposures";
import type { QuoteResult } from "@/lib/market/quote";

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
  it("buckets vehicle income by Resilience band and ignores non-vehicle holdings", () => {
    const holdings = [
      { ticker: "O", quantity: 100, wrapper: "isa" }, // vehicle, R=82 → anchor
      { ticker: "MAIN", quantity: 50, wrapper: "isa" }, // vehicle, R=60 → exposure
      { ticker: "BLND.L", quantity: 200, wrapper: "isa" }, // vehicle, R=40 → risk
      { ticker: "PEP", quantity: 25, wrapper: "isa" }, // equity, EXCLUDED
    ];
    const quotes: Record<string, QuoteResult> = {
      O: quote(3, "USD"),
      MAIN: quote(2.4, "USD"),
      "BLND.L": quote(0.2, "GBP"),
      PEP: quote(5, "USD"),
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

    const result = aggregateIncomeByBand({
      holdings,
      quotes,
      vehicleScoresByTicker,
      ratesToGbp: usd,
    });

    expect(result.totalsGbp.anchor).toBeCloseTo(240, 4);
    expect(result.totalsGbp.exposure).toBeCloseTo(96, 4);
    expect(result.totalsGbp.risk).toBeCloseTo(40, 4);
    expect(result.totalsGbp.unscored).toBe(0);
    expect(result.countsByBand).toEqual({
      anchor: 1,
      exposure: 1,
      risk: 1,
      unscored: 0,
    });
    expect(result.totalGbp).toBeCloseTo(376, 4);
    expect(result.inScopeCount).toBe(3);
    expect(result.excludedCount).toBe(1);
    expect(result.excludedGbp).toBeCloseTo(100, 4);
  });

  it("classifies a gate-failed vehicle as risk regardless of resilience", () => {
    const result = aggregateIncomeByBand({
      holdings: [{ ticker: "BAD", quantity: 100, wrapper: "isa" }],
      quotes: {
        BAD: quote(1, "GBP"),
      },
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
    expect(result.inScopeCount).toBe(1);
    expect(result.excludedCount).toBe(0);
  });

  it("counts a vehicle with null resilience as in-scope but unscored", () => {
    // Vehicle row exists (engine knows about it) but resilience not yet computed.
    const result = aggregateIncomeByBand({
      holdings: [{ ticker: "PENDING", quantity: 10, wrapper: "isa" }],
      quotes: {
        PENDING: quote(1, "USD"),
      },
      vehicleScoresByTicker: {
        PENDING: {
          vehicleType: "us_reit",
          resilienceScore: null,
          qualityGatePassed: true,
        },
      },
      ratesToGbp: usd,
    });
    expect(result.countsByBand.unscored).toBe(1);
    expect(result.totalsGbp.unscored).toBeCloseTo(8, 4);
    expect(result.inScopeCount).toBe(1);
    expect(result.excludedCount).toBe(0);
  });

  it("excludes a holding that has no vehicle record at all", () => {
    // Random equity the engine has never seen. The bug we're fixing.
    const result = aggregateIncomeByBand({
      holdings: [{ ticker: "UNKNOWN", quantity: 10, wrapper: "isa" }],
      quotes: {
        UNKNOWN: quote(1, "USD"),
      },
      vehicleScoresByTicker: {},
      ratesToGbp: usd,
    });
    expect(result.countsByBand).toEqual({
      anchor: 0,
      exposure: 0,
      risk: 0,
      unscored: 0,
    });
    expect(result.totalGbp).toBe(0);
    expect(result.inScopeCount).toBe(0);
    expect(result.excludedCount).toBe(1);
    expect(result.excludedGbp).toBeCloseTo(8, 4);
  });

  it("returns zeros for an empty holdings list", () => {
    const result = aggregateIncomeByBand({
      holdings: [],
      quotes: {},
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
    expect(result.inScopeCount).toBe(0);
    expect(result.excludedCount).toBe(0);
    expect(result.excludedGbp).toBe(0);
  });
});
