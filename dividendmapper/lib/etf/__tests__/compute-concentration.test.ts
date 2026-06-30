import { describe, it, expect } from "vitest";
import { computeConcentration } from "../compute-concentration";

describe("computeConcentration", () => {
  it("aggregates depth-1 underlying value across multiple ETFs", () => {
    const result = computeConcentration([
      {
        ticker: "VWRL.L",
        positionValue: 8160,
        holdings: [
          { holding_symbol: "NVDA", weight_pct: 4.7, holding_name: "NVIDIA Corp" },
          { holding_symbol: "AAPL", weight_pct: 4.3, holding_name: "Apple Inc" },
        ],
      },
      {
        ticker: "IWDA.L",
        positionValue: 4000,
        holdings: [
          { holding_symbol: "NVDA", weight_pct: 5.2, holding_name: "NVIDIA Corp" },
          { holding_symbol: "MSFT", weight_pct: 3.5, holding_name: "Microsoft" },
        ],
      },
    ]);
    const nvda = result.find((r) => r.holding_symbol === "NVDA");
    expect(nvda?.value).toBeCloseTo(8160 * 0.047 + 4000 * 0.052, 2);
    expect(nvda?.viaCount).toBe(2);
    expect(nvda?.viaTickers).toEqual(expect.arrayContaining(["VWRL.L", "IWDA.L"]));
    expect(nvda?.name).toBe("NVIDIA Corp");
  });

  it("returns empty for empty input", () => {
    expect(computeConcentration([])).toEqual([]);
  });

  it("returns sorted by value descending", () => {
    const result = computeConcentration([
      {
        ticker: "VWRL.L",
        positionValue: 10000,
        holdings: [
          { holding_symbol: "AAPL", weight_pct: 1.0 },
          { holding_symbol: "MSFT", weight_pct: 3.0 },
          { holding_symbol: "NVDA", weight_pct: 2.0 },
        ],
      },
    ]);
    expect(result.map((r) => r.holding_symbol)).toEqual(["MSFT", "NVDA", "AAPL"]);
  });

  it("handles a single ETF with no holdings", () => {
    const result = computeConcentration([
      { ticker: "VGOV.L", positionValue: 5000, holdings: [] },
    ]);
    expect(result).toEqual([]);
  });

  it("keeps null holding name when no source provides one", () => {
    const result = computeConcentration([
      {
        ticker: "VWRL.L",
        positionValue: 1000,
        holdings: [{ holding_symbol: "XYZ", weight_pct: 1.0 }],
      },
    ]);
    expect(result[0]?.name).toBeNull();
  });
});
