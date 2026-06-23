// Phase 4 Sprint 1 Day 4 Task 4.2 — Minimal SEC EDGAR client.
//
// Single function: fetch the "submissions" JSON for a US-listed company and
// return the dates of its most recent 10-K, 10-Q, and 8-K filings. Used by
// the Day 4 backfill to populate vehicle_universe.last_filing_date (drives
// the "data freshness" badge later in Sprint 3).
//
// SEC requires a User-Agent identifying the requestor (per
// https://www.sec.gov/about/webmaster-faq#code-support). Rate-limit is 10
// req/sec; with only ~75 US tickers we call once per ticker during backfill,
// so a simple 200ms pacing in the caller suffices (not enforced in-module).

const EDGAR_BASE = "https://data.sec.gov/submissions";
const USER_AGENT = "DividendMapper grodgers1@googlemail.com";

export interface EdgarFilings {
  cik: string;
  lastTenK: string | null;
  lastTenQ: string | null;
  lastEightK: string | null;
}

function paddedCik(cik: string): string {
  return cik.padStart(10, "0");
}

function findMostRecent(
  forms: string[],
  dates: string[],
  needle: string,
): string | null {
  // Recent arrays are date-descending per SEC docs, so first match wins.
  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === needle) return dates[i];
  }
  return null;
}

export async function fetchEdgarFilings(cik: string): Promise<EdgarFilings> {
  const url = `${EDGAR_BASE}/CIK${paddedCik(cik)}.json`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`EDGAR ${url} returned ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as {
    filings?: { recent?: { form?: string[]; filingDate?: string[] } };
  };
  const forms = body.filings?.recent?.form ?? [];
  const dates = body.filings?.recent?.filingDate ?? [];
  return {
    cik,
    lastTenK: findMostRecent(forms, dates, "10-K"),
    lastTenQ: findMostRecent(forms, dates, "10-Q"),
    lastEightK: findMostRecent(forms, dates, "8-K"),
  };
}
