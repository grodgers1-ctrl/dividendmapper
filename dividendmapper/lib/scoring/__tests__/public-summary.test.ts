import { describe, it, expect } from "vitest";
import { publicSummary, scoreBand } from "../public-summary";

// Forbidden anywhere in public copy: the reframe forbids verdict language.
const FORBIDDEN = /\b(buy|sell|recommend|recommended|target price|undervalued|overvalued)\b/i;

describe("scoreBand", () => {
  it("buckets >=75 as high, 50-74 as moderate, <50 as low", () => {
    expect(scoreBand(90)).toBe("high");
    expect(scoreBand(75)).toBe("high");
    expect(scoreBand(74)).toBe("moderate");
    expect(scoreBand(50)).toBe("moderate");
    expect(scoreBand(49)).toBe("low");
    expect(scoreBand(0)).toBe("low");
  });

  it("returns none for a null score (gate fail / not scored)", () => {
    expect(scoreBand(null)).toBe("none");
  });
});

describe("publicSummary bands", () => {
  it("maps each score to its band", () => {
    const { bands } = publicSummary({ buyScore: 80, trimScore: 30, riskScore: 60 });
    expect(bands).toEqual({ quality: "high", trim: "low", risk: "moderate" });
  });

  it("reports quality band none when the quality gate failed (buyScore null)", () => {
    const { bands } = publicSummary({ buyScore: null, trimScore: 40, riskScore: 20 });
    expect(bands.quality).toBe("none");
  });
});

describe("publicSummary headline", () => {
  it("never uses buy/sell/recommend or valuation-verdict words", () => {
    const cases = [
      { buyScore: 90, trimScore: 10, riskScore: 10 },
      { buyScore: 80, trimScore: 90, riskScore: 85 },
      { buyScore: null, trimScore: 60, riskScore: 80 },
      { buyScore: 40, trimScore: 50, riskScore: 55 },
      { buyScore: null, trimScore: null, riskScore: null },
    ];
    for (const c of cases) {
      expect(publicSummary(c).headline).not.toMatch(FORBIDDEN);
    }
  });

  it("ends as a single sentence", () => {
    const { headline } = publicSummary({ buyScore: 80, trimScore: 30, riskScore: 20 });
    expect(headline.endsWith(".")).toBe(true);
    // one sentence: no internal full stop before the end
    expect(headline.slice(0, -1)).not.toContain(".");
  });

  it("leads with cut risk when risk is high, regardless of quality", () => {
    const { headline } = publicSummary({ buyScore: 90, trimScore: 10, riskScore: 88 });
    expect(headline.toLowerCase()).toMatch(/^signals point to elevated dividend-cut risk/);
  });

  it("describes a durable, low-risk profile when quality is high and risk is low", () => {
    const { headline } = publicSummary({ buyScore: 85, trimScore: 20, riskScore: 15 });
    expect(headline.toLowerCase()).toContain("durable dividend profile");
    expect(headline.toLowerCase()).toContain("low");
    expect(headline.toLowerCase()).toContain("cut-risk");
  });

  it("uses a resilience-neutral line with no number when the gate failed", () => {
    const { headline } = publicSummary({ buyScore: null, trimScore: 30, riskScore: 20 });
    expect(headline.toLowerCase()).toContain("has not cleared");
    expect(headline.toLowerCase()).toContain("quality screen");
    expect(headline).not.toMatch(/\d/); // no score number leaked
  });

  it("adds an extended-valuation clause when trim is high and risk is not high", () => {
    const { headline } = publicSummary({ buyScore: 80, trimScore: 90, riskScore: 20 });
    expect(headline.toLowerCase()).toContain("richly valued");
  });

  it("omits the trim clause when trim is low", () => {
    const { headline } = publicSummary({ buyScore: 80, trimScore: 10, riskScore: 20 });
    expect(headline.toLowerCase()).not.toContain("richly valued");
    expect(headline.toLowerCase()).not.toContain("extended");
  });
});
