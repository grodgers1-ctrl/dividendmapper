import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "@/lib/portfolio/map-concurrent";

describe("mapWithConcurrency", () => {
  it("preserves input order in the results", async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40]);
  });

  it("never runs more than `limit` tasks at once", async () => {
    let active = 0;
    let max = 0;
    await mapWithConcurrency([...Array(12).keys()], 4, async () => {
      active += 1;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return null;
    });
    expect(max).toBeLessThanOrEqual(4);
    expect(max).toBeGreaterThan(1); // actually ran concurrently
  });

  it("handles an empty list and a limit larger than the list", async () => {
    expect(await mapWithConcurrency([], 5, async (x) => x)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 10, async (n) => n)).toEqual([1, 2]);
  });
});
