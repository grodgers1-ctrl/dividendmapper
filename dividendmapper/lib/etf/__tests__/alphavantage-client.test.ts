import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAvEtfProfile, isAvRateLimited } from "../alphavantage-client";

const originalFetch = global.fetch;
beforeEach(() => {
  process.env.ALPHAVANTAGE_API_KEY = "TEST";
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe("getAvEtfProfile", () => {
  it("parses holdings + sectors for a US ETF", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        net_assets: "44600000000",
        net_expense_ratio: "0.0035",
        inception_date: "2020-05-20",
        sectors: [{ sector: "INFORMATION TECHNOLOGY", weight: "0.145" }],
        holdings: [
          { symbol: "ROST", description: "ROSS STORES INC", weight: "0.0172" },
          { symbol: "EOG", description: "EOG RESOURCES INC", weight: "0.0161" },
        ],
      }),
    } as never);
    const out = await getAvEtfProfile("JEPI");
    expect(out?.holdings).toHaveLength(2);
    expect(out?.holdings?.[0].symbol).toBe("ROST");
    expect(out?.sectors?.[0].weight).toBe("0.145");
  });

  it("returns null on empty body (LSE ticker case)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as never);
    const out = await getAvEtfProfile("VWRL.L");
    expect(out).toBeNull();
  });

  it("detects rate-limit notice", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Information:
          "Thank you for using Alpha Vantage! Please consider spreading out your free API requests more sparingly",
      }),
    } as never);
    const out = await getAvEtfProfile("SCHD");
    expect(out).toBeNull();
    expect(isAvRateLimited()).toBe(true);
  });
});
