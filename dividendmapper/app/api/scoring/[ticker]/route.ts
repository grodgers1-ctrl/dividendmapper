import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadScore, normalizeTicker } from "@/lib/scoring/load-score";
import { createRateLimiter, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Anonymous abuse dampener for the public data path. The public /scoring pages
// are static (ISR), so ordinary anonymous visitors are served cached HTML and
// never reach this route; the real target is a script pulling the whole scored
// universe directly. Signed-in users (the in-app drawer + Pro breakdown) are
// exempt. In-memory + per-instance — best-effort, not a hard global quota (see
// lib/rate-limit.ts). 60/hour/IP is generous for a human, tight for a scraper;
// tighten if abuse appears.
const anonLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 60 * 1000 });

/**
 * Public-read score lookup for one ticker. Feeds the holdings-table score
 * drawer (lazy-loaded on open) and the public /scoring pages' Pro breakdown.
 *
 *   GET /api/scoring/[ticker]
 *
 * equity_scores + equity_score_signals are public-read (RLS), so no auth.
 * The query itself lives in lib/scoring/load-score.ts (shared with the ISR
 * page). 404 when the ticker has not been scored yet.
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

  // Rate-limit anonymous callers only. getClaims() is a local JWT check (no
  // network), so this stays cheap on the hot path.
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    const ip = clientIp(req.headers);
    const { allowed, resetAt } = anonLimiter(ip, Date.now());
    if (!allowed) {
      console.warn(`[scoring] rate-limited anonymous lookup ip=${ip} ticker=${ticker}`);
      const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }

  let result;
  try {
    result = await loadScore(supabase, ticker);
  } catch {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!result) {
    return NextResponse.json({ error: "not_scored" }, { status: 404 });
  }

  return NextResponse.json(result);
}
