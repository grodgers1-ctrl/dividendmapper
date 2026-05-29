import { describe, it, expect, vi } from "vitest";
import { runWithConcurrency } from "../concurrency";

const defer = (ms: number, value: number) =>
  new Promise<number>((resolve) => setTimeout(() => resolve(value), ms));

describe("runWithConcurrency", () => {
  it("preserves result order regardless of completion order", async () => {
    const thunks = [
      () => defer(30, 0),
      () => defer(5, 1),
      () => defer(20, 2),
      () => defer(1, 3),
    ];
    const results = await runWithConcurrency(thunks, 2);
    expect(results).toEqual([0, 1, 2, 3]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const thunk = () => async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await defer(10, 0);
      inFlight--;
      return 0;
    };
    await runWithConcurrency(
      Array.from({ length: 12 }, () => thunk()),
      3,
    );
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it("rethrows the first error and stops scheduling new work", async () => {
    const after = vi.fn();
    const thunks = [
      () => Promise.reject(new Error("boom")),
      async () => {
        after();
        return 1;
      },
    ];
    // limit 1 → second thunk should never run once the first rejects
    await expect(runWithConcurrency(thunks, 1)).rejects.toThrow("boom");
    expect(after).not.toHaveBeenCalled();
  });

  it("handles an empty thunk list", async () => {
    expect(await runWithConcurrency([], 5)).toEqual([]);
  });
});
