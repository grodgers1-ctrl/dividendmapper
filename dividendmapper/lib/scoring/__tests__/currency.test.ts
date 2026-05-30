import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
});

// Helper: build a successful Frankfurter response for a given GBP rate.
function frankfurterResponse(rate: number): Response {
  return new Response(JSON.stringify({ rates: { GBP: rate } }), { status: 200 });
}

describe("normalizePriceToGbp", () => {
  it("returns USD price * USDGBP", async () => {
    fetchMock.mockResolvedValueOnce(frankfurterResponse(0.79));
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
    fetchMock.mockResolvedValueOnce(frankfurterResponse(0.79));
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

// ────────────────────────────────────────────────────────────────────────────
describe("ratesToGbpFor", () => {
  it("returns 1 for GBP without calling fetch", async () => {
    const { ratesToGbpFor, __clearFxCacheForTest } = await import("../currency");
    __clearFxCacheForTest();
    const rates = await ratesToGbpFor(["GBP"]);
    expect(rates["GBP"]).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 0.01 for GBX (pence) without calling fetch", async () => {
    const { ratesToGbpFor, __clearFxCacheForTest } = await import("../currency");
    __clearFxCacheForTest();
    const rates = await ratesToGbpFor(["GBX"]);
    expect(rates["GBX"]).toBe(0.01);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 0.01 for GBp (pence) without calling fetch", async () => {
    const { ratesToGbpFor, __clearFxCacheForTest } = await import("../currency");
    __clearFxCacheForTest();
    const rates = await ratesToGbpFor(["GBp"]);
    expect(rates["GBp"]).toBe(0.01);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches USD→GBP rate and returns it as the multiplier", async () => {
    fetchMock.mockResolvedValueOnce(frankfurterResponse(0.79));
    const { ratesToGbpFor, __clearFxCacheForTest } = await import("../currency");
    __clearFxCacheForTest();
    const rates = await ratesToGbpFor(["USD"]);
    expect(rates["USD"]).toBeCloseTo(0.79, 4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves multiple currencies in one call including GBP (no fetch) + USD (fetched)", async () => {
    fetchMock.mockResolvedValueOnce(frankfurterResponse(0.79));
    const { ratesToGbpFor, __clearFxCacheForTest } = await import("../currency");
    __clearFxCacheForTest();
    const rates = await ratesToGbpFor(["GBP", "USD", "GBX"]);
    expect(rates["GBP"]).toBe(1);
    expect(rates["GBX"]).toBe(0.01);
    expect(rates["USD"]).toBeCloseTo(0.79, 4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates currencies so the same currency is only fetched once", async () => {
    fetchMock.mockResolvedValueOnce(frankfurterResponse(0.79));
    const { ratesToGbpFor, __clearFxCacheForTest } = await import("../currency");
    __clearFxCacheForTest();
    const rates = await ratesToGbpFor(["USD", "USD", "USD"]);
    expect(rates["USD"]).toBeCloseTo(0.79, 4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("omits an unsupported currency from the result (does not throw)", async () => {
    const { ratesToGbpFor, __clearFxCacheForTest } = await import("../currency");
    __clearFxCacheForTest();
    const rates = await ratesToGbpFor(["GBP", "XYZ"]);
    expect(rates["GBP"]).toBe(1);
    expect("XYZ" in rates).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("omits a currency when the Frankfurter fetch fails (does not throw)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Bad Gateway", { status: 502 }));
    const { ratesToGbpFor, __clearFxCacheForTest } = await import("../currency");
    __clearFxCacheForTest();
    const rates = await ratesToGbpFor(["GBP", "USD"]);
    // GBP must still be present; USD fetch failed → omitted.
    expect(rates["GBP"]).toBe(1);
    expect("USD" in rates).toBe(false);
  });
});
