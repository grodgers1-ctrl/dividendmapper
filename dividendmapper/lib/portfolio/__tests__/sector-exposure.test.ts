import { describe, it, expect } from "vitest";
import { rollupSectors } from "@/lib/portfolio/sector-exposure";

describe("rollupSectors", () => {
  it("returns empty top + null other + null max when given no weights", () => {
    expect(rollupSectors({ weightByTicker: {}, sectorByTicker: {} })).toEqual({
      top: [],
      other: null,
      max: null,
    });
  });

  it("sums weights per sector and sorts descending", () => {
    const out = rollupSectors({
      weightByTicker: { AAPL: 0.3, MSFT: 0.2, JPM: 0.4 },
      sectorByTicker: { AAPL: "technology", MSFT: "technology", JPM: "financials" },
    });
    expect(out.top[0]).toEqual({ sector: "technology", weight: 0.5 });
    expect(out.top[1]).toEqual({ sector: "financials", weight: 0.4 });
    expect(out.other).toBeNull();
    expect(out.max?.weight).toBe(0.5);
  });

  it("collapses sectors past topN into a single Smaller Sectors slice", () => {
    const out = rollupSectors({
      weightByTicker: { A: 0.4, B: 0.25, C: 0.15, D: 0.1, E: 0.1 },
      sectorByTicker: {
        A: "tech",
        B: "financials",
        C: "energy",
        D: "utilities",
        E: "consumer staples",
      },
      topN: 3,
    });
    expect(out.top.map((s) => s.sector)).toEqual(["tech", "financials", "energy"]);
    expect(out.other?.sector).toBe("Smaller Sectors");
    expect(out.other?.weight).toBeCloseTo(0.2, 5);
  });

  it("returns other = null when number of distinct sectors is ≤ topN", () => {
    const out = rollupSectors({
      weightByTicker: { A: 0.5, B: 0.5 },
      sectorByTicker: { A: "tech", B: "financials" },
      topN: 3,
    });
    expect(out.other).toBeNull();
  });

  it("buckets null/empty sectors into 'Unclassified'", () => {
    const out = rollupSectors({
      weightByTicker: { A: 0.4, B: 0.4, C: 0.2 },
      sectorByTicker: { A: "tech", B: null, C: "" },
    });
    const u = out.top.find((s) => s.sector === "Unclassified");
    expect(u?.weight).toBeCloseTo(0.6, 5);
  });

  it("max equals the heaviest sector slice", () => {
    const out = rollupSectors({
      weightByTicker: { A: 0.1, B: 0.7, C: 0.2 },
      sectorByTicker: { A: "tech", B: "financials", C: "energy" },
    });
    expect(out.max?.sector).toBe("financials");
    expect(out.max?.weight).toBeCloseTo(0.7, 5);
  });

  it("ignores tickers without a weight entry", () => {
    const out = rollupSectors({
      weightByTicker: { A: 0.5 },
      sectorByTicker: { A: "tech", B: "financials" },
    });
    expect(out.top).toEqual([{ sector: "tech", weight: 0.5 }]);
  });

  it("defaults topN to 5 and uses 'Smaller Sectors' for the tail bucket", () => {
    const weightByTicker = {
      A: 0.20, B: 0.18, C: 0.16, D: 0.14, E: 0.12, F: 0.10, G: 0.10,
    };
    const sectorByTicker = {
      A: "technology", B: "financial", C: "consumer_staples",
      D: "healthcare", E: "industrials", F: "utility", G: "energy",
    };
    const r = rollupSectors({ weightByTicker, sectorByTicker });
    expect(r.top).toHaveLength(5);
    expect(r.other).not.toBeNull();
    expect(r.other?.sector).toBe("Smaller Sectors");
    expect(r.other?.weight).toBeCloseTo(0.20, 5); // F + G
  });
});
