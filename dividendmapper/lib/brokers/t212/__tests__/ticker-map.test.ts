import { describe, it, expect } from "vitest";
import { mapT212Ticker } from "@/lib/brokers/t212/ticker-map";
import type { BrokerInstrument } from "@/lib/brokers/types";

function metaMap(...instruments: BrokerInstrument[]): Map<string, BrokerInstrument> {
  return new Map(instruments.map((i) => [i.ticker, i]));
}

describe("mapT212Ticker", () => {
  it("maps US tickers by stripping _US_EQ (suffix fallback, no metadata)", () => {
    expect(mapT212Ticker("FOUR_US_EQ")).toEqual({ scoringTicker: "FOUR", exchange: "US" });
    expect(mapT212Ticker("DLO_US_EQ")).toEqual({ scoringTicker: "DLO", exchange: "US" });
  });

  it("maps LSE tickers by stripping the trailing l_EQ and adding .L (suffix fallback)", () => {
    expect(mapT212Ticker("PHPl_EQ")).toEqual({ scoringTicker: "PHP.L", exchange: "LSE" });
    expect(mapT212Ticker("UKWl_EQ")).toEqual({ scoringTicker: "UKW.L", exchange: "LSE" });
  });

  it("passes a bare symbol through with UNKNOWN exchange", () => {
    expect(mapT212Ticker("LGEN")).toEqual({ scoringTicker: "LGEN", exchange: "UNKNOWN" });
  });

  it("prefers instrument shortName as the base symbol when metadata is supplied", () => {
    const meta = metaMap({
      ticker: "LGENl_EQ",
      isin: "GB0005603997",
      name: "Legal & General",
      currencyCode: "GBX",
      shortName: "LGEN",
    } as BrokerInstrument & { shortName: string });
    expect(mapT212Ticker("LGENl_EQ", meta)).toEqual({ scoringTicker: "LGEN.L", exchange: "LSE" });
  });

  it("treats a USD-denominated LSE listing as LSE (suffix wins over currency)", () => {
    const meta = metaMap({
      ticker: "XNASl_EQ",
      isin: "IE00BMFKG444",
      name: "Xtrackers NASDAQ 100",
      currencyCode: "USD",
      shortName: "XNAS",
    } as BrokerInstrument & { shortName: string });
    expect(mapT212Ticker("XNASl_EQ", meta)).toEqual({ scoringTicker: "XNAS.L", exchange: "LSE" });
  });

  it("returns UNKNOWN for a non-US/non-LSE exchange suffix without crashing", () => {
    const r = mapT212Ticker("SAPd_EQ");
    expect(r.exchange).toBe("UNKNOWN");
    expect(typeof r.scoringTicker).toBe("string");
  });
});
