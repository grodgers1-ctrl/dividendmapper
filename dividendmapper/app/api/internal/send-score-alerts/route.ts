// Daily 07:00 UTC digest cron. Read-only over persisted scores (engine frozen).
// For each Pro user with an enabled alert pref, compare each holding's two most
// recent equity_score_history rows, run buildDigest, and send ONE idempotent
// digest. Users who also opt into watchlist_alert get a second digest over the
// tickers they watch but don't hold, folded into the same email.
// Auth: Authorization: Bearer ${CRON_SECRET}.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { buildDigest, type AlertPrefs, type HoldingObservation } from "@/lib/alerts/build-digest";
import { watchedNotHeld } from "@/lib/alerts/watchlist-selection";
import { signUnsubToken } from "@/lib/alerts/unsub-token";
import { sendIdempotent } from "@/lib/email/send";
import { ScoreAlertEmail } from "@/emails/score-alert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_RISK = 75;
const DEFAULT_QUALITY = 30;

const HOLDINGS_EVENTS = ["risk_threshold_crossed", "buy_threshold_crossed"];
const ALERT_EVENTS = [...HOLDINGS_EVENTS, "watchlist_alert"];

interface PrefRow {
  user_id: string;
  event_type: string;
  enabled: boolean;
  threshold_value: number | null;
}
interface HistRow {
  ticker: string;
  observed_at: string;
  risk_score: number | null;
  buy_score: number | null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Pull the current data_quality + last two history rows for a ticker set and
// shape them into the observations buildDigest consumes. Shared by the holdings
// and watchlist passes.
async function buildObservations(
  supabase: SupabaseClient,
  tickers: string[],
): Promise<HoldingObservation[]> {
  if (tickers.length === 0) return [];

  const { data: scoreRows } = await supabase
    .from("equity_scores")
    .select("ticker, data_quality")
    .in("ticker", tickers);
  const dqByTicker = new Map<string, HoldingObservation["dataQuality"]>();
  for (const r of (scoreRows ?? []) as { ticker: string; data_quality: HoldingObservation["dataQuality"] }[]) {
    dqByTicker.set(r.ticker, r.data_quality);
  }

  const { data: histData } = await supabase
    .from("equity_score_history")
    .select("ticker, observed_at, risk_score, buy_score")
    .in("ticker", tickers)
    .order("observed_at", { ascending: false });
  const histByTicker = new Map<string, HistRow[]>();
  for (const h of (histData ?? []) as HistRow[]) {
    const list = histByTicker.get(h.ticker) ?? [];
    if (list.length < 2) list.push(h); // already desc; first two are curr, prev
    histByTicker.set(h.ticker, list);
  }

  return tickers.map((ticker) => {
    const rows = histByTicker.get(ticker) ?? [];
    const curr = rows[0] ?? null;
    const prev = rows[1] ?? null;
    return {
      ticker,
      currRisk: curr?.risk_score ?? null,
      prevRisk: prev?.risk_score ?? null,
      currQuality: curr?.buy_score ?? null,
      prevQuality: prev?.buy_score ?? null,
      dataQuality: dqByTicker.get(ticker) ?? "full",
    };
  });
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

  const nowIso = new Date().toISOString();

  // 1. Enabled prefs for our two v1 event types, not currently paused.
  const { data: prefData, error: prefErr } = await supabase
    .from("notification_preferences")
    .select("user_id, event_type, enabled, threshold_value")
    .eq("enabled", true)
    .or(`paused_until.is.null,paused_until.lt.${nowIso}`);
  if (prefErr) {
    Sentry.captureException(prefErr);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const prefs = ((prefData ?? []) as PrefRow[]).filter((p) => ALERT_EVENTS.includes(p.event_type));
  if (prefs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // 2. Restrict to Pro users (tier != free) and grab their email.
  const userIds = Array.from(new Set(prefs.map((p) => p.user_id)));
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, tier, email")
    .in("id", userIds);
  const proById = new Map<string, { email: string }>();
  for (const p of (profileData ?? []) as { id: string; tier: string; email: string | null }[]) {
    if (p.tier && p.tier !== "free" && p.email) proById.set(p.id, { email: p.email });
  }

  let sent = 0;
  for (const uid of userIds) {
    const profile = proById.get(uid);
    if (!profile) continue;

    const userPrefs = prefs.filter((p) => p.user_id === uid);
    const riskPref = userPrefs.find((p) => p.event_type === "risk_threshold_crossed");
    const qualityPref = userPrefs.find((p) => p.event_type === "buy_threshold_crossed");
    const watchlistPref = userPrefs.find((p) => p.event_type === "watchlist_alert");

    // The watchlist toggle alerts on BOTH directions at the user's configured
    // thresholds (or the defaults), independent of their holdings prefs.
    const riskThreshold = riskPref?.threshold_value ?? DEFAULT_RISK;
    const qualityThreshold = qualityPref?.threshold_value ?? DEFAULT_QUALITY;
    const holdingsPrefs: AlertPrefs = {
      riskEnabled: !!riskPref?.enabled,
      riskThreshold,
      qualityEnabled: !!qualityPref?.enabled,
      qualityThreshold,
    };
    const watchlistPrefs: AlertPrefs = {
      riskEnabled: true,
      riskThreshold,
      qualityEnabled: true,
      qualityThreshold,
    };

    try {
      // 3. This user's distinct holding tickers, and the digest over them.
      const { data: holdingRows } = await supabase.from("holdings").select("ticker").eq("user_id", uid);
      const held = Array.from(new Set(((holdingRows ?? []) as { ticker: string }[]).map((r) => r.ticker)));
      const holdingsDigest = held.length
        ? buildDigest(holdingsPrefs, await buildObservations(supabase, held))
        : null;

      // 4. Watchlist digest over watched-but-not-held tickers, if opted in.
      let watchlistDigest = null;
      if (watchlistPref?.enabled) {
        const { data: trackedRows } = await supabase
          .from("tracked_tickers")
          .select("ticker")
          .eq("user_id", uid);
        const watched = watchedNotHeld(
          ((trackedRows ?? []) as { ticker: string }[]).map((r) => r.ticker),
          held,
        );
        if (watched.length) {
          watchlistDigest = buildDigest(watchlistPrefs, await buildObservations(supabase, watched));
        }
      }

      if (!holdingsDigest && !watchlistDigest) continue;

      const unsubscribeUrl = `${site}/api/notifications/unsubscribe?token=${signUnsubToken(uid, secret)}`;
      const manageUrl = `${site}/app/account/notifications`;

      const result = await sendIdempotent({
        to: profile.email,
        subject: "A resilience update on your holdings",
        template: "score-alert",
        sendKey: `${uid}:digest:${today()}`,
        userId: uid,
        body: ScoreAlertEmail({
          qualityCrossings: holdingsDigest?.qualityCrossings ?? [],
          riskCrossings: holdingsDigest?.riskCrossings ?? [],
          watchlistQualityCrossings: watchlistDigest?.qualityCrossings ?? [],
          watchlistRiskCrossings: watchlistDigest?.riskCrossings ?? [],
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
          .in("event_type", ALERT_EVENTS);
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
