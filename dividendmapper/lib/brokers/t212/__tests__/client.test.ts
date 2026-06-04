import { describe, it, expect, vi } from "vitest";
import { createT212Client } from "@/lib/brokers/t212/client";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const BASE = "https://live.trading212.com/api/v0";

describe("T212 client", () => {
  it("fetchPortfolio sends HTTP Basic base64(key:secret) and returns positions", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          ticker: "FOUR_US_EQ",
          quantity: 3,
          averagePrice: 100,
          currentPrice: 120,
          ppl: 60,
          fxPpl: 0,
          initialFillDate: "2025-01-01T00:00:00.000Z",
          pieQuantity: 0,
        },
      ]),
    );
    const client = createT212Client({ apiKey: "KEY", apiSecret: "SECRET", fetchImpl, sleep: async () => {} });

    const positions = await client.fetchPortfolio();

    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({ ticker: "FOUR_US_EQ", quantity: 3, averagePrice: 100, currentPrice: 120 });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${BASE}/equity/portfolio`);
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("authorization")).toBe("Basic " + Buffer.from("KEY:SECRET").toString("base64"));
  });

  it("fetchDividends follows nextPagePath across pages and spaces the calls", async () => {
    const page1 = {
      items: [
        { ticker: "VODl_EQ", amount: 1.5, currency: "GBP", grossAmountPerShare: 0.05, paidOn: "2026-05-01", type: "DIVIDEND", reference: "r1" },
      ],
      nextPagePath: "/api/v0/history/dividends?cursor=abc&limit=50",
    };
    const page2 = {
      items: [
        { ticker: "FOUR_US_EQ", amount: 2.0, currency: "USD", grossAmountPerShare: 0.1, paidOn: "2026-04-01", type: "DIVIDEND", reference: "r2" },
      ],
      nextPagePath: null,
    };
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createT212Client({ apiKey: "K", apiSecret: "S", fetchImpl, sleep });

    const divs = await client.fetchDividends();

    expect(divs.map((d) => d.reference)).toEqual(["r1", "r2"]);
    expect(divs[0]).toMatchObject({ ticker: "VODl_EQ", amount: 1.5, currency: "GBP", paidOn: "2026-05-01", type: "DIVIDEND" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${BASE}/history/dividends?cursor=abc&limit=50`);
    expect(sleep).toHaveBeenCalled(); // spaced between paginated requests
  });

  it("fetchInstruments returns the instrument list", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([{ ticker: "FOUR_US_EQ", isin: "US82452J1097", name: "Shift4 Payments", currencyCode: "USD", type: "STOCK" }]),
    );
    const client = createT212Client({ apiKey: "K", apiSecret: "S", fetchImpl, sleep: async () => {} });

    const instruments = await client.fetchInstruments();

    expect(instruments[0]).toMatchObject({ ticker: "FOUR_US_EQ", isin: "US82452J1097", currencyCode: "USD" });
    expect(fetchImpl.mock.calls[0][0]).toBe(`${BASE}/equity/metadata/instruments`);
  });

  it("throws a typed BrokerApiError on a non-OK response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const client = createT212Client({ apiKey: "K", apiSecret: "S", fetchImpl, sleep: async () => {} });

    await expect(client.fetchPortfolio()).rejects.toThrow(/401/);
  });
});
