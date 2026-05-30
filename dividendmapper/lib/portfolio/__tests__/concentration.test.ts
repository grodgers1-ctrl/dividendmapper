import { describe, it, expect } from "vitest";
import type { QuoteResult } from "@/lib/market/quote";
import { computeConcentration } from "../concentration";

// Minimal valid QuoteResult fixture with a known price.
function okQuote(price: number | null, currency = "GBP"): QuoteResult {
  return {
    ok: true,
    cached: false,
    data: {
      ticker: "X",
      source: "Polygon",
      price,
      dividend: null,
      dividendYield: null,
      dividendGrowth3yr: null,
      currency,
      exchange: null,
      name: null,
      fetchedAt: "2026-05-30T00:00:00Z",
    },
  };
}

function failQuote(): QuoteResult {
  return { ok: false, error: "ticker_not_found", status: 404 };
}

function buildQuotes(entries: [string, QuoteResult][]): Map<string, QuoteResult> {
  return new Map(entries);
}

// ────────────────────────────────────────────────────────────────────────────
describe("computeConcentration — basic weighting", () => {
  it("flags the overweight holding when one dominates (70/10/10/10 split)", () => {
    // 4 holdings priced so values are 70, 10, 10, 10 (e.g. qty=1 each, prices set directly)
    const holdings = [
      { ticker: "AAPL", quantity: 70 },
      { ticker: "SCHD", quantity: 10 },
      { ticker: "PEP", quantity: 10 },
      { ticker: "VYM", quantity: 10 },
    ];
    const quotes = buildQuotes([
      ["AAPL", okQuote(1)],
      ["SCHD", okQuote(1)],
      ["PEP", okQuote(1)],
      ["VYM", okQuote(1)],
    ]);

    const result = computeConcentration(holdings, quotes, 0.2);

    expect(result.totalGbp).toBeCloseTo(100, 6);
    expect(result.unpricedCount).toBe(0);
    expect(result.overweight).toHaveLength(1);
    expect(result.overweight[0].ticker).toBe("AAPL");
    expect(result.overweight[0].weight).toBeCloseTo(0.7, 6);
  });

  it("does not flag any holding in a perfectly even split below threshold (4 × 25% with 20% threshold)", () => {
    // Each at 25%, all above 20% — all four flagged
    const holdings = [
      { ticker: "A", quantity: 25 },
      { ticker: "B", quantity: 25 },
      { ticker: "C", quantity: 25 },
      { ticker: "D", quantity: 25 },
    ];
    const quotes = buildQuotes([
      ["A", okQuote(1)],
      ["B", okQuote(1)],
      ["C", okQuote(1)],
      ["D", okQuote(1)],
    ]);

    const result = computeConcentration(holdings, quotes, 0.2);
    // All four are 25%, which is > 20%
    expect(result.overweight).toHaveLength(4);
  });

  it("flags nothing when all holdings are at or below threshold (5 equal holdings at 20%)", () => {
    // 5 holdings × 20% each = exactly at threshold (not above) → none flagged
    const holdings = [
      { ticker: "A", quantity: 20 },
      { ticker: "B", quantity: 20 },
      { ticker: "C", quantity: 20 },
      { ticker: "D", quantity: 20 },
      { ticker: "E", quantity: 20 },
    ];
    const quotes = buildQuotes([
      ["A", okQuote(1)],
      ["B", okQuote(1)],
      ["C", okQuote(1)],
      ["D", okQuote(1)],
      ["E", okQuote(1)],
    ]);

    const result = computeConcentration(holdings, quotes, 0.2);
    // Exactly at threshold is NOT overweight (strictly >)
    expect(result.overweight).toHaveLength(0);
  });

  it("returns positions sorted descending by weight", () => {
    const holdings = [
      { ticker: "SMALL", quantity: 10 },
      { ticker: "BIG", quantity: 90 },
    ];
    const quotes = buildQuotes([
      ["SMALL", okQuote(1)],
      ["BIG", okQuote(1)],
    ]);

    const result = computeConcentration(holdings, quotes, 0.2);
    expect(result.positions[0].ticker).toBe("BIG");
    expect(result.positions[1].ticker).toBe("SMALL");
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("computeConcentration — missing / null prices", () => {
  it("excludes unpriced holdings from total and does not flag them; unpricedCount reflects them", () => {
    const holdings = [
      { ticker: "PRICED", quantity: 100 },
      { ticker: "UNPRICED", quantity: 9999 }, // huge position but no price
    ];
    const quotes = buildQuotes([
      ["PRICED", okQuote(1)],
      ["UNPRICED", okQuote(null)],
    ]);

    const result = computeConcentration(holdings, quotes, 0.2);

    expect(result.unpricedCount).toBe(1);
    expect(result.totalGbp).toBeCloseTo(100, 6);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].ticker).toBe("PRICED");
    // Sole priced holding is 100% → flagged at 20% threshold
    expect(result.overweight).toHaveLength(1);
    expect(result.overweight[0].ticker).toBe("PRICED");
    expect(result.overweight[0].weight).toBeCloseTo(1.0, 6);
  });

  it("excludes holdings with a failed quote (ok=false)", () => {
    const holdings = [
      { ticker: "GOOD", quantity: 50 },
      { ticker: "FAIL", quantity: 50 },
    ];
    const quotes = buildQuotes([
      ["GOOD", okQuote(1)],
      ["FAIL", failQuote()],
    ]);

    const result = computeConcentration(holdings, quotes, 0.2);

    expect(result.unpricedCount).toBe(1);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].ticker).toBe("GOOD");
    expect(result.positions[0].weight).toBeCloseTo(1.0, 6);
  });

  it("handles a holding with no quote entry at all in the map", () => {
    const holdings = [{ ticker: "MISSING", quantity: 10 }];
    const quotes = buildQuotes([]);

    const result = computeConcentration(holdings, quotes, 0.2);

    expect(result.totalGbp).toBe(0);
    expect(result.positions).toHaveLength(0);
    expect(result.overweight).toHaveLength(0);
    expect(result.unpricedCount).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("computeConcentration — same ticker across multiple wrappers", () => {
  it("sums quantities for the same ticker held in two wrappers", () => {
    // ULVR.L held in ISA (100 shares) and GIA (100 shares) = 200 total
    const holdings = [
      { ticker: "ULVR.L", quantity: 100 }, // ISA
      { ticker: "ULVR.L", quantity: 100 }, // GIA
      { ticker: "SCHD", quantity: 400 },
    ];
    const quotes = buildQuotes([
      ["ULVR.L", okQuote(1)],
      ["SCHD", okQuote(1)],
    ]);

    const result = computeConcentration(holdings, quotes, 0.2);

    // ULVR.L: 200/600 ≈ 33.3%, SCHD: 400/600 ≈ 66.7%
    expect(result.totalGbp).toBeCloseTo(600, 6);
    expect(result.positions).toHaveLength(2);

    const ulvr = result.positions.find((p) => p.ticker === "ULVR.L");
    expect(ulvr).toBeDefined();
    expect(ulvr!.valueGbp).toBeCloseTo(200, 6);
    expect(ulvr!.weight).toBeCloseTo(200 / 600, 6);

    const schd = result.positions.find((p) => p.ticker === "SCHD");
    expect(schd).toBeDefined();
    expect(schd!.weight).toBeCloseTo(400 / 600, 6);

    // Both above 20%; SCHD is the bigger one
    expect(result.overweight).toHaveLength(2);
    expect(result.overweight[0].ticker).toBe("SCHD");

    // unpricedCount is 0 — all three holding rows are priced
    expect(result.unpricedCount).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("computeConcentration — edge cases", () => {
  it("returns safe empty result for an empty holdings array", () => {
    const result = computeConcentration([], new Map(), 0.2);

    expect(result.totalGbp).toBe(0);
    expect(result.positions).toHaveLength(0);
    expect(result.overweight).toHaveLength(0);
    expect(result.unpricedCount).toBe(0);
    expect(result.threshold).toBe(0.2);
  });

  it("respects a custom threshold", () => {
    // Two holdings at 50% each; 50% threshold means neither is flagged (weight <= threshold)
    const holdings = [
      { ticker: "A", quantity: 50 },
      { ticker: "B", quantity: 50 },
    ];
    const quotes = buildQuotes([
      ["A", okQuote(1)],
      ["B", okQuote(1)],
    ]);

    const result50 = computeConcentration(holdings, quotes, 0.5);
    expect(result50.overweight).toHaveLength(0); // exactly at 50%, not strictly above

    const result49 = computeConcentration(holdings, quotes, 0.49);
    expect(result49.overweight).toHaveLength(2); // both 50% > 49%
  });

  it("handles string quantities correctly", () => {
    const holdings = [
      { ticker: "A", quantity: "70" as unknown as number },
      { ticker: "B", quantity: "30" as unknown as number },
    ];
    const quotes = buildQuotes([
      ["A", okQuote(1)],
      ["B", okQuote(1)],
    ]);

    const result = computeConcentration(holdings, quotes, 0.2);
    expect(result.totalGbp).toBeCloseTo(100, 6);
    expect(result.overweight[0].ticker).toBe("A");
    expect(result.overweight[0].weight).toBeCloseTo(0.7, 6);
  });
});
