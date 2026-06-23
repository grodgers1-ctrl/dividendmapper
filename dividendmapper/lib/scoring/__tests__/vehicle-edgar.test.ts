import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

// Realistic-ish EDGAR submissions JSON. Real responses include hundreds of
// rows in `filings.recent.*` parallel arrays.
const SAMPLE_SUBMISSIONS = {
  cik: "0000726728",
  name: "Realty Income Corp",
  filings: {
    recent: {
      accessionNumber: ["0000726728-26-000034", "0000726728-26-000020", "0000726728-26-000008", "0000726728-25-000099"],
      form: ["10-Q", "8-K", "10-K", "8-K"],
      filingDate: ["2026-05-08", "2026-04-03", "2026-02-21", "2025-12-15"],
    },
  },
};

describe("vehicle-edgar / fetchEdgarFilings", () => {
  it("returns last 10-K, 10-Q, 8-K dates from the recent filings list", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(SAMPLE_SUBMISSIONS), { status: 200 }));
    const mod = await import("../vehicle-edgar");
    const res = await mod.fetchEdgarFilings("726728");
    expect(res).toEqual({
      cik: "726728",
      lastTenK: "2026-02-21",
      lastTenQ: "2026-05-08",
      lastEightK: "2026-04-03",
    });
  });

  it("zero-pads CIK to 10 digits in the URL", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(SAMPLE_SUBMISSIONS), { status: 200 }));
    const mod = await import("../vehicle-edgar");
    await mod.fetchEdgarFilings("726728");
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe("https://data.sec.gov/submissions/CIK0000726728.json");
  });

  it("sets a SEC-compliant User-Agent header", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(SAMPLE_SUBMISSIONS), { status: 200 }));
    const mod = await import("../vehicle-edgar");
    await mod.fetchEdgarFilings("726728");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/DividendMapper/i);
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/@/); // contact email present
  });

  it("returns nulls when filings.recent arrays are empty", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ cik: "1", filings: { recent: { form: [], filingDate: [], accessionNumber: [] } } }), { status: 200 }),
    );
    const mod = await import("../vehicle-edgar");
    const res = await mod.fetchEdgarFilings("1");
    expect(res).toEqual({ cik: "1", lastTenK: null, lastTenQ: null, lastEightK: null });
  });

  it("throws on HTTP error", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const mod = await import("../vehicle-edgar");
    await expect(mod.fetchEdgarFilings("999")).rejects.toThrow(/404|not found/i);
  });
});
