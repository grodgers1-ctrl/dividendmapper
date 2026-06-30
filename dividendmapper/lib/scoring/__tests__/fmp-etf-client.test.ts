import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getEtfInfo, getEtfCountryWeights } from "../fmp-client";

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.FMP_API_KEY = "TEST";
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe("getEtfInfo", () => {
  it("returns the parsed array from /stable/etf/info", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify([
          {
            symbol: "VWRL.L",
            expenseRatio: 0.19,
            assetsUnderManagement: 19_000_000_000,
            domicile: "IE",
            etfCompany: "Vanguard",
          },
        ]),
      json: async () => [
        {
          symbol: "VWRL.L",
          expenseRatio: 0.19,
          assetsUnderManagement: 19_000_000_000,
          domicile: "IE",
          etfCompany: "Vanguard",
        },
      ],
    } as never);
    const out = await getEtfInfo("VWRL.L");
    expect(out[0].expenseRatio).toBe(0.19);
    expect(out[0].domicile).toBe("IE");
  });
});

describe("getEtfCountryWeights", () => {
  it("returns the parsed array from /stable/etf/country-weightings", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ country: "United States", weightPercentage: "60.2%" }]),
      json: async () => [{ country: "United States", weightPercentage: "60.2%" }],
    } as never);
    const out = await getEtfCountryWeights("VWRL.L");
    expect(out[0].country).toBe("United States");
  });
});
