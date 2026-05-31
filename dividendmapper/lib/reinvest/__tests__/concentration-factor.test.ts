import { describe, it, expect } from "vitest";
import { concentrationFactor } from "../concentration-factor";

describe("concentrationFactor", () => {
  it("gives the maximum bonus to a zero-weight (new/tiny) position", () => {
    expect(concentrationFactor(0, 0.2)).toBeCloseTo(1.15, 5);
  });
  it("is neutral exactly at the threshold", () => {
    expect(concentrationFactor(0.2, 0.2)).toBe(0.5);
  });
  it("interpolates linearly below the threshold", () => {
    expect(concentrationFactor(0.1, 0.2)).toBeCloseTo(1.075, 5); // halfway → 1.075
  });
  it("applies a hard penalty at/over the threshold", () => {
    expect(concentrationFactor(0.25, 0.2)).toBe(0.5);
    expect(concentrationFactor(0.5, 0.2)).toBe(0.5);
  });
  it("clamps a negative or absurd weight to the bonus ceiling", () => {
    expect(concentrationFactor(-0.1, 0.2)).toBeCloseTo(1.15, 5);
  });
});
