import { describe, it, expect } from "vitest";
import { computeA2PeVsHistory } from "../a2-pe-vs-history";

describe("computeA2PeVsHistory", () => {
  it("returns 100 when forward P/E is much lower than 5y avg", () => {
    const result = computeA2PeVsHistory({
      forwardPe: 10,
      peHistory: [20, 22, 18, 25, 21, 19, 23, 22, 20, 24, 21, 22],
    });
    expect(result.score).toBe(100);
  });

  it("returns 0 when forward P/E is much higher than 5y avg (2x+)", () => {
    const result = computeA2PeVsHistory({
      forwardPe: 50,
      peHistory: [20, 22, 18, 25, 21, 19, 23, 22, 20, 24, 21, 22],
    });
    expect(result.score).toBe(0);
  });

  it("returns ~50 at parity", () => {
    const history = Array.from({ length: 60 }, () => 20);
    const result = computeA2PeVsHistory({ forwardPe: 20, peHistory: history });
    expect(result.score).toBeGreaterThanOrEqual(45);
    expect(result.score).toBeLessThanOrEqual(55);
  });

  it("returns N/A when forwardPe <= 0 (negative EPS)", () => {
    const result = computeA2PeVsHistory({
      forwardPe: -5,
      peHistory: Array.from({ length: 60 }, () => 20),
    });
    expect(result.score).toBeNull();
  });

  it("returns N/A when peHistory has fewer than 12 entries", () => {
    const result = computeA2PeVsHistory({ forwardPe: 20, peHistory: [20, 22] });
    expect(result.score).toBeNull();
  });
});
