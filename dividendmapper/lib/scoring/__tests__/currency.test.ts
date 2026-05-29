import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
});

describe("normalizePriceToGbp", () => {
  it("returns USD price * USDGBP", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ rates: { GBP: 0.79 } }), { status: 200 }),
    );
    const { normalizePriceToGbp, __clearFxCacheForTest } = await import("../currency");
    __clearFxCacheForTest();
    const result = await normalizePriceToGbp(100, "USD");
    expect(result).toBeCloseTo(79, 2);
  });

  it("returns GBP price unchanged", async () => {
    const { normalizePriceToGbp } = await import("../currency");
    const result = await normalizePriceToGbp(100, "GBP");
    expect(result).toBe(100);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("converts GBp / GBX to GBP by dividing by 100", async () => {
    const { normalizePriceToGbp } = await import("../currency");
    expect(await normalizePriceToGbp(4265.5, "GBp")).toBeCloseTo(42.655, 3);
    expect(await normalizePriceToGbp(4265.5, "GBX")).toBeCloseTo(42.655, 3);
  });

  it("caches FX rates within a run", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ rates: { GBP: 0.79 } }), { status: 200 }),
    );
    const { normalizePriceToGbp, __clearFxCacheForTest } = await import("../currency");
    __clearFxCacheForTest();
    await normalizePriceToGbp(100, "USD");
    await normalizePriceToGbp(200, "USD");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws on unknown currency", async () => {
    const { normalizePriceToGbp } = await import("../currency");
    await expect(normalizePriceToGbp(100, "XYZ")).rejects.toThrow(/unsupported currency/i);
  });
});
