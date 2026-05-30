import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { writeCacheAtomic } from "../cache";
import { tickerCachePath, sectorPeerCachePath } from "../paths";
import { buildAsOfInputs } from "../build-asof-inputs";
import { HEALTHCARE_PEERS } from "./fixtures/peer-cache";
import { AAPL_FIXTURE } from "./fixtures/AAPL-cache";

describe("buildAsOfInputs — sector median yield", () => {
  let cacheRoot: string;

  beforeEach(() => {
    cacheRoot = mkdtempSync(join(tmpdir(), "sector-test-"));
    // Seed AAPL ticker cache
    for (const [endpoint, body] of Object.entries(AAPL_FIXTURE)) {
      writeCacheAtomic(tickerCachePath(cacheRoot, "AAPL", endpoint), body);
    }
    // Seed Healthcare peer caches
    for (const [peerTicker, endpoints] of Object.entries(HEALTHCARE_PEERS)) {
      for (const [endpoint, body] of Object.entries(endpoints)) {
        writeCacheAtomic(sectorPeerCachePath(cacheRoot, "Healthcare", peerTicker, endpoint), body);
      }
    }
  });

  afterEach(() => rmSync(cacheRoot, { recursive: true, force: true }));

  it("computes median TTM yield across 3 healthcare peers (with minPeerCount=3)", () => {
    const result = buildAsOfInputs({
      ticker: "AAPL",
      asOfDate: "2018-06-15",
      cacheRoot,
      sectorPeerCache: {
        sector: "Healthcare",
        peers: [
          { ticker: "JNJ", cacheDir: "" },
          { ticker: "PFE", cacheDir: "" },
          { ticker: "MRK", cacheDir: "" },
        ],
      },
      minPeerCount: 3,
    });
    // Yields: 2.85%, 3.67%, 2.98%. Sorted: 2.85%, 2.98%, 3.67%. Median = 2.98%.
    expect(result.buy.sectorMedianYield).toBeCloseTo(0.0298, 3);
  });

  it("returns null when fewer than minPeerCount peers have data (default 5)", () => {
    const result = buildAsOfInputs({
      ticker: "AAPL", asOfDate: "2018-06-15", cacheRoot,
      sectorPeerCache: { sector: "Healthcare", peers: [{ ticker: "JNJ", cacheDir: "" }] },
      // omit minPeerCount — default is 5; only 1 peer → null
    });
    expect(result.buy.sectorMedianYield).toBeNull();
    expect(result.meta.naSignals).toContain("D1");
  });
});
