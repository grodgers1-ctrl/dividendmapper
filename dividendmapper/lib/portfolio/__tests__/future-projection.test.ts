import { describe, it, expect } from "vitest";
import { projectionCagrForYear } from "../future-projection";

describe("projectionCagrForYear", () => {
  it("caps at +5% for year ≤ 3 when rawCagr is above the ceiling", () => {
    expect(projectionCagrForYear(0.20, 1)).toBeCloseTo(0.05, 5);
    expect(projectionCagrForYear(0.20, 2)).toBeCloseTo(0.05, 5);
    expect(projectionCagrForYear(0.20, 3)).toBeCloseTo(0.05, 5);
  });

  it("floors at 0% for year ≤ 3 when rawCagr is negative", () => {
    expect(projectionCagrForYear(-0.05, 1)).toBeCloseTo(0, 5);
    expect(projectionCagrForYear(-0.20, 3)).toBeCloseTo(0, 5);
  });

  it("returns the capped value unchanged when rawCagr is inside [0, 5%] for year ≤ 3", () => {
    expect(projectionCagrForYear(0.03, 1)).toBeCloseTo(0.03, 5);
    expect(projectionCagrForYear(0.025, 2)).toBeCloseTo(0.025, 5);
  });

  it("returns the long-run 2.5% for year ≥ 12", () => {
    expect(projectionCagrForYear(0.20, 12)).toBeCloseTo(0.025, 5);
    expect(projectionCagrForYear(0.20, 16)).toBeCloseTo(0.025, 5);
    expect(projectionCagrForYear(-0.10, 20)).toBeCloseTo(0.025, 5);
    expect(projectionCagrForYear(0.00, 25)).toBeCloseTo(0.025, 5);
  });

  it("linearly fades from capped to long-run across years 3→12", () => {
    expect(projectionCagrForYear(0.20, 4)).toBeCloseTo(0.05 * (8 / 9) + 0.025 * (1 / 9), 5);
    expect(projectionCagrForYear(0.20, 8)).toBeCloseTo(0.05 * (4 / 9) + 0.025 * (5 / 9), 5);
    expect(projectionCagrForYear(0.20, 11)).toBeCloseTo(0.05 * (1 / 9) + 0.025 * (8 / 9), 5);
  });

  it("treats year 0 as the same as year 1 (defensive)", () => {
    expect(projectionCagrForYear(0.10, 0)).toBeCloseTo(0.05, 5);
  });
});
