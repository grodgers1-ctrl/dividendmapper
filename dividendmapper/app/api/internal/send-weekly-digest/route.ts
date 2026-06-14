// Weekly 17:00-UTC-Sunday digest cron. Read-only over persisted scores (engine
// frozen). For each Pro user opted into weekly_digest, compute 7-day movement
// across holdings + watched-not-held tickers and send ONE idempotent digest per
// ISO week. Sends a quiet-week note if they have positions but nothing moved;
// skips users with no holdings and no watchlist. Auth: Bearer ${CRON_SECRET}.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import {
  pickCurrentAndBaseline,
  selectWeeklyMovers,
  type HistoryRow,
  type WeeklyObservation,
  type WeeklyMover,
} from "@/lib/alerts/weekly-digest";
import { watchedNotHeld } from "@/lib/alerts/watchlist-selection";
import { isoWeekKey } from "@/lib/alerts/iso-week";
import { signUnsubToken } from "@/lib/alerts/unsub-token";
import { sendIdempotent } from "@/lib/email/send";
import { WeeklyDigestEmail, type WeeklyRow } from "@/emails/weekly-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WEEKLY_EVENT = "weekly_digest";

interface PrefRow {
  user_id: string;
  event_type: string;
  enabled: boolean;
  threshold_value: number | null;
}

async function fetchWeeklyObservations(
  supabase: SupabaseClient,
  tickers: string[],
  cutoff: string,
): Promise<WeeklyObservation[]> {
  if (tickers.length === 0) return [];

  const { data: scoreRows } = await supabase
    .from("equity_scores")
    .select("ticker, data_quality")
    .in("ticker", tickers);
  const dqByTicker = new Map<string, WeeklyObservation["dataQuality"]>();
  for (const r of (scoreRows ?? []) as { ticker: string; data_quality: WeeklyObservation["dataQuality"] }[]) {
    dqByTicker.set(r.ticker, r.data_quality);
  }

  const { data: histData } = await supabase
    .from("equity_score_history")
    .select("ticker, observed_at, buy_score, risk_score, current_price")
    .in("ticker", tickers)
    .order("observed_at", { ascending: false });
  const histByTicker = new Map<string, HistoryRow[]>();
  for (const h of (histData ?? []) as (HistoryRow & { ticker: string })[]) {
    const list = histByTicker.get(h.ticker) ?? [];
    list.push({ observed_at: h.observed_at, buy_score: h.buy_score, risk_score: h.risk_score, current_price: h.current_price });
    histByTicker.set(h.ticker, list);
  }

  return tickers.map((ticker) => {
    const { current, baseline } = pickCurrentAndBaseline(histByTicker.get(ticker) ?? [], cutoff);
    return {
      ticker,
      currResilience: current?.buy_score ?? null,
      baseResilience: baseline?.buy_score ?? null,
      currRisk: current?.risk_score ?? null,
      baseRisk: baseline?.risk_score ?? null,
      currPrice: current?.current_price ?? null,
      basePrice: baseline?.current_price ?? null,
      dataQuality: dqByTicker.get(ticker) ?? "full",
    };
  });
}

function toRow(m: WeeklyMover): WeeklyRow {
  return {
    ticker: m.ticker,
    resilience: m.resilience ? { curr: m.resilience.curr, delta: m.resilience.delta } : null,
    risk: m.risk ? { curr: m.risk.curr, delta: m.risk.delta } : null,
    priceSwingPct: m.price ? m.price.swingPct : null,
  };
}

async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dividendmapper.com";
  if (!url || !key) return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });

  const supabase: SupabaseClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const weekKey = isoWeekKey(now);

  const { data: prefData, error: prefErr } = await supabase
    .from("notification_preferences")
    .select("user_id, event_type, enabled, threshold_value")
    .eq("enabled", true)
    .or(`paused_until.is.null,paused_until.lt.${nowIso}`);
  if (prefErr) {
    Sentry.captureException(prefErr);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const prefs = ((prefData ?? []) as PrefRow[]).filter((p) => p.event_type === WEEKLY_EVENT);
  if (prefs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const userIds = Array.from(new Set(prefs.map((p) => p.user_id)));
  const { data: profileData } = await supabase.from("profiles").select("id, tier, email").in("id", userIds);
  const proById = new Map<string, { email: string }>();
  for (const p of (profileData ?? []) as { id: string; tier: string; email: string | null }[]) {
    if (p.tier && p.tier !== "free" && p.email) proById.set(p.id, { email: p.email });
  }

  let sent = 0;
  for (const uid of userIds) {
    const profile = proById.get(uid);
    if (!profile) continue;

    try {
      const { data: holdingRows } = await supabase.from("holdings").select("ticker").eq("user_id", uid);
      const held = Array.from(new Set(((holdingRows ?? []) as { ticker: string }[]).map((r) => r.ticker)));

      const { data: trackedRows } = await supabase.from("tracked_tickers").select("ticker").eq("user_id", uid);
      const watched = watchedNotHeld(((trackedRows ?? []) as { ticker: string }[]).map((r) => r.ticker), held);

      // Nothing to summarise at all -> skip the send entirely.
      if (held.length === 0 && watched.length === 0) continue;

      const holdingMovers = selectWeeklyMovers(await fetchWeeklyObservations(supabase, held, cutoff));
      const watchlistMovers = selectWeeklyMovers(await fetchWeeklyObservations(supabase, watched, cutoff));

      const unsubscribeUrl = `${site}/api/notifications/unsubscribe?token=${signUnsubToken(uid, secret)}`;
      const manageUrl = `${site}/app/account/notifications`;

      const result = await sendIdempotent({
        to: profile.email,
        subject: "Your weekly resilience digest",
        template: "weekly-digest",
        sendKey: `${uid}:weekly:${weekKey}`,
        userId: uid,
        body: WeeklyDigestEmail({
          holdings: holdingMovers.map(toRow),
          watchlist: watchlistMovers.map(toRow),
          manageUrl,
          unsubscribeUrl,
        }),
        supabase,
      });

      if (result.ok) {
        sent++;
        await supabase
          .from("notification_preferences")
          .update({ last_sent_at: nowIso })
          .eq("user_id", uid)
          .in("event_type", [WEEKLY_EVENT]);
      }
    } catch (err) {
      Sentry.captureException(err, { extra: { uid } });
    }
  }

  return NextResponse.json({ ok: true, sent });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
