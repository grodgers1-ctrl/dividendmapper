import { describe, it, expect } from "vitest";
import { computeR4EarningsRevisions } from "../r4-earnings-revisions";

const asOf = new Date("2026-05-29T00:00:00Z");
const daysAgo = (n: number) =>
  new Date(asOf.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("computeR4EarningsRevisions", () => {
  it("cold-starts (0 pts, sparse) when no 90-day-old history exists", () => {
    const r = computeR4EarningsRevisions({ currentEpsAvg: 9, pastEpsHistory: [], asOf });
    expect(r.points).toBe(0);
    expect(r.dataQualityFlag).toBe("sparse");
  });

  it("fires 15 on a steep (>=10%) downward revision", () => {
    const r = computeR4EarningsRevisions({
      currentEpsAvg: 8,
      pastEpsHistory: [{ date: daysAgo(100), eps_avg: 10 }],
      asOf,
    });
    expect(r.points).toBe(15);
  });

  it("fires 10 on a notable (5-10%) downward revision", () => {
    const r = computeR4EarningsRevisions({
      currentEpsAvg: 9.2,
      pastEpsHistory: [{ date: daysAgo(100), eps_avg: 10 }],
      asOf,
    });
    expect(r.points).toBe(10);
  });

  it("fires 5 on a mild (<5%) downward revision", () => {
    const r = computeR4EarningsRevisions({
      currentEpsAvg: 9.7,
      pastEpsHistory: [{ date: daysAgo(100), eps_avg: 10 }],
      asOf,
    });
    expect(r.points).toBe(5);
  });

  it("returns 0 when EPS is stable or improving", () => {
    const r = computeR4EarningsRevisions({
      currentEpsAvg: 11,
      pastEpsHistory: [{ date: daysAgo(100), eps_avg: 10 }],
      asOf,
    });
    expect(r.points).toBe(0);
  });
});
