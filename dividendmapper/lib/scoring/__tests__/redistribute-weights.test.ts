import { describe, it, expect } from "vitest";
import { redistributeWithinCategory, computeCategoryAggregate } from "../redistribute-weights";

describe("redistributeWithinCategory", () => {
  it("returns original weights when no signals are N/A", () => {
    const result = redistributeWithinCategory([
      { code: "A1", score: 80, weight: 0.5 },
      { code: "A2", score: 60, weight: 0.3 },
      { code: "A3", score: 40, weight: 0.2 },
    ]);
    expect(result).toEqual([
      { code: "A1", score: 80, effectiveWeight: 0.5 },
      { code: "A2", score: 60, effectiveWeight: 0.3 },
      { code: "A3", score: 40, effectiveWeight: 0.2 },
    ]);
  });

  it("redistributes one N/A signal's weight proportionally", () => {
    const result = redistributeWithinCategory([
      { code: "A1", score: 80, weight: 0.5 },
      { code: "A2", score: 60, weight: 0.3 },
      { code: "A3", score: null, weight: 0.2 },
    ]);
    // A3's 0.2 redistributes to A1 (5/8) and A2 (3/8)
    expect(result.find((r) => r.code === "A1")?.effectiveWeight).toBeCloseTo(0.625, 3);
    expect(result.find((r) => r.code === "A2")?.effectiveWeight).toBeCloseTo(0.375, 3);
    expect(result.find((r) => r.code === "A3")?.effectiveWeight).toBe(0);
  });

  it("returns null effectiveWeight array when ALL signals are N/A", () => {
    const result = redistributeWithinCategory([
      { code: "A1", score: null, weight: 0.5 },
      { code: "A2", score: null, weight: 0.3 },
    ]);
    expect(result.every((r) => r.effectiveWeight === 0)).toBe(true);
  });
});

describe("computeCategoryAggregate", () => {
  it("returns weighted average of available scores", () => {
    const result = computeCategoryAggregate([
      { code: "A1", score: 80, weight: 0.5 },
      { code: "A2", score: 60, weight: 0.3 },
      { code: "A3", score: 40, weight: 0.2 },
    ]);
    expect(result?.value).toBeCloseTo(80 * 0.5 + 60 * 0.3 + 40 * 0.2, 1);
  });

  it("returns null when all signals are N/A", () => {
    const result = computeCategoryAggregate([
      { code: "A1", score: null, weight: 0.5 },
      { code: "A2", score: null, weight: 0.3 },
    ]);
    expect(result).toBeNull();
  });

  it("redistributes within the category and returns aggregate", () => {
    const result = computeCategoryAggregate([
      { code: "A1", score: 80, weight: 0.5 },
      { code: "A2", score: 60, weight: 0.3 },
      { code: "A3", score: null, weight: 0.2 },
    ]);
    // (80 * 0.625 + 60 * 0.375) = 50 + 22.5 = 72.5
    expect(result?.value).toBeCloseTo(72.5, 1);
  });
});
