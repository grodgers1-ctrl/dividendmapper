import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { seedTickerCache, TICKER_ENDPOINTS, seedPeerCache, PEER_ENDPOINTS } from "../fetch-historical";

describe("seedTickerCache", () => {
  let cacheRoot: string;

  beforeEach(() => {
    cacheRoot = mkdtempSync(join(tmpdir(), "fetch-test-"));
  });

  afterEach(() => {
    rmSync(cacheRoot, { recursive: true, force: true });
  });

  it("calls each endpoint once on first run", async () => {
    const httpGet = vi.fn(async () => ({ ok: true }));
    await seedTickerCache({ ticker: "AAPL", cacheRoot, httpGet, padMs: 0 });
    expect(httpGet).toHaveBeenCalledTimes(TICKER_ENDPOINTS.length);
  });

  it("skips already-cached endpoints on second run", async () => {
    const httpGet = vi.fn(async () => ({ ok: true }));
    await seedTickerCache({ ticker: "AAPL", cacheRoot, httpGet, padMs: 0 });
    httpGet.mockClear();
    await seedTickerCache({ ticker: "AAPL", cacheRoot, httpGet, padMs: 0 });
    expect(httpGet).toHaveBeenCalledTimes(0);
  });

  it("refetches all endpoints when force=true", async () => {
    const httpGet = vi.fn(async () => ({ ok: true }));
    await seedTickerCache({ ticker: "AAPL", cacheRoot, httpGet, padMs: 0 });
    httpGet.mockClear();
    await seedTickerCache({ ticker: "AAPL", cacheRoot, httpGet, padMs: 0, force: true });
    expect(httpGet).toHaveBeenCalledTimes(TICKER_ENDPOINTS.length);
  });
});

describe("seedPeerCache", () => {
  let cacheRoot: string;

  beforeEach(() => {
    cacheRoot = mkdtempSync(join(tmpdir(), "peer-test-"));
  });

  afterEach(() => {
    rmSync(cacheRoot, { recursive: true, force: true });
  });

  it("fetches 3 peer endpoints", async () => {
    const httpGet = vi.fn(async () => ({ ok: true }));
    await seedPeerCache({
      sector: "Healthcare", ticker: "JNJ", cacheRoot, httpGet, padMs: 0,
    });
    expect(httpGet).toHaveBeenCalledTimes(PEER_ENDPOINTS.length);
    expect(PEER_ENDPOINTS.length).toBe(3);
  });

  it("is idempotent across runs", async () => {
    const httpGet = vi.fn(async () => ({ ok: true }));
    await seedPeerCache({ sector: "Healthcare", ticker: "JNJ", cacheRoot, httpGet, padMs: 0 });
    httpGet.mockClear();
    await seedPeerCache({ sector: "Healthcare", ticker: "JNJ", cacheRoot, httpGet, padMs: 0 });
    expect(httpGet).toHaveBeenCalledTimes(0);
  });
});
