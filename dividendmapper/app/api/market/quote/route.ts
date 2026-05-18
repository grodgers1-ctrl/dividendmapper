import { NextResponse } from "next/server";
import { fetchQuote } from "@/lib/market/quote";

/**
 * Ticker quote endpoint — used by the DCF calculator's "Fetch" button.
 *
 *   GET /api/market/quote?ticker=SCHD
 *   GET /api/market/quote?ticker=ULVR.L
 *
 * Routing + cache live in `lib/market/quote.ts`. This route is a thin HTTP
 * adapter so portfolio income (server-side, in-process) and the DCF page
 * (client-side, over the wire) share the same fetcher + cache.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("ticker") ?? "";
  const result = await fetchQuote(raw);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({
    ok: true,
    data: result.data,
    cached: result.cached,
  });
}
