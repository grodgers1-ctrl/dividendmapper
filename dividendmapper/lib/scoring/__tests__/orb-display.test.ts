import { describe, it, expect } from "vitest";
import {
  arcLength,
  arcStrokeColor,
  arcGlowColor,
  formatScoreLabel,
  orbAriaLabel,
} from "../orb-display";

describe("arcLength", () => {
  it("maps 0-100 to 0-1", () => {
    expect(arcLength(0)).toBe(0);
    expect(arcLength(50)).toBe(0.5);
    expect(arcLength(100)).toBe(1);
  });
  it("clamps below 0 and above 100", () => {
    expect(arcLength(-10)).toBe(0);
    expect(arcLength(120)).toBe(1);
  });
  it("returns 0 for null/undefined", () => {
    expect(arcLength(null)).toBe(0);
    expect(arcLength(undefined as unknown as number)).toBe(0);
  });
});

describe("arcStrokeColor", () => {
  it("returns saturated type colour", () => {
    expect(arcStrokeColor("buy")).toBe("#10b981");
    expect(arcStrokeColor("trim")).toBe("#f59e0b");
    expect(arcStrokeColor("risk")).toBe("#ef4444");
  });
});

describe("arcGlowColor", () => {
  it("returns matching translucent glow per type", () => {
    expect(arcGlowColor("buy")).toBe("rgba(16, 185, 129, 0.45)");
    expect(arcGlowColor("trim")).toBe("rgba(245, 158, 11, 0.45)");
    expect(arcGlowColor("risk")).toBe("rgba(239, 68, 68, 0.45)");
  });
});

describe("formatScoreLabel", () => {
  it("rounds a number score to a string", () => {
    expect(formatScoreLabel(82)).toBe("82");
    expect(formatScoreLabel(0)).toBe("0");
    expect(formatScoreLabel(54.7)).toBe("55");
  });
  it("returns DNQ for null when a gate reason is provided", () => {
    expect(formatScoreLabel(null, "QUALITY_GATE")).toBe("DNQ");
  });
  it("returns em-dash for null without a gate reason", () => {
    expect(formatScoreLabel(null)).toBe("—");
    expect(formatScoreLabel(null, null)).toBe("—");
  });
});

describe("orbAriaLabel", () => {
  it("composes a screen-reader summary with all three scores", () => {
    expect(orbAriaLabel("AAPL", 82, 54, 28)).toBe(
      "AAPL: Quality 82, Trim 54, Risk 28",
    );
  });
  it("rounds non-integer scores", () => {
    expect(orbAriaLabel("MSFT", 82.4, 54.6, 28.1)).toBe(
      "MSFT: Quality 82, Trim 55, Risk 28",
    );
  });
  it("reads 'unavailable' for any null score", () => {
    expect(orbAriaLabel("XYZ", null, 25, 10)).toBe(
      "XYZ: Quality unavailable, Trim 25, Risk 10",
    );
    expect(orbAriaLabel("XYZ", 80, null, null)).toBe(
      "XYZ: Quality 80, Trim unavailable, Risk unavailable",
    );
  });
});
