import { describe, it, expect } from "vitest";
import { computeTrimC1, computeTrimC2 } from "../trim-c-signals";

const asOf = new Date("2026-05-29T00:00:00Z");
const recentDate = (daysAgo: number) =>
  new Date(asOf.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

describe("computeTrimC1 (inverted C1)", () => {
  it("scores 100 when the median analyst target is well below price", () => {
    // target 30% below price → Buy C1 = 0 → Trim = 100
    expect(computeTrimC1({ currentPrice: 100, targetMedian: 70 }).score).toBe(100);
  });

  it("passes through N/A when no consensus target exists", () => {
    expect(computeTrimC1({ currentPrice: 100, targetMedian: null }).score).toBeNull();
  });
});

describe("computeTrimC2 (inverted C2)", () => {
  it("scores 100 on net downgrades", () => {
    const events = Array.from({ length: 5 }, () => ({ action: "Downgrade", date: recentDate(5) }));
    expect(computeTrimC2({ events, asOf }).score).toBe(100);
  });

  it("passes through N/A when analyst coverage is thin (<3 events)", () => {
    const events = [{ action: "Downgrade", date: recentDate(5) }];
    expect(computeTrimC2({ events, asOf }).score).toBeNull();
  });
});
