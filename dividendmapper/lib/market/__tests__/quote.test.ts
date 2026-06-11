import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

interface Routes {
  profile?: unknown;
  dividends?: unknown;
  polygonPrev?: { status?: number; body?: unknown };
  polygonDiv?: unknown;
  polygonRef?: unknown;
}

function route(routes: Routes) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes("/stable/profile"))
      return new Response(JSON.stringify(routes.profile ?? []), { status: 200 });
    if (url.includes("/stable/dividends"))
      return new Response(JSON.stringify(routes.dividends ?? []), { status: 200 });
    if (url.includes("api.polygon.io/v2/aggs"))
      return new Response(JSON.stringify(routes.polygonPrev?.body ?? { results: [] }), {
        status: routes.polygonPrev?.status ?? 200,
      });
    if (url.includes("api.polygon.io/v3/reference/dividends"))
      return new Response(JSON.stringify(routes.polygonDiv ?? { results: [] }), { status: 200 });
    if (url.includes("api.polygon.io/v3/reference/tickers"))
      return new Response(JSON.stringify(routes.polygonRef ?? { results: {} }), { status: 200 });
    if (url.includes("eodhd.com"))
      return new Response("Unauthorized", { status: 401 });
    return new Response("[]", { status: 200 });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  process.env.FMP_API_KEY = "test-fmp";
  process.env.POLYGON_API_KEY = "test-poly";
  process.env.EODHD_API_KEY = "test-eod";
});
afterEach(() => vi.resetModules());

describe("fetchQuote — FMP primary", () => {
  it("returns an FMP quote for a US ticker (price + TTM dividend + name)", async () => {
    route({
      profile: [{ symbol: "MSFT", price: 400, currency: "USD", companyName: "Microsoft Corporation", exchange: "NASDAQ" }],
      dividends: [30, 120, 210, 300].map((d) => ({ date: daysAgo(d), dividend: 0.89, adjDividend: 0.89 })),
    });
    const { fetchQuote } = await import("@/lib/market/quote");
    const r = await fetchQuote("MSFT");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.source).toBe("FMP");
      expect(r.data.price).toBe(400);
      expect(r.data.currency).toBe("USD");
      expect(r.data.name).toBe("Microsoft Corporation");
      expect(r.data.dividend).toBeCloseTo(3.56, 2);
    }
  });

  it("converts an LSE quote from pence (GBp) to GBP (÷100) for price and dividend", async () => {
    route({
      profile: [{ symbol: "W7L.L", price: 212.62, currency: "GBp", companyName: "Warpaint London PLC", exchange: "LSE" }],
      dividends: [{ date: daysAgo(40), dividend: 13, adjDividend: 13 }],
    });
    const { fetchQuote } = await import("@/lib/market/quote");
    const r = await fetchQuote("W7L.L");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.source).toBe("FMP");
      expect(r.data.currency).toBe("GBP");
      expect(r.data.price).toBeCloseTo(2.1262, 4);
      expect(r.data.dividend).toBeCloseTo(0.13, 4);
    }
  });

  it("falls back to Polygon when FMP has no profile for a US ticker", async () => {
    route({
      profile: [], // FMP miss -> ticker_not_found -> fallback
      polygonPrev: { body: { results: [{ c: 100 }] } },
      polygonRef: { results: { name: "Fallback Co", currency_name: "usd" } },
    });
    const { fetchQuote } = await import("@/lib/market/quote");
    const r = await fetchQuote("FBCK");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.source).toBe("Polygon");
      expect(r.data.price).toBe(100);
    }
  });

  it("returns ok:false when FMP and the fallback both fail", async () => {
    route({
      profile: [],
      polygonPrev: { status: 404 },
    });
    const { fetchQuote } = await import("@/lib/market/quote");
    const r = await fetchQuote("NOPE");
    expect(r.ok).toBe(false);
  });
});
