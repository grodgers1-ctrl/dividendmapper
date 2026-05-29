import { describe, it, expect } from "vitest";
import { computeC3InsiderBuying, type InsiderTrade } from "../c3-insider-buying";

const asOf = new Date("2026-05-29T00:00:00Z");
const dateDaysAgo = (n: number) =>
  new Date(asOf.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const trade = (
  transactionType: string,
  securitiesTransacted: number,
  price: number,
  daysAgo = 5,
): InsiderTrade => ({
  transactionType,
  securitiesTransacted,
  price,
  date: dateDaysAgo(daysAgo),
});

describe("computeC3InsiderBuying", () => {
  it("returns N/A for .L tickers (US Form 4 only)", () => {
    const result = computeC3InsiderBuying({ symbol: "ULVR.L", trades: [], asOf });
    expect(result.score).toBeNull();
    expect(result.humanLabel).toMatch(/UK/i);
  });

  it("returns 100 on $5M+ net buying", () => {
    const result = computeC3InsiderBuying({
      symbol: "AAPL",
      trades: [trade("P-Purchase", 100_000, 50)],
      asOf,
    });
    expect(result.score).toBe(100);
  });

  it("returns 0 on $5M+ net selling", () => {
    const result = computeC3InsiderBuying({
      symbol: "AAPL",
      trades: [trade("S-Sale", 100_000, 50)],
      asOf,
    });
    expect(result.score).toBe(0);
  });

  it("returns 50 when there is no recent insider activity", () => {
    const result = computeC3InsiderBuying({ symbol: "AAPL", trades: [], asOf });
    expect(result.score).toBe(50);
  });

  it("excludes trades older than 90d (old buying does not score 100)", () => {
    const result = computeC3InsiderBuying({
      symbol: "AAPL",
      trades: [trade("P-Purchase", 100_000, 50, 200)],
      asOf,
    });
    expect(result.score).toBe(50);
  });
});
