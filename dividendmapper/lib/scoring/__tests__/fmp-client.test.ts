import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

beforeEach(() => {
  fetchMock.mockReset();
  process.env.FMP_API_KEY = "test-key-abc";
});

afterEach(() => {
  vi.resetModules();
});

describe("fmp-client", () => {
  it("throws FmpConfigError when FMP_API_KEY is missing", async () => {
    delete process.env.FMP_API_KEY;
    const mod = await import("../fmp-client");
    await expect(mod.getProfile("AAPL")).rejects.toThrow(mod.FmpConfigError);
  });

  it("getProfile returns parsed body on 200", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ symbol: "AAPL", mktCap: 3_000_000_000_000 }]), {
        status: 200,
      }),
    );
    const mod = await import("../fmp-client");
    const result = await mod.getProfile("AAPL");
    expect(result).toEqual([{ symbol: "AAPL", mktCap: 3_000_000_000_000 }]);
  });

  it("getProfile sends symbol + apikey query params", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getProfile("ULVR.L");
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/stable/profile?");
    expect(calledUrl).toContain("symbol=ULVR.L");
    expect(calledUrl).toContain("apikey=test-key-abc");
  });

  it("throws FmpAccessError on 200 with Premium Query Parameter body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ "Error Message": "Premium Query Parameter" }), { status: 200 }),
    );
    const mod = await import("../fmp-client");
    await expect(mod.getProfile("ULVR.L")).rejects.toThrow(mod.FmpAccessError);
  });

  it("retries on 429 with exponential backoff and succeeds on retry", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ symbol: "AAPL" }]), { status: 200 }));
    const mod = await import("../fmp-client");
    vi.spyOn(mod, "__sleepForTest").mockResolvedValue(undefined);
    const result = await mod.getProfile("AAPL");
    expect(result).toEqual([{ symbol: "AAPL" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after 5 retries on persistent 429 and throws", async () => {
    fetchMock.mockImplementation(
      async () => new Response("rate limited", { status: 429 }),
    );
    const mod = await import("../fmp-client");
    vi.spyOn(mod, "__sleepForTest").mockResolvedValue(undefined);
    await expect(mod.getProfile("AAPL")).rejects.toThrow(mod.FmpRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("caches successful responses within TTL", async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify([{ symbol: "AAPL" }]), { status: 200 }),
    );
    const mod = await import("../fmp-client");
    await mod.getProfile("AAPL");
    await mod.getProfile("AAPL");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache failed responses", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("oops", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ symbol: "AAPL" }]), { status: 200 }));
    const mod = await import("../fmp-client");
    await expect(mod.getProfile("AAPL")).rejects.toThrow(mod.FmpHttpError);
    const result = await mod.getProfile("AAPL");
    expect(result).toEqual([{ symbol: "AAPL" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("fmp-client search", () => {
  it("searchSymbol hits /stable/search-symbol with query + limit + apikey", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.searchSymbol("LGEN", 5);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/stable/search-symbol?");
    expect(url).toContain("query=LGEN");
    expect(url).toContain("limit=5");
    expect(url).toContain("apikey=test-key-abc");
  });

  it("searchByName hits /stable/search-name with query + limit", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.searchByName("legal", 10);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/stable/search-name?");
    expect(url).toContain("query=legal");
    expect(url).toContain("limit=10");
  });

  it("rankSearchResults puts exact symbol match before partial name match", async () => {
    const { rankSearchResults } = await import("../fmp-client");
    const ranked = rankSearchResults("LGEN", [
      { symbol: "LGGNF", name: "Legal & General OTC", exchange: "OTC", currency: "USD", exchangeFullName: "OTC" },
      { symbol: "LGEN.L", name: "Legal & General Group", exchange: "LSE", currency: "GBp", exchangeFullName: "LSE" },
    ]);
    expect(ranked[0].symbol).toBe("LGEN.L");
  });

  it("rankSearchResults deprioritises OTC and Pink Sheets", async () => {
    const { rankSearchResults } = await import("../fmp-client");
    const ranked = rankSearchResults("legal", [
      { symbol: "LGGNF", name: "Legal & General OTC", exchange: "OTC", currency: "USD", exchangeFullName: "Other OTC" },
      { symbol: "LGEN.L", name: "Legal & General Group", exchange: "LSE", currency: "GBp", exchangeFullName: "London Stock Exchange" },
      { symbol: "LZ", name: "LegalZoom", exchange: "NASDAQ", currency: "USD", exchangeFullName: "NASDAQ" },
    ]);
    expect(ranked[ranked.length - 1].symbol).toBe("LGGNF");
  });

  it("rankSearchResults: exact full symbol match beats exact prefix match (AAPL > AAPL.L)", async () => {
    const { rankSearchResults } = await import("../fmp-client");
    const ranked = rankSearchResults("AAPL", [
      { symbol: "AAPL.L", name: "LS 1x Apple Tracker ETC", exchange: "LSE", currency: "GBp", exchangeFullName: "London Stock Exchange" },
      { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", currency: "USD", exchangeFullName: "NASDAQ" },
      { symbol: "AAPL.DE", name: "Apple Inc.", exchange: "FRA", currency: "EUR", exchangeFullName: "Frankfurt" },
    ]);
    expect(ranked[0].symbol).toBe("AAPL");
    expect(ranked[1].symbol).toBe("AAPL.L");
  });
});

describe("fmp-client Day-5 scoring endpoints", () => {
  const lastUrl = () => fetchMock.mock.calls[0][0] as string;

  it("getRatiosTtm hits /stable/ratios-ttm", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getRatiosTtm("AAPL");
    expect(lastUrl()).toContain("/stable/ratios-ttm?");
    expect(lastUrl()).toContain("symbol=AAPL");
  });

  it("getRatiosQuarterly hits /stable/ratios with period=quarter", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getRatiosQuarterly("AAPL", 20);
    expect(lastUrl()).toContain("/stable/ratios?");
    expect(lastUrl()).toContain("period=quarter");
    expect(lastUrl()).toContain("limit=20");
  });

  it("getDividends hits /stable/dividends", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getDividends("AAPL", 8);
    expect(lastUrl()).toContain("/stable/dividends?");
    expect(lastUrl()).toContain("limit=8");
  });

  it("getIncomeStatementQuarterly hits /stable/income-statement quarter", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getIncomeStatementQuarterly("AAPL", 8);
    expect(lastUrl()).toContain("/stable/income-statement?");
    expect(lastUrl()).toContain("period=quarter");
  });

  it("getCashFlowStatementQuarterly hits /stable/cash-flow-statement quarter", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getCashFlowStatementQuarterly("AAPL", 8);
    expect(lastUrl()).toContain("/stable/cash-flow-statement?");
    expect(lastUrl()).toContain("period=quarter");
  });

  it("getBalanceSheetStatementQuarterly hits /stable/balance-sheet-statement quarter", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getBalanceSheetStatementQuarterly("AAPL", 8);
    expect(lastUrl()).toContain("/stable/balance-sheet-statement?");
    expect(lastUrl()).toContain("period=quarter");
  });

  it("getKeyMetricsTtm hits /stable/key-metrics-ttm", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getKeyMetricsTtm("AAPL");
    expect(lastUrl()).toContain("/stable/key-metrics-ttm?");
  });

  it("getKeyMetricsQuarterly hits /stable/key-metrics quarter", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getKeyMetricsQuarterly("AAPL", 8);
    expect(lastUrl()).toContain("/stable/key-metrics?");
    expect(lastUrl()).toContain("period=quarter");
  });

  it("getAnalystEstimates hits /stable/analyst-estimates", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getAnalystEstimates("AAPL", "annual", 4);
    expect(lastUrl()).toContain("/stable/analyst-estimates?");
    expect(lastUrl()).toContain("period=annual");
  });

  it("getDcf hits /stable/discounted-cash-flow", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getDcf("AAPL");
    expect(lastUrl()).toContain("/stable/discounted-cash-flow?");
  });

  it("getSma hits /stable/technical-indicators/sma with periodLength + timeframe", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getSma("AAPL", 200, "1day");
    expect(lastUrl()).toContain("/stable/technical-indicators/sma?");
    expect(lastUrl()).toContain("periodLength=200");
    expect(lastUrl()).toContain("timeframe=1day");
  });

  it("getRsi hits /stable/technical-indicators/rsi with periodLength=14", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getRsi("AAPL", 14, "1day");
    expect(lastUrl()).toContain("/stable/technical-indicators/rsi?");
    expect(lastUrl()).toContain("periodLength=14");
  });

  it("getHistoricalEod hits /stable/historical-price-eod/full with from + to", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getHistoricalEod("AAPL", "2021-05-29", "2026-05-29");
    expect(lastUrl()).toContain("/stable/historical-price-eod/full?");
    expect(lastUrl()).toContain("from=2021-05-29");
    expect(lastUrl()).toContain("to=2026-05-29");
  });

  it("getPriceTargetConsensus hits /stable/price-target-consensus", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getPriceTargetConsensus("AAPL");
    expect(lastUrl()).toContain("/stable/price-target-consensus?");
  });

  it("getGradesHistorical hits /stable/grades-historical", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getGradesHistorical("AAPL", 12);
    expect(lastUrl()).toContain("/stable/grades-historical?");
    expect(lastUrl()).toContain("limit=12");
  });

  it("getInsiderTrades hits /stable/insider-trading/search with page + limit", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getInsiderTrades("AAPL", 100);
    expect(lastUrl()).toContain("/stable/insider-trading/search?");
    expect(lastUrl()).toContain("page=0");
    expect(lastUrl()).toContain("limit=100");
  });

  it("getDividendsCalendar hits /stable/dividends-calendar with from + to", async () => {
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const mod = await import("../fmp-client");
    await mod.getDividendsCalendar("2026-05-29", "2026-08-29");
    expect(lastUrl()).toContain("/stable/dividends-calendar?");
    expect(lastUrl()).toContain("from=2026-05-29");
    expect(lastUrl()).toContain("to=2026-08-29");
  });
});
