import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDividendsCalendar } from "@/lib/scoring/fmp-client";
import { scoreTicker, isoDateOffset } from "@/lib/scoring/score-ticker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// On-demand "Refresh scores now". Pro-gated. Scores the user's own missing/stale
// tickers (holdings ∪ watchlist) so newly-added rows fill in without waiting for
// the nightly cron. Capped at 20/call (~340 FMP calls) and paced; shares the
// scoreTicker path with the cron. See
// docs/superpowers/specs/2026-06-12-on-demand-score-refresh-design.md.
//
// Cooldown note: the 15-min cooldown only throttles the *stale-refresh* case
// (everything already scored but >24h old). Missing tickers — the dominant case
// right after connecting a portfolio — always bypass it, and a fully-fresh
// portfolio with no eligible work returns upToDate (never 429).

const BATCH_CAP = 20;
const STALE_MS = 24 * 3600_000;
const COOLDOWN_MS = 15 * 60_000;
const TICKER_PAD_MS =
  process.env.NODE_ENV === "test" ? 0 : Number(process.env.FMP_TICKER_PAD_MS) || 1000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, last_score_refresh_at")
    .eq("id", userId)
    .maybeSingle<{ tier: "free" | "pro" | "premium"; last_score_refresh_at: string | null }>();
  const tier = profile?.tier ?? "free";
  if (tier === "free") {
    return NextResponse.json(
      { code: "pro_required", message: "On-demand refresh is a Pro feature" },
      { status: 403 },
    );
  }

  // Gather the user's tickers (RLS-scoped). Active holdings only + the watchlist.
  const [holdingsRes, trackedRes] = await Promise.all([
    supabase.from("holdings").select("ticker").is("archived_at", null),
    supabase.from("tracked_tickers").select("ticker"),
  ]);
  if (holdingsRes.error || trackedRes.error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const allTickers = Array.from(
    new Set([...(holdingsRes.data ?? []), ...(trackedRes.data ?? [])].map((r) => r.ticker)),
  );

  if (allTickers.length === 0) {
    return NextResponse.json({ scored: 0, remaining: 0, upToDate: true });
  }

  // One set-based lookup of existing scores for those tickers.
  const { data: scoreRows, error: scoresErr } = await supabase
    .from("equity_scores")
    .select("ticker, computed_at")
    .in("ticker", allTickers);
  if (scoresErr) return NextResponse.json({ error: "query_failed" }, { status: 500 });

  const computedAt = new Map<string, string | null>(
    (scoreRows ?? []).map((r) => [r.ticker as string, r.computed_at as string | null]),
  );
  const now = Date.now();
  const missing = allTickers.filter((t) => !computedAt.has(t));
  const stale = allTickers.filter((t) => {
    const c = computedAt.get(t);
    return c != null && now - new Date(c).getTime() > STALE_MS;
  });

  // Cooldown only engages once nothing is MISSING (missing always bypasses it),
  // and only when there is stale work to throttle — otherwise we fall through to
  // the upToDate no-op below rather than returning a 429 on an empty portfolio.
  if (missing.length === 0 && stale.length > 0) {
    const last = profile?.last_score_refresh_at
      ? new Date(profile.last_score_refresh_at).getTime()
      : 0;
    if (now - last < COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
      return NextResponse.json({ code: "cooldown", retryAfterSeconds }, { status: 429 });
    }
  }

  const eligible = [...missing, ...stale]; // missing-first
  if (eligible.length === 0) {
    return NextResponse.json({ scored: 0, remaining: 0, upToDate: true });
  }

  const batch = eligible.slice(0, BATCH_CAP);
  const remaining = Math.max(0, eligible.length - batch.length);

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const today = isoDateOffset(0);
  let calendar: Awaited<ReturnType<typeof getDividendsCalendar>> = [];
  try {
    calendar = await getDividendsCalendar(today, isoDateOffset(90));
  } catch {
    // Calendar is best-effort metadata; scoring proceeds without it.
  }

  let scored = 0;
  let failed = 0;
  for (let i = 0; i < batch.length; i++) {
    if (i > 0 && TICKER_PAD_MS > 0) await sleep(TICKER_PAD_MS);
    try {
      await scoreTicker(admin, batch[i], calendar, today);
      scored++;
    } catch (err) {
      failed++;
      console.error(`[refresh-scores] ticker ${batch[i]} failed`, err);
      Sentry.captureException(err, { extra: { ticker: batch[i] } });
    }
  }

  // Service-role stamp (don't assume the user can update their own profiles row).
  await admin
    .from("profiles")
    .update({ last_score_refresh_at: new Date().toISOString() })
    .eq("id", userId);

  return NextResponse.json({ scored, failed, remaining });
}
