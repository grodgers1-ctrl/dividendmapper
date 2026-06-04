import { normaliseTicker } from "@/lib/market/quote";
import type { BrokerInstrument } from "@/lib/brokers/types";

// Map a T212 internal ticker (e.g. "LGENl_EQ", "FOUR_US_EQ") to our scoring
// ticker (e.g. "LGEN.L", "FOUR"). T212 instruments carry no exchange field, so
// the exchange comes from the ticker suffix: "_US_EQ" = US, a trailing "l_EQ" =
// LSE (the suffix marks the LISTING, not the currency — a USD ETF on the LSE is
// still ".L"). The instrument's shortName, when supplied, is the authoritative
// base symbol; otherwise we strip the suffix off the raw ticker.

export type Exchange = "US" | "LSE" | "UNKNOWN";

export interface MappedTicker {
  scoringTicker: string;
  exchange: Exchange;
}

interface ParsedSuffix {
  exchange: Exchange;
  base: string;
}

function parseSuffix(t212Ticker: string): ParsedSuffix {
  if (t212Ticker.endsWith("_US_EQ")) {
    return { exchange: "US", base: t212Ticker.slice(0, -"_US_EQ".length) };
  }
  if (t212Ticker.endsWith("l_EQ")) {
    return { exchange: "LSE", base: t212Ticker.slice(0, -"l_EQ".length) };
  }
  if (t212Ticker.endsWith("_EQ")) {
    // Some other market (e.g. Xetra "SAPd_EQ"). Not in our scoring universe;
    // strip "_EQ" and any trailing single lowercase exchange marker.
    return { exchange: "UNKNOWN", base: t212Ticker.slice(0, -"_EQ".length).replace(/[a-z]$/, "") };
  }
  return { exchange: "UNKNOWN", base: t212Ticker };
}

export function mapT212Ticker(
  t212Ticker: string,
  instrumentsByTicker?: Map<string, BrokerInstrument>,
): MappedTicker {
  const meta = instrumentsByTicker?.get(t212Ticker) as (BrokerInstrument & { shortName?: string }) | undefined;
  const { exchange, base: parsedBase } = parseSuffix(t212Ticker);
  const base = normaliseTicker(meta?.shortName ?? parsedBase);

  let scoringTicker: string;
  if (exchange === "LSE") scoringTicker = `${base}.L`;
  else scoringTicker = base; // US, or UNKNOWN best-effort passthrough

  return { scoringTicker, exchange };
}
