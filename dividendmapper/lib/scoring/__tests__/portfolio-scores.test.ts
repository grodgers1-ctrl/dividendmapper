import { describe, it, expect } from "vitest";
import {
  buildHoldingScore,
  applyUserWeights,
  flaggedHoldings,
} from "../portfolio-scores";

const NOW = new Date("2026-05-30T12:00:00Z");
const future = new Date("2026-08-01T00:00:00Z").toISOString();
const past = new Date("2026-05-01T00:00:00Z").toISOString();

const passer = {
  ticker: "PEP",
  buy_score: 76,
  trim_score: 22,
  risk_score: 45,
  buy_failed_gates: [],
  data_quality: "sparse",
};

describe("buildHoldingScore", () => {
  it("builds numeric chips + action hint for a gate-passer", () => {
    const s = buildHoldingScore({ score: passer, priorHistory: null, overrides: [], now: NOW });
    expect(s.buy).toBe(76);
    expect(s.trim).toBe(22);
    expect(s.risk).toBe(45);
    expect(s.buyGateReason).toBeNull();
    expect(s.actionHint).toBe("Add more"); // buy>=75, risk<50, trim<50
  });

  it("sets buy null + gate reason for a gate-failer", () => {
    const s = buildHoldingScore({
      score: { ticker: "SCHD", buy_score: null, trim_score: 88, risk_score: 60, buy_failed_gates: ["GATE_4"], data_quality: "sparse" },
      priorHistory: null,
      overrides: [],
      now: NOW,
    });
    expect(s.buy).toBeNull();
    expect(s.buyGateReason).toBe("ETF or fund — not company-scored");
    expect(s.actionHint).toBe("Reassess thesis"); // risk 60
  });

  it("marks a score hidden when an override is active, ignores an expired one", () => {
    const s = buildHoldingScore({
      score: passer,
      priorHistory: null,
      overrides: [
        { score_type: "buy", expires_at: future },
        { score_type: "trim", expires_at: past },
      ],
      now: NOW,
    });
    expect(s.hidden.buy).toBe(true);
    expect(s.hidden.trim).toBe(false);
    expect(s.hidden.risk).toBe(false);
  });

  it("delta is null with no prior history and a signed delta with it", () => {
    const none = buildHoldingScore({ score: passer, priorHistory: null, overrides: [], now: NOW });
    expect(none.deltas.buy).toBeNull();
    const with30 = buildHoldingScore({
      score: passer,
      priorHistory: { buy_score: 64, trim_score: 22, risk_score: 50 },
      overrides: [],
      now: NOW,
    });
    expect(with30.deltas.buy).toEqual({ value: 12, label: "+12", arrow: "↗" });
    expect(with30.deltas.risk).toEqual({ value: -5, label: "-5", arrow: "↘" });
  });
});

describe("applyUserWeights", () => {
  it("is an identity stub until the Day 8 wizard ships", () => {
    const s = buildHoldingScore({ score: passer, priorHistory: null, overrides: [], now: NOW });
    expect(applyUserWeights(s, null)).toBe(s);
  });
});

describe("flaggedHoldings", () => {
  it("returns only non-Hold rows with their hint", () => {
    const hold = buildHoldingScore({
      score: { ticker: "AAA", buy_score: 10, trim_score: 10, risk_score: 10, buy_failed_gates: [], data_quality: "full" },
      priorHistory: null, overrides: [], now: NOW,
    });
    const addMore = buildHoldingScore({ score: passer, priorHistory: null, overrides: [], now: NOW });
    const flagged = flaggedHoldings([hold, addMore]);
    expect(flagged).toEqual([{ ticker: "PEP", hint: "Add more" }]);
  });
});
