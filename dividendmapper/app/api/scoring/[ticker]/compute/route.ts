import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDividendsCalendar } from "@/lib/scoring/fmp-client";
import { scoreTicker, isoDateOffset } from "@/lib/scoring/score-ticker";
import { normalizeTicker } from "@/lib/scoring/load-score";
import { createRateLimiter, clientIp } from "@/lib/rate-limit";

/**
 * On-demand resilience scoring for any ticker. Runs the same scoreTicker
 * pipeline as the nightly cron + Pro portfolio refresh, but exposes it to
 * unauthenticated visitors behind a tiered gate.
 *
 *   POST /api/scoring/[ticker]/compute
 *
 * Tiered rate-limits:
 *   - Anon: 2/IP/24h via scoring_lookup_audit (persistent across cold starts)
 *   - Signed-in Free: 2/min/user via in-memory limiter
 *   - Pro: unlimited
 *
 * 12h cooldown: if equity_scores.computed_at is fresher than 12h, return
 * cached without rate-limit cost. Matches the existing Pro refresh staleness
 * semantics (computed_at is the canonical "when did we last score this"
 * column — see app/api/portfolio/refresh-scores/route.ts).
 *
 * Persistence: every successful compute writes through scoreTicker into
 * equity_scores + equity_score_signals, growing the public scored universe.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby caps at 60s regardless of declaration. Single-ticker scoreTicker
// observed at 5-15s; 60s gives 4x margin for FMP latency spikes. If the project
// moves to Pro, bump to 120s for additional headroom. Other long-running routes
// declare 300s but are silently capped to 60s on Hobby.
export const maxDuration = 60;

const ANON_LIMIT = 2;
const ANON_WINDOW_HOURS = 24;
const COOLDOWN_HOURS = 12;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

// Signed-in free tier: in-memory limiter keyed on user_id. Cold-start reset is
// fine at a 1-minute window.
const freeLimiter = createRateLimiter({ limit: 2, windowMs: 60_000 });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: raw } = await params;
  const ticker = normalizeTicker(raw);
  if (!ticker) {
    return NextResponse.json({ error: "invalid_ticker" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims?.sub as string | undefined) ?? null;

  // ── Cooldown check (runs before rate-limit; cached results don't burn slots)
  const { data: existing } = await supabase
    .from("equity_scores")
    .select("ticker, computed_at")
    .eq("ticker", ticker)
    .maybeSingle<{ ticker: string; computed_at: string }>();

  if (existing?.computed_at) {
    const ageMs = Date.now() - new Date(existing.computed_at).getTime();
    if (ageMs < COOLDOWN_MS) {
      return NextResponse.json({ ok: true, cached: true, ticker });
    }
  }

  // ── Rate-limit
  let tier: "anon" | "free" | "pro" = "anon";
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", userId)
      .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
    tier = profile?.tier === "pro" || profile?.tier === "premium" ? "pro" : "free";
  }

  if (tier === "anon") {
    const ip = clientIp(req.headers);
    const sinceIso = new Date(Date.now() - ANON_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("scoring_lookup_audit")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("scored_at", sinceIso);

    if ((count ?? 0) >= ANON_LIMIT) {
      return NextResponse.json(
        { error: "rate_limited", tier: "anon" },
        { status: 429 },
      );
    }
  } else if (tier === "free") {
    const { allowed, resetAt } = freeLimiter(userId!, Date.now());
    if (!allowed) {
      const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: "rate_limited", tier: "free", retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }
  // Pro: no limit

  // ── Service-role client for the write path (equity_scores has RLS-restricted
  // writes; anon + free user sessions can't insert directly).
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Calendar (best-effort)
  const today = isoDateOffset(0);
  let calendar: Awaited<ReturnType<typeof getDividendsCalendar>> = [];
  try {
    calendar = await getDividendsCalendar(today, isoDateOffset(90));
  } catch {
    // Calendar is best-effort metadata. Scoring proceeds without it.
  }

  // ── Compute
  try {
    await scoreTicker(admin, ticker, calendar, today);
  } catch (err) {
    console.error(`[compute] scoreTicker failed for ${ticker}`, err);
    Sentry.captureException(err, { extra: { ticker, tier } });
    return NextResponse.json(
      { error: "ticker_not_coverable" },
      { status: 422 },
    );
  }

  // ── Audit (anon only; signed-in counters live in-memory or n/a for Pro)
  if (tier === "anon") {
    const ip = clientIp(req.headers);
    await admin.from("scoring_lookup_audit").insert({ ip, ticker });
  }

  // Flush the ISR cache for this ticker's public page so the next render shows
  // the freshly computed score, not the cached "score this ticker" UI.
  revalidatePath(`/scoring/${ticker}`);

  return NextResponse.json({ ok: true, cached: false, ticker });
}
