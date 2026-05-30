import { describe, it, expect } from "vitest";
import { chipColor, actionHint, trendArrow, formatDelta } from "../chip-display";

describe("chipColor", () => {
  it("buy tiers", () => {
    expect(chipColor("buy", 80).hex).toBe("#0a8a4f");
    expect(chipColor("buy", 60).hex).toBe("#56b87b");
    expect(chipColor("buy", 40).hex).toBe("#94a3b8");
  });
  it("risk tiers use the red ramp", () => {
    expect(chipColor("risk", 80).hex).toBe("#dc2626");
    expect(chipColor("risk", 60).hex).toBe("#f87171");
    expect(chipColor("risk", 10).hex).toBe("#94a3b8");
  });
  it("trim tiers use the amber ramp", () => {
    expect(chipColor("trim", 75).hex).toBe("#d97706");
    expect(chipColor("trim", 50).hex).toBe("#fbbf24");
    expect(chipColor("trim", 49).hex).toBe("#94a3b8");
  });
});

describe("actionHint", () => {
  it("risk dominates", () => {
    expect(actionHint({ buy: 90, trim: 90, risk: 80 })).toBe("Review urgently");
    expect(actionHint({ buy: 90, trim: 10, risk: 55 })).toBe("Reassess thesis");
  });
  it("then trim", () => {
    expect(actionHint({ buy: 10, trim: 80, risk: 10 })).toBe("Consider trimming");
    expect(actionHint({ buy: 10, trim: 55, risk: 10 })).toBe("Watch: extended");
  });
  it("high Quality score alone returns Hold — quality is a descriptor, not an action", () => {
    expect(actionHint({ buy: 80, trim: 10, risk: 10 })).toBe("Hold");
    expect(actionHint({ buy: 55, trim: 10, risk: 10 })).toBe("Hold");
    expect(actionHint({ buy: 10, trim: 10, risk: 10 })).toBe("Hold");
  });
  it("null buy (gate fail) with low risk/trim also returns Hold", () => {
    expect(actionHint({ buy: null, trim: 10, risk: 10 })).toBe("Hold");
  });
  it("null buy (gate fail) with elevated risk/trim still surfaces the actionable hint", () => {
    expect(actionHint({ buy: null, trim: 88, risk: 60 })).toBe("Reassess thesis");
  });
});

describe("trendArrow", () => {
  it("buckets at +/-5", () => {
    expect(trendArrow(6)).toBe("↗");
    expect(trendArrow(5)).toBe("↗");
    expect(trendArrow(4)).toBe("→");
    expect(trendArrow(0)).toBe("→");
    expect(trendArrow(-4)).toBe("→");
    expect(trendArrow(-5)).toBe("↘");
    expect(trendArrow(-6)).toBe("↘");
  });
});

describe("formatDelta", () => {
  it("returns null when there is no prior measurement", () => {
    expect(formatDelta(40, null)).toBeNull();
  });
  it("formats a positive delta", () => {
    expect(formatDelta(78, 66)).toEqual({ value: 12, label: "+12", arrow: "↗" });
  });
  it("formats a negative delta", () => {
    expect(formatDelta(54, 57)).toEqual({ value: -3, label: "-3", arrow: "→" });
  });
});
