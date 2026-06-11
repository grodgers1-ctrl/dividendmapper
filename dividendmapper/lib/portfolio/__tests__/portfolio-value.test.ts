import { describe, it, expect } from "vitest";
import { aggregatePortfolioValue } from "@/lib/portfolio/portfolio-value";
import type { TickerPrice } from "@/lib/portfolio/row-value";

const h = (ticker: string, quantity: number) => ({ ticker, quantity });

describe("aggregatePortfolioValue", () => {
  it("totals value per currency, sorted desc", () => {
    const prices: Record<string, TickerPrice> = {
      MSFT: { price: 400, currency: "USD" }, // 10 -> 4000
      AAPL: { price: 200, currency: "USD" }, // 5 -> 1000
      "W7L.L": { price: 4.5, currency: "GBP" }, // 390 -> 1755
    };
    const out = aggregatePortfolioValue(
      [h("MSFT", 10), h("AAPL", 5), h("W7L.L", 390)],
      prices,
    );
    expect(out.totalsByCurrency).toEqual([
      { currency: "USD", total: 5000 },
      { currency: "GBP", total: 1755 },
    ]);
  });

  it("skips holdings with no price", () => {
    const out = aggregatePortfolioValue(
      [h("MSFT", 10), h("NEW", 99)],
      { MSFT: { price: 100, currency: "USD" } },
    );
    expect(out.totalsByCurrency).toEqual([{ currency: "USD", total: 1000 }]);
  });

  it("returns an empty array when nothing is priced", () => {
    expect(aggregatePortfolioValue([h("NEW", 1)], {}).totalsByCurrency).toEqual([]);
  });
});
