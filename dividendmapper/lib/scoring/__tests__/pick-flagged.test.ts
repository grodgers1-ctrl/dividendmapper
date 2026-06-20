import { describe, it, expect } from "vitest";
import {
  pickFlaggedHolding,
  type FlaggableScore,
} from "@/lib/scoring/pick-flagged";

function scoreMap(rows: FlaggableScore[]): Map<string, FlaggableScore> {
  return new Map(rows.map((r) => [r.ticker, r]));
}

describe("pickFlaggedHolding", () => {
  it("returns null when there are no holdings", () => {
    const scores = scoreMap([{ ticker: "AAPL", buy: 70, risk: 30 }]);
    expect(pickFlaggedHolding([], scores)).toBeNull();
  });

  it("returns null when no holding has a score", () => {
    const scores = scoreMap([{ ticker: "MSFT", buy: 70, risk: 30 }]);
    expect(pickFlaggedHolding([{ ticker: "AAPL" }], scores)).toBeNull();
  });

  it("returns null when every scored holding is DNQ", () => {
    const scores = scoreMap([
      { ticker: "AAPL", buy: null, risk: null },
      { ticker: "MSFT", buy: 60, risk: null },
      { ticker: "TSCO.L", buy: null, risk: 40 },
    ]);
    const holdings = [{ ticker: "AAPL" }, { ticker: "MSFT" }, { ticker: "TSCO.L" }];
    expect(pickFlaggedHolding(holdings, scores)).toBeNull();
  });

  it("picks the holding with the highest Risk score", () => {
    const scores = scoreMap([
      { ticker: "AAPL", buy: 70, risk: 30 },
      { ticker: "MSFT", buy: 70, risk: 55 },
      { ticker: "VOD.L", buy: 70, risk: 80 },
    ]);
    const holdings = [{ ticker: "AAPL" }, { ticker: "MSFT" }, { ticker: "VOD.L" }];
    expect(pickFlaggedHolding(holdings, scores)).toBe("VOD.L");
  });

  it("tiebreaks equal Risk by lowest Quality (buy)", () => {
    const scores = scoreMap([
      { ticker: "AAPL", buy: 80, risk: 70 },
      { ticker: "MSFT", buy: 40, risk: 70 },
      { ticker: "JNJ", buy: 60, risk: 70 },
    ]);
    const holdings = [{ ticker: "AAPL" }, { ticker: "MSFT" }, { ticker: "JNJ" }];
    expect(pickFlaggedHolding(holdings, scores)).toBe("MSFT");
  });

  it("excludes holdings the user doesn't hold even if scored", () => {
    const scores = scoreMap([
      { ticker: "AAPL", buy: 70, risk: 50 },
      { ticker: "VOD.L", buy: 40, risk: 90 },
    ]);
    const holdings = [{ ticker: "AAPL" }];
    expect(pickFlaggedHolding(holdings, scores)).toBe("AAPL");
  });

  it("excludes a holding whose Risk is null even if Quality exists", () => {
    const scores = scoreMap([
      { ticker: "AAPL", buy: 70, risk: 60 },
      { ticker: "SPRSE", buy: 30, risk: null },
    ]);
    const holdings = [{ ticker: "AAPL" }, { ticker: "SPRSE" }];
    expect(pickFlaggedHolding(holdings, scores)).toBe("AAPL");
  });

  it("excludes a holding whose Quality is null even if Risk exists", () => {
    const scores = scoreMap([
      { ticker: "AAPL", buy: 70, risk: 60 },
      { ticker: "SPRSE", buy: null, risk: 95 },
    ]);
    const holdings = [{ ticker: "AAPL" }, { ticker: "SPRSE" }];
    expect(pickFlaggedHolding(holdings, scores)).toBe("AAPL");
  });

  it("returns a deterministic pick when Risk and Quality are tied", () => {
    const scores = scoreMap([
      { ticker: "AAPL", buy: 50, risk: 50 },
      { ticker: "MSFT", buy: 50, risk: 50 },
    ]);
    const holdings = [{ ticker: "AAPL" }, { ticker: "MSFT" }];
    const pick1 = pickFlaggedHolding(holdings, scores);
    const pick2 = pickFlaggedHolding(holdings, scores);
    expect(pick1).toBe(pick2);
    expect(["AAPL", "MSFT"]).toContain(pick1);
  });
});
