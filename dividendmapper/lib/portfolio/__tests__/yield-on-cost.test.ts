import { describe, it, expect } from "vitest";
import { computeYieldOnCost } from "../yield-on-cost";

describe("computeYieldOnCost", () => {
  it("same-currency USD: returns (forwardAnnual / (qty * avgCost)) * 100", () => {
    // AAPL-style: $1.05/yr dividend × 15 shares = $15.75; cost 15 × $180.25 = $2,703.75
    const yoc = computeYieldOnCost({
      forwardAnnual: 15.75,
      forwardCurrency: "USD",
      quantity: 15,
      avgCost: 180.25,
      costCurrency: "USD",
    });
    expect(yoc).toBeCloseTo(0.5826, 3);
  });

  it("same-currency GBP: works for UK trusts that report dividends in £", () => {
    const yoc = computeYieldOnCost({
      forwardAnnual: 5.4,
      forwardCurrency: "GBP",
      quantity: 100,
      avgCost: 1.20,
      costCurrency: "GBP",
    });
    expect(yoc).toBeCloseTo(4.5, 3); // 5.4 / (100*1.20) * 100
  });

  it("GBp dividend with GBP cost: divides dividend by 100 before computing", () => {
    // ULVR.L: forwardAnnual 6376.80 (pence), qty 40, avgCost £42.10
    // Real dividend in £ is 63.768; cost 40 * 42.10 = £1684 → 3.7867%
    const yoc = computeYieldOnCost({
      forwardAnnual: 6376.80,
      forwardCurrency: "GBp",
      quantity: 40,
      avgCost: 42.10,
      costCurrency: "GBP",
    });
    expect(yoc).toBeCloseTo(3.787, 2);
  });

  it("GBX dividend with GBP cost: same as GBp", () => {
    const yoc = computeYieldOnCost({
      forwardAnnual: 100,
      forwardCurrency: "GBX",
      quantity: 10,
      avgCost: 5,
      costCurrency: "GBP",
    });
    expect(yoc).toBeCloseTo(2.0, 3); // £1 / £50 * 100
  });

  it("returns null when avgCost is zero or negative", () => {
    expect(
      computeYieldOnCost({
        forwardAnnual: 10,
        forwardCurrency: "USD",
        quantity: 5,
        avgCost: 0,
        costCurrency: "USD",
      }),
    ).toBeNull();
  });

  it("returns null when forwardAnnual is null", () => {
    expect(
      computeYieldOnCost({
        forwardAnnual: null,
        forwardCurrency: "USD",
        quantity: 5,
        avgCost: 10,
        costCurrency: "USD",
      }),
    ).toBeNull();
  });

  it("returns null for cross-currency cases we cannot resolve (USD div vs GBP cost)", () => {
    expect(
      computeYieldOnCost({
        forwardAnnual: 10,
        forwardCurrency: "USD",
        quantity: 5,
        avgCost: 10,
        costCurrency: "GBP",
      }),
    ).toBeNull();
  });

  it("returns null when forwardCurrency is null (we cannot confirm same-currency)", () => {
    expect(
      computeYieldOnCost({
        forwardAnnual: 10,
        forwardCurrency: null,
        quantity: 5,
        avgCost: 10,
        costCurrency: "USD",
      }),
    ).toBeNull();
  });
});
