import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { writeCacheAtomic } from "../cache";
import { tickerCachePath } from "../paths";
import { buildAsOfInputs } from "../build-asof-inputs";
import { AAPL_FIXTURE } from "./fixtures/AAPL-cache";

describe("buildAsOfInputs — TTM derivation", () => {
  let cacheRoot: string;

  beforeEach(() => {
    cacheRoot = mkdtempSync(join(tmpdir(), "ttm-test-"));
    for (const [endpoint, body] of Object.entries(AAPL_FIXTURE)) {
      writeCacheAtomic(tickerCachePath(cacheRoot, "AAPL", endpoint), body);
    }
  });

  afterEach(() => rmSync(cacheRoot, { recursive: true, force: true }));

  it("returns null TTM ratios when fewer than 4 quarters are available as of asOfDate", () => {
    const result = buildAsOfInputs({
      ticker: "AAPL", asOfDate: "2018-06-15", cacheRoot, sectorPeerCache: null,
    });
    // Only 3 quarters on/before 2018-06-15 (2018-03-31, 2017-12-31, 2017-09-30; 2018-06-30 is AFTER 06-15).
    // With <4 quarters, ratiosTtm.fcfCoverage should be null.
    expect(result.buy.ratiosTtm?.fcfCoverage).toBeNull();
    expect(result.buy.ratiosTtm?.interestCoverage).toBeNull();
  });

  it("sums trailing 4 quarters of FCF and dividends paid as of 2020-04-30", () => {
    const result = buildAsOfInputs({
      ticker: "AAPL", asOfDate: "2020-04-30", cacheRoot, sectorPeerCache: null,
    });
    // Trailing 4 quarters: 2020-03-31, 2018-06-30, 2018-03-31, 2017-12-31
    // FCF sum: 12B + 11B + 14B + 25B = 62B
    // |dividendsPaid| sum: 3.5B + 3.3B + 3.2B + 3.0B = 13.0B
    // fcfCoverage ≈ 62 / 13 ≈ 4.77
    expect(result.buy.ratiosTtm?.fcfCoverage).toBeCloseTo(4.77, 1);
  });

  it("computes TTM interest coverage from trailing 4 quarters EBIT / interest expense", () => {
    const result = buildAsOfInputs({
      ticker: "AAPL", asOfDate: "2020-04-30", cacheRoot, sectorPeerCache: null,
    });
    // EBIT sum: 13B + 12.5B + 15B + 23B = 63.5B
    // interestExpense sum: 0.8B + 0.7B + 0.7B + 0.7B = 2.9B
    // interestCoverage ≈ 63.5 / 2.9 ≈ 21.9
    expect(result.buy.ratiosTtm?.interestCoverage).toBeCloseTo(21.9, 1);
  });
});
