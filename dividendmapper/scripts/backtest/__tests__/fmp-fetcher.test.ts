import { describe, it, expect, vi } from "vitest";
import { fetchTickerEndpoints, type EndpointSpec } from "../fmp-fetcher";

describe("fetchTickerEndpoints", () => {
  it("calls each endpoint sequentially with the configured pad", async () => {
    const callOrder: string[] = [];
    const startTimes: number[] = [];
    const t0 = Date.now();
    const httpGet = vi.fn(async (url: string) => {
      callOrder.push(url);
      startTimes.push(Date.now() - t0);
      return { url, data: [] };
    });

    const endpoints: EndpointSpec[] = [
      { name: "profile", url: "/stable/profile?symbol=AAPL" },
      { name: "dividends", url: "/stable/dividends?symbol=AAPL" },
      { name: "rsi", url: "/stable/technical-indicators/rsi?symbol=AAPL" },
    ];

    await fetchTickerEndpoints({ ticker: "AAPL", endpoints, httpGet, padMs: 100 });

    expect(callOrder).toEqual([
      "/stable/profile?symbol=AAPL",
      "/stable/dividends?symbol=AAPL",
      "/stable/technical-indicators/rsi?symbol=AAPL",
    ]);
    expect(startTimes[1]).toBeGreaterThanOrEqual(80); // pad >=80ms (allow CI jitter)
    expect(startTimes[2]).toBeGreaterThanOrEqual(180);
  });

  it("returns results keyed by endpoint name", async () => {
    const httpGet = vi.fn(async (url: string) => ({ url, payload: "x" }));
    const endpoints: EndpointSpec[] = [
      { name: "profile", url: "/p" },
      { name: "dividends", url: "/d" },
    ];

    const out = await fetchTickerEndpoints({ ticker: "X", endpoints, httpGet, padMs: 0 });

    expect(out).toEqual({
      profile: { url: "/p", payload: "x" },
      dividends: { url: "/d", payload: "x" },
    });
  });

  it("propagates per-endpoint failures with the endpoint name", async () => {
    const httpGet = vi.fn(async (url: string) => {
      if (url.includes("rsi")) throw new Error("HTTP 500");
      return { ok: true };
    });
    const endpoints: EndpointSpec[] = [
      { name: "profile", url: "/p" },
      { name: "rsi", url: "/rsi" },
    ];

    await expect(
      fetchTickerEndpoints({ ticker: "X", endpoints, httpGet, padMs: 0 })
    ).rejects.toThrow(/rsi.*HTTP 500/);
  });
});
