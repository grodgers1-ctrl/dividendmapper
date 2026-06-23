import { describe, it, expect } from "vitest";
import {
  computeHoldingsPnl,
  type PnlHolding,
} from "@/lib/portfolio/holding-pnl";
import type { TickerPrice } from "@/lib/portfolio/row-value";

const holding = (over: Partial<PnlHolding> = {}): PnlHolding => ({
  ticker: "TEST",
  quantity: 10,
  avg_cost: 100,
  cost_currency: "GBP",
  ...over,
});

const price = (over: Partial<TickerPrice> = {}): TickerPrice => ({
  price: 110,
  currency: "GBP",
  ...over,
});

describe("computeHoldingsPnl", () => {
  it("returns an empty list when there are no holdings", () => {
    expect(computeHoldingsPnl([], {}, { GBP: 1 })).toEqual([]);
  });

  it("computes a same-currency GBP positive P/L", () => {
    const pnls = computeHoldingsPnl(
      [holding({ ticker: "VOD.L", quantity: 100, avg_cost: 80 })],
      { "VOD.L": price({ price: 100, currency: "GBP" }) },
      { GBP: 1 },
    );
    expect(pnls).toEqual([
      {
        ticker: "VOD.L",
        deltaGbp: 2000, // (100 - 80) × 100
        pctGbp: 0.25, // 20 / 80
        isCrossCurrency: false,
      },
    ]);
  });

  it("computes a same-currency GBP negative P/L", () => {
    const pnls = computeHoldingsPnl(
      [holding({ ticker: "DOWN.L", quantity: 50, avg_cost: 200 })],
      { "DOWN.L": price({ price: 150, currency: "GBP" }) },
      { GBP: 1 },
    );
    expect(pnls).toHaveLength(1);
    expect(pnls[0]).toMatchObject({
      ticker: "DOWN.L",
      isCrossCurrency: false,
    });
    expect(pnls[0].deltaGbp).toBeCloseTo(-2500, 6);
    expect(pnls[0].pctGbp).toBeCloseTo(-0.25, 6);
  });

  it("converts both cost and value to GBP when currencies differ", () => {
    // USD value, GBP cost. Cost = 100 GBP. Value = 200 USD × 0.8 = 160 GBP.
    // delta = +60 GBP, pct = 60 / 100 = +0.6.
    const pnls = computeHoldingsPnl(
      [
        holding({
          ticker: "MSFT",
          quantity: 1,
          avg_cost: 100,
          cost_currency: "GBP",
        }),
      ],
      { MSFT: price({ price: 200, currency: "USD" }) },
      { GBP: 1, USD: 0.8 },
    );
    expect(pnls).toHaveLength(1);
    expect(pnls[0].ticker).toBe("MSFT");
    expect(pnls[0].deltaGbp).toBeCloseTo(60, 6);
    expect(pnls[0].pctGbp).toBeCloseTo(0.6, 6);
    expect(pnls[0].isCrossCurrency).toBe(true);
  });

  it("skips holdings with no priced ticker", () => {
    const pnls = computeHoldingsPnl(
      [
        holding({ ticker: "PRICED.L" }),
        holding({ ticker: "MISSING.L" }),
      ],
      { "PRICED.L": price({ price: 120, currency: "GBP" }) },
      { GBP: 1 },
    );
    expect(pnls.map((p) => p.ticker)).toEqual(["PRICED.L"]);
  });

  it("skips holdings with cost ≤ 0 (zero or negative avg_cost)", () => {
    const pnls = computeHoldingsPnl(
      [
        holding({ ticker: "GOOD.L", avg_cost: 100 }),
        holding({ ticker: "ZERO.L", avg_cost: 0 }),
        holding({ ticker: "NEG.L", avg_cost: -1 }),
      ],
      {
        "GOOD.L": price({ price: 110, currency: "GBP" }),
        "ZERO.L": price({ price: 110, currency: "GBP" }),
        "NEG.L": price({ price: 110, currency: "GBP" }),
      },
      { GBP: 1 },
    );
    expect(pnls.map((p) => p.ticker)).toEqual(["GOOD.L"]);
  });

  it("skips holdings whose cost-currency GBP rate is missing", () => {
    const pnls = computeHoldingsPnl(
      [
        holding({ ticker: "GOOD.L" }),
        holding({ ticker: "ZWL.HOLD", cost_currency: "ZWL" }),
      ],
      {
        "GOOD.L": price({ price: 110, currency: "GBP" }),
        "ZWL.HOLD": price({ price: 100, currency: "USD" }),
      },
      { GBP: 1, USD: 0.8 }, // no ZWL rate
    );
    expect(pnls.map((p) => p.ticker)).toEqual(["GOOD.L"]);
  });

  it("skips holdings whose value-currency GBP rate is missing", () => {
    const pnls = computeHoldingsPnl(
      [
        holding({ ticker: "GOOD.L" }),
        holding({ ticker: "EXOTIC", cost_currency: "GBP" }),
      ],
      {
        "GOOD.L": price({ price: 110, currency: "GBP" }),
        EXOTIC: price({ price: 50, currency: "ZWL" }),
      },
      { GBP: 1 }, // no ZWL rate
    );
    expect(pnls.map((p) => p.ticker)).toEqual(["GOOD.L"]);
  });

  it("skips holdings whose GBP rate is non-finite or non-positive", () => {
    const pnls = computeHoldingsPnl(
      [
        holding({ ticker: "GOOD.L" }),
        holding({ ticker: "BAD.L", cost_currency: "GBP" }),
        holding({ ticker: "NAN.L", cost_currency: "GBP" }),
      ],
      {
        "GOOD.L": price({ price: 110, currency: "GBP" }),
        "BAD.L": price({ price: 50, currency: "USD" }),
        "NAN.L": price({ price: 50, currency: "EUR" }),
      },
      { GBP: 1, USD: 0, EUR: Number.NaN },
    );
    expect(pnls.map((p) => p.ticker)).toEqual(["GOOD.L"]);
  });

  it("marks isCrossCurrency=false when cost and value share a currency", () => {
    const pnls = computeHoldingsPnl(
      [
        holding({ ticker: "AAPL", cost_currency: "USD", avg_cost: 100 }),
      ],
      { AAPL: price({ price: 150, currency: "USD" }) },
      { GBP: 1, USD: 0.8 },
    );
    expect(pnls[0].isCrossCurrency).toBe(false);
  });

  it("accepts string quantities (Numeric Supabase columns)", () => {
    const pnls = computeHoldingsPnl(
      [
        {
          ticker: "STR",
          quantity: "10" as unknown as number,
          avg_cost: 100,
          cost_currency: "GBP",
        },
      ],
      { STR: price({ price: 120, currency: "GBP" }) },
      { GBP: 1 },
    );
    expect(pnls[0].deltaGbp).toBeCloseTo(200, 6);
    expect(pnls[0].pctGbp).toBeCloseTo(0.2, 6);
  });

  it("aggregates multiple rows of the same ticker into one position", () => {
    // Two HYSD lots: one full (5 @ £100), one residual sliver (5 @ £120).
    // Without aggregation, the £120-cost sliver and the £100-cost lot
    // produce two pnl rows, with the higher-cost row appearing as 'worst'
    // even though the user holds one position. Per-ticker aggregation
    // collapses both into a single position-level P/L.
    const pnls = computeHoldingsPnl(
      [
        holding({ ticker: "HYSD", quantity: 5, avg_cost: 100 }),
        holding({ ticker: "HYSD", quantity: 5, avg_cost: 120 }),
      ],
      { HYSD: price({ price: 130, currency: "GBP" }) },
      { GBP: 1 },
    );
    expect(pnls).toHaveLength(1);
    expect(pnls[0].ticker).toBe("HYSD");
    // cost: 5×100 + 5×120 = 1100; value: 10×130 = 1300; delta = 200
    expect(pnls[0].deltaGbp).toBeCloseTo(200, 6);
    expect(pnls[0].pctGbp).toBeCloseTo(200 / 1100, 6);
  });

  it("aggregates rows even when cost currencies differ for the same ticker", () => {
    // GBP-cost lot + USD-cost lot of the same ticker (transferred holding).
    // GBP cost: 5 × 100 × 1 = £500. USD cost: 5 × 130 × 0.8 = £520. Value:
    // 10 × 150 × 1 = £1500. delta = £480. Cross-currency true because any
    // row was cross-currency.
    const pnls = computeHoldingsPnl(
      [
        holding({ ticker: "MIX", quantity: 5, avg_cost: 100, cost_currency: "GBP" }),
        holding({ ticker: "MIX", quantity: 5, avg_cost: 130, cost_currency: "USD" }),
      ],
      { MIX: price({ price: 150, currency: "GBP" }) },
      { GBP: 1, USD: 0.8 },
    );
    expect(pnls).toHaveLength(1);
    expect(pnls[0].deltaGbp).toBeCloseTo(480, 6);
    expect(pnls[0].pctGbp).toBeCloseTo(480 / 1020, 6);
    expect(pnls[0].isCrossCurrency).toBe(true);
  });
});
