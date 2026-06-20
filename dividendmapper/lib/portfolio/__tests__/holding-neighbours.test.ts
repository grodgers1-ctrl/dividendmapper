import { describe, it, expect } from "vitest";
import { holdingNeighbours } from "@/lib/portfolio/holding-neighbours";

describe("holdingNeighbours", () => {
  it("returns nulls when the ticker is the only holding", () => {
    expect(holdingNeighbours(["AAPL"], "AAPL")).toEqual({
      prev: null,
      next: null,
      position: 1,
      total: 1,
    });
  });

  it("returns null when the ticker is not in the list", () => {
    expect(holdingNeighbours(["AAPL", "MSFT"], "VOD.L")).toBeNull();
  });

  it("returns alphabetical neighbours in the middle of the list", () => {
    const result = holdingNeighbours(["AAPL", "MSFT", "VOD.L"], "MSFT");
    expect(result).toEqual({
      prev: "AAPL",
      next: "VOD.L",
      position: 2,
      total: 3,
    });
  });

  it("wraps to the last ticker for prev at the start", () => {
    const result = holdingNeighbours(["AAPL", "MSFT", "VOD.L"], "AAPL");
    expect(result?.prev).toBe("VOD.L");
    expect(result?.next).toBe("MSFT");
  });

  it("wraps to the first ticker for next at the end", () => {
    const result = holdingNeighbours(["AAPL", "MSFT", "VOD.L"], "VOD.L");
    expect(result?.prev).toBe("MSFT");
    expect(result?.next).toBe("AAPL");
  });

  it("sorts incoming tickers alphabetically before picking neighbours", () => {
    const result = holdingNeighbours(["MSFT", "AAPL", "VOD.L"], "MSFT");
    expect(result).toEqual({
      prev: "AAPL",
      next: "VOD.L",
      position: 2,
      total: 3,
    });
  });

  it("deduplicates repeated tickers in the input", () => {
    const result = holdingNeighbours(["AAPL", "MSFT", "AAPL"], "AAPL");
    expect(result?.total).toBe(2);
    expect(result?.position).toBe(1);
  });
});
