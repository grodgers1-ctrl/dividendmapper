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
