import { describe, it, expect } from "vitest";
import { computeR2CoverageDeterioration, type QuarterlyCoverage } from "../r2-coverage-deterioration";

// Helper: build 6 quarters latest-first from chronological coverage values.
const fromChronologicalCoverages = (chronological: number[]): QuarterlyCoverage[] =>
  chronological
    .map((cov, i) => ({ quarter: `Q${i}`, fcf: cov, dividendsPaid: 1 }))
    .reverse(); // input expects latest first

describe("computeR2CoverageDeterioration", () => {
  it("fires 25 on a steep declining coverage trend", () => {
    const quarters = fromChronologicalCoverages([2.0, 1.8, 1.6, 1.4, 1.2, 1.0]);
    const r = computeR2CoverageDeterioration({ quarters });
    expect(r.points).toBe(25);
  });

  it("fires 15 on a mild declining coverage trend", () => {
    const quarters = fromChronologicalCoverages([2.0, 1.99, 1.98, 1.97, 1.96, 1.95]);
    const r = computeR2CoverageDeterioration({ quarters });
    expect(r.points).toBe(15);
  });

  it("returns 0 when coverage is stable or improving", () => {
    const quarters = fromChronologicalCoverages([1.0, 1.2, 1.4, 1.6, 1.8, 2.0]);
    const r = computeR2CoverageDeterioration({ quarters });
    expect(r.points).toBe(0);
  });

  it("returns 0 with insufficient quarterly history", () => {
    const quarters = fromChronologicalCoverages([1.5, 1.4, 1.3]);
    const r = computeR2CoverageDeterioration({ quarters });
    expect(r.points).toBe(0);
    expect(r.reason).toMatch(/insufficient/i);
  });
});
