import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { writeCacheAtomic } from "../cache";
import { tickerCachePath } from "../paths";
import { buildAsOfInputs } from "../build-asof-inputs";
import { AAPL_FIXTURE } from "./fixtures/AAPL-cache";

describe("buildAsOfInputs — no future leakage", () => {
  let cacheRoot: string;

  beforeEach(() => {
    cacheRoot = mkdtempSync(join(tmpdir(), "leakage-test-"));
    for (const [endpoint, body] of Object.entries(AAPL_FIXTURE)) {
      writeCacheAtomic(tickerCachePath(cacheRoot, "AAPL", endpoint), body);
    }
  });

  afterEach(() => rmSync(cacheRoot, { recursive: true, force: true }));

  it("returns no data with date > asOfDate", () => {
    const asOfDate = "2018-06-15";
    const result = buildAsOfInputs({
      ticker: "AAPL",
      asOfDate,
      cacheRoot,
      sectorPeerCache: null,
    });

    const allDates = collectAllDates(result);
    expect(allDates.length).toBeGreaterThan(0); // sanity: we DO see some dates
    for (const d of allDates) {
      expect(d <= asOfDate, `Found leaked date ${d} > ${asOfDate}`).toBe(true);
    }
  });

  it("includes data from asOfDate itself", () => {
    const result = buildAsOfInputs({
      ticker: "AAPL",
      asOfDate: "2018-06-15",
      cacheRoot,
      sectorPeerCache: null,
    });
    expect(result.buy).toBeDefined();
    expect(result.buy.priceHistory?.some((p) => p.date === "2018-06-15")).toBe(true);
  });

  it("returns empty arrays (not throw) when asOfDate is before any data", () => {
    const result = buildAsOfInputs({
      ticker: "AAPL",
      asOfDate: "2010-01-01",
      cacheRoot,
      sectorPeerCache: null,
    });
    expect(result.buy.priceHistory).toEqual([]);
  });
});

function collectAllDates(result: unknown): string[] {
  const dates: string[] = [];
  const walk = (v: unknown) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object") {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if ((k === "date" || k === "paymentDate" || k === "transactionDate") && typeof val === "string") {
          dates.push(val);
        } else walk(val);
      }
    }
  };
  walk(result);
  return dates;
}
