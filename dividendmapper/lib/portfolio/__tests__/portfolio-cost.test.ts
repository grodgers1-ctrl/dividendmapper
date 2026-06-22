import { describe, it, expect } from "vitest";
import {
  aggregatePortfolioCost,
  sumCostGbp,
  type CostHolding,
} from "@/lib/portfolio/portfolio-cost";

const holding = (over: Partial<CostHolding> = {}): CostHolding => ({
  quantity: 10,
  avg_cost: 100,
  cost_currency: "GBP",
  ...over,
});

describe("aggregatePortfolioCost", () => {
  it("returns an empty totals list when there are no holdings", () => {
    expect(aggregatePortfolioCost([])).toEqual({ totalsByCurrency: [] });
  });

  it("sums quantity × avg_cost into a single-currency bucket", () => {
    const out = aggregatePortfolioCost([
      holding({ quantity: 10, avg_cost: 50, cost_currency: "GBP" }),
      holding({ quantity: 5, avg_cost: 80, cost_currency: "GBP" }),
    ]);
    expect(out.totalsByCurrency).toEqual([{ currency: "GBP", total: 900 }]);
  });

  it("buckets per currency and sorts descending by total", () => {
    const out = aggregatePortfolioCost([
      holding({ quantity: 100, avg_cost: 1, cost_currency: "GBP" }), // £100
      holding({ quantity: 10, avg_cost: 50, cost_currency: "USD" }), // $500
      holding({ quantity: 1, avg_cost: 10, cost_currency: "EUR" }), // €10
    ]);
    expect(out.totalsByCurrency).toEqual([
      { currency: "USD", total: 500 },
      { currency: "GBP", total: 100 },
      { currency: "EUR", total: 10 },
    ]);
  });

  it("skips holdings with non-positive avg_cost", () => {
    const out = aggregatePortfolioCost([
      holding({ quantity: 10, avg_cost: 100, cost_currency: "GBP" }),
      holding({ quantity: 5, avg_cost: 0, cost_currency: "GBP" }),
      holding({ quantity: 5, avg_cost: -1, cost_currency: "GBP" }),
    ]);
    expect(out.totalsByCurrency).toEqual([{ currency: "GBP", total: 1000 }]);
  });

  it("skips holdings whose quantity × avg_cost is non-finite", () => {
    const out = aggregatePortfolioCost([
      holding({ quantity: 10, avg_cost: 100, cost_currency: "GBP" }),
      holding({ quantity: Number.POSITIVE_INFINITY, avg_cost: 1, cost_currency: "GBP" }),
      holding({ quantity: Number.NaN, avg_cost: 1, cost_currency: "GBP" }),
    ]);
    expect(out.totalsByCurrency).toEqual([{ currency: "GBP", total: 1000 }]);
  });
});

describe("sumCostGbp", () => {
  it("returns 0 for an empty totals list", () => {
    expect(sumCostGbp([], {})).toBe(0);
  });

  it("returns the GBP total unchanged when only currency is GBP", () => {
    expect(sumCostGbp([{ currency: "GBP", total: 900 }], { GBP: 1 })).toBe(900);
  });

  it("converts USD totals via the provided rate", () => {
    expect(sumCostGbp([{ currency: "USD", total: 1000 }], { USD: 0.78 })).toBe(780);
  });

  it("omits currencies missing from the rates map", () => {
    expect(
      sumCostGbp(
        [
          { currency: "GBP", total: 500 },
          { currency: "ZWL", total: 9999 },
        ],
        { GBP: 1 },
      ),
    ).toBe(500);
  });

  it("omits currencies with non-finite or non-positive rates", () => {
    expect(
      sumCostGbp(
        [
          { currency: "GBP", total: 500 },
          { currency: "USD", total: 1000 },
          { currency: "EUR", total: 200 },
        ],
        { GBP: 1, USD: Number.NaN, EUR: 0 },
      ),
    ).toBe(500);
  });
});
