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

  it("returns null when every scored holding has null Risk", () => {
    const scores = scoreMap([
      { ticker: "AAPL", buy: null, risk: null },
      { ticker: "MSFT", buy: 60, risk: null },
      { ticker: "TSCO.L", buy: 40, risk: null },
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

  it("surfaces a holding whose Quality is null when its Risk is highest", () => {
    // HTGC/SMIF.L scenario: real risk score, no Quality because of the BDC
    // quality-gate / UK C+D collapse. Previously excluded; must now win.
    const scores = scoreMap([
      { ticker: "AAPL", buy: 70, risk: 60 },
      { ticker: "HTGC", buy: null, risk: 100 },
    ]);
    const holdings = [{ ticker: "AAPL" }, { ticker: "HTGC" }];
    expect(pickFlaggedHolding(holdings, scores)).toBe("HTGC");
  });

  it("at tied Risk, a real (lower) Quality beats a null Quality", () => {
    const scores = scoreMap([
      { ticker: "AAPL", buy: 30, risk: 90 },
      { ticker: "HTGC", buy: null, risk: 90 },
    ]);
    const holdings = [{ ticker: "AAPL" }, { ticker: "HTGC" }];
    expect(pickFlaggedHolding(holdings, scores)).toBe("AAPL");
  });

  it("at tied Risk with both Qualities null, lower ticker alpha wins", () => {
    const scores = scoreMap([
      { ticker: "SMIF.L", buy: null, risk: 100 },
      { ticker: "HTGC", buy: null, risk: 100 },
    ]);
    // Holdings order intentionally reversed to confirm pick is order-independent.
    const holdings = [{ ticker: "SMIF.L" }, { ticker: "HTGC" }];
    expect(pickFlaggedHolding(holdings, scores)).toBe("HTGC");
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
