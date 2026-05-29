import { describe, it, expect } from "vitest";
import { computeR7InsiderSelling } from "../r7-insider-selling";
import type { InsiderTrade } from "../c3-insider-buying";

const asOf = new Date("2026-05-29T00:00:00Z");
const daysAgo = (n: number) =>
  new Date(asOf.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const sale = (shares: number, price: number): InsiderTrade => ({
  transactionType: "S-Sale",
  securitiesTransacted: shares,
  price,
  date: daysAgo(5),
});

describe("computeR7InsiderSelling", () => {
  it("returns 0 for UK (.L) listings", () => {
    const r = computeR7InsiderSelling({
      symbol: "ULVR.L",
      trades: [sale(200_000, 50)],
      precedingRiskPoints: 30,
      asOf,
    });
    expect(r.points).toBe(0);
  });

  it("does not fire when no other risk signals are firing (gate)", () => {
    const r = computeR7InsiderSelling({
      symbol: "AAPL",
      trades: [sale(200_000, 50)],
      precedingRiskPoints: 0,
      asOf,
    });
    expect(r.points).toBe(0);
    expect(r.reason).toMatch(/gate/i);
  });

  it("fires 10 on >=$5M net selling when the gate is open", () => {
    const r = computeR7InsiderSelling({
      symbol: "AAPL",
      trades: [sale(200_000, 50)], // $10M
      precedingRiskPoints: 20,
      asOf,
    });
    expect(r.points).toBe(10);
  });

  it("fires 5 on $1-5M net selling when the gate is open", () => {
    const r = computeR7InsiderSelling({
      symbol: "AAPL",
      trades: [sale(40_000, 50)], // $2M
      precedingRiskPoints: 20,
      asOf,
    });
    expect(r.points).toBe(5);
  });

  it("returns 0 when there is no material net selling", () => {
    const r = computeR7InsiderSelling({
      symbol: "AAPL",
      trades: [
        { transactionType: "P-Purchase", securitiesTransacted: 200_000, price: 50, date: daysAgo(5) },
      ],
      precedingRiskPoints: 20,
      asOf,
    });
    expect(r.points).toBe(0);
  });
});
