import { describe, it, expect } from "vitest";
import { buildQuadrant, QUADRANT_LABEL } from "../quadrant";
import type { HoldingScore } from "../portfolio-scores";

function score(partial: Partial<HoldingScore> & { ticker: string }): HoldingScore {
  return {
    ticker: partial.ticker,
    buy: partial.buy ?? null,
    trim: partial.trim ?? null,
    risk: partial.risk ?? null,
    buyFailedGates: partial.buyFailedGates ?? [],
    buyGateReason: partial.buyGateReason ?? null,
    dataQuality: partial.dataQuality ?? "sparse",
    deltas: { buy: null, trim: null, risk: null },
    hidden: { buy: false, trim: false, risk: false },
    actionHint: partial.actionHint ?? "",
  };
}

// buildQuadrant(tickers, scoresByTicker, weightByTicker). `tickers` is the full
// distinct holdings list so a ticker with NO score row (e.g. just-added BOWL.L)
// is surfaced as "Collecting…" rather than silently dropped.
function mapOf(...s: HoldingScore[]): Record<string, HoldingScore> {
  return Object.fromEntries(s.map((x) => [x.ticker, x]));
}

describe("buildQuadrant", () => {
  it("classifies a high-quality / low-risk holding as core", () => {
    const pep = score({ ticker: "PEP", buy: 78, risk: 40, trim: 22 });
    const { points } = buildQuadrant(["PEP"], mapOf(pep), { PEP: 0.1 });
    expect(points).toHaveLength(1);
    expect(points[0].quadrant).toBe("core");
    expect(points[0].x).toBe(40); // risk
    expect(points[0].y).toBe(78); // quality
  });

  it("classifies the other three quadrants", () => {
    const scores = [
      score({ ticker: "WATCH", buy: 80, risk: 70, trim: 10 }),
      score({ ticker: "STABL", buy: 30, risk: 20, trim: 10 }),
      score({ ticker: "REVEW", buy: 20, risk: 90, trim: 10 }),
    ];
    const { points } = buildQuadrant(
      ["WATCH", "STABL", "REVEW"],
      mapOf(...scores),
      {},
    );
    const byTicker = Object.fromEntries(points.map((p) => [p.ticker, p.quadrant]));
    expect(byTicker.WATCH).toBe("watch");
    expect(byTicker.STABL).toBe("stable");
    expect(byTicker.REVEW).toBe("review");
  });

  it("excludes gate-failers with their Risk, Trim and reason", () => {
    const pep = score({ ticker: "PEP", buy: 78, risk: 40, trim: 22 });
    const schd = score({
      ticker: "SCHD",
      buy: null,
      risk: 60,
      trim: 88,
      buyGateReason: "ETF or fund, not company-scored",
    });
    const { points, excluded } = buildQuadrant(
      ["PEP", "SCHD"],
      mapOf(pep, schd),
      {},
    );
    expect(points.map((p) => p.ticker)).toEqual(["PEP"]);
    expect(excluded).toEqual([
      {
        ticker: "SCHD",
        risk: 60,
        trim: 88,
        reason: "ETF or fund, not company-scored",
        collecting: false,
      },
    ]);
  });

  it("marks a ticker with no score row as collecting (null risk/trim)", () => {
    const pep = score({ ticker: "PEP", buy: 78, risk: 40, trim: 22 });
    const { points, excluded } = buildQuadrant(
      ["PEP", "BOWL.L"],
      mapOf(pep),
      {},
    );
    expect(points.map((p) => p.ticker)).toEqual(["PEP"]);
    expect(excluded).toEqual([
      { ticker: "BOWL.L", risk: null, trim: null, reason: "Collecting…", collecting: true },
    ]);
  });

  it("sorts excluded by Risk descending, with collecting (no row) last", () => {
    const vod = score({ ticker: "VOD.L", buy: null, risk: 75, trim: 74, buyGateReason: "Dividend history irregular" });
    const lgen = score({ ticker: "LGEN.L", buy: null, risk: 20, trim: 85, buyGateReason: "Dividend not covered by cash flow" });
    const { excluded } = buildQuadrant(
      ["BOWL.L", "LGEN.L", "VOD.L"],
      mapOf(vod, lgen),
      {},
    );
    expect(excluded.map((e) => e.ticker)).toEqual(["VOD.L", "LGEN.L", "BOWL.L"]);
  });

  it("scales bubble area with weight (bigger weight => bigger radius)", () => {
    const big = score({ ticker: "BIG", buy: 50, risk: 50, trim: 0 });
    const sml = score({ ticker: "SML", buy: 50, risk: 50, trim: 0 });
    const { points } = buildQuadrant(
      ["BIG", "SML"],
      mapOf(big, sml),
      { BIG: 0.89, SML: 0.01 },
    );
    const bigP = points.find((p) => p.ticker === "BIG")!;
    const smlP = points.find((p) => p.ticker === "SML")!;
    expect(bigP.radius).toBeGreaterThan(smlP.radius);
  });

  it("flags elevated Trim for amber colouring", () => {
    const hot = score({ ticker: "HOT", buy: 60, risk: 30, trim: 75 });
    const cool = score({ ticker: "COOL", buy: 60, risk: 30, trim: 20 });
    const { points } = buildQuadrant(["HOT", "COOL"], mapOf(hot, cool), {});
    expect(points.find((p) => p.ticker === "HOT")!.trimElevated).toBe(true);
    expect(points.find((p) => p.ticker === "COOL")!.trimElevated).toBe(false);
  });

  it("returns empty arrays for no holdings", () => {
    expect(buildQuadrant([], {}, {})).toEqual({ points: [], excluded: [] });
  });

  it("exposes human labels for all four quadrants", () => {
    expect(QUADRANT_LABEL.core).toBe("Core");
    expect(QUADRANT_LABEL.watch).toBe("Watch");
    expect(QUADRANT_LABEL.stable).toBe("Stable");
    expect(QUADRANT_LABEL.review).toBe("Review");
  });
});
