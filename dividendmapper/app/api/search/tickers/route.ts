// Typeahead endpoint for ticker autocomplete. Used by:
//   - Add Holding modal (Day 2)
//   - Public /scoring search bar (Day 8)
// Merges searchSymbol + searchByName, dedupes by symbol, ranks by exchange
// then alphabetical. Returns up to 8 results. Client is expected to debounce
// (250ms) so we don't add server-side rate-limiting in Day 2 — that lands
// with the public surface in Day 8.

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  rankSearchResults,
  searchByName,
  searchSymbol,
  type FmpSearchResult,
} from "@/lib/scoring/fmp-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RESULTS = 8;
const MIN_QUERY_LENGTH = 2;

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  try {
    const [bySymbol, byName] = await Promise.all([
      searchSymbol(q, MAX_RESULTS),
      searchByName(q, MAX_RESULTS),
    ]);
    const seen = new Set<string>();
    const merged: FmpSearchResult[] = [];
    for (const r of [...bySymbol, ...byName]) {
      if (!seen.has(r.symbol)) {
        seen.add(r.symbol);
        merged.push(r);
      }
    }
    const ranked = rankSearchResults(q, merged).slice(0, MAX_RESULTS);
    return NextResponse.json({ results: ranked });
  } catch (err) {
    console.error("[search/tickers] failed", err);
    Sentry.captureException(err, { extra: { query: q } });
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}
