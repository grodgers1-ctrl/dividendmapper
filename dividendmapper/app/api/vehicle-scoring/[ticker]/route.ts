import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadVehicleScore, normalizeTicker } from "@/lib/scoring/load-vehicle-score";
import { createRateLimiter, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Anonymous abuse dampener for the vehicle data path. Same shape + budget as
// /api/scoring (60/hour/IP). Signed-in users (Pro breakdown island) exempt.
const anonLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 60 * 1000 });

/**
 * Public-read vehicle score lookup. Feeds the VehicleProDetail client island
 * on /reits/[ticker], /bdcs/[ticker], /uk-reits/[ticker].
 *
 *   GET /api/vehicle-scoring/[ticker]
 *
 * vehicle_scores + vehicle_score_signals are public-read (RLS); the route
 * exists to keep the gated detail out of the indexable HTML by deferring its
 * fetch behind a client island.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: raw } = await params;
  const ticker = normalizeTicker(raw);
  if (!ticker) {
    return NextResponse.json({ error: "invalid_ticker" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // Rate-limit anonymous callers only. getClaims() is a local JWT check.
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    const ip = clientIp(req.headers);
    const { allowed, resetAt } = anonLimiter(ip, Date.now());
    if (!allowed) {
      console.warn(`[vehicle-scoring] rate-limited anon ip=${ip} ticker=${ticker}`);
      const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }

  let result;
  try {
    result = await loadVehicleScore(supabase, ticker);
  } catch {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!result) {
    return NextResponse.json({ error: "not_scored" }, { status: 404 });
  }

  return NextResponse.json(result);
}
