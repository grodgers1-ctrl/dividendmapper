import { NextResponse } from "next/server";
import { fetchQuote } from "@/lib/market/quote";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRateLimiter, clientIp } from "@/lib/rate-limit";

/**
 * Ticker quote endpoint — used by the DCF calculator's "Fetch" button.
 *
 *   GET /api/market/quote?ticker=SCHD
 *   GET /api/market/quote?ticker=ULVR.L
 *
 * Routing + cache live in `lib/market/quote.ts`. This route is a thin HTTP
 * adapter so portfolio income (server-side, in-process) and the DCF page
 * (client-side, over the wire) share the same fetcher + cache.
 *
 * 30 anonymous fetches per IP per hour. DCF Fetch hits FMP (sometimes Polygon
 * / EODHD) under the hood; the 15-min in-memory cache in lib/market/quote.ts
 * already eats most repeat traffic. This limiter is cost containment against
 * scripted scrapers, not a wall against humans. Signed-in users exempt.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const anonLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 60 * 1000 });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("ticker") ?? "";

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    const ip = clientIp(req.headers);
    const { allowed, resetAt } = anonLimiter(ip, Date.now());
    if (!allowed) {
      const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }

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
