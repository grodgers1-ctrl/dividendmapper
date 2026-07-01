// Daily 08:30-UTC founder digest cron. Combines PostHog traffic (pageviews,
// uniques, top pages for yesterday) with Supabase-derived business counts (new
// signups, trials, Pro conversions, cancellations) and a rough MRR estimate,
// then emails ONE idempotent digest to each founder (FOUNDER_EMAILS). Unlike the
// LOCAL-only scripts/reports/daily-traffic.mjs, this runs server-side as a real
// Vercel cron. Auth: Bearer ${CRON_SECRET}.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { sendIdempotent } from "@/lib/email/send";
import { hogql } from "@/lib/analytics/posthog-query";
import { FOUNDER_EMAILS } from "@/lib/founder/notify";
import { FounderDigestEmail, type FounderDigestTopPage } from "@/emails/founder-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Rough MRR price constants (GBP). These are the current live Stripe prices but
// this is a founder-facing estimate, NOT reconciled revenue.
const PRO_MONTHLY_GBP = 15; // Pro monthly = £15/mo
const PRO_ANNUAL_MONTHLY_GBP = 150 / 12; // Pro annual = £150/yr -> £12.50/mo equivalent

async function countInWindow(
  supabase: SupabaseClient,
  table: string,
  dateColumn: string,
  startIso: string,
  endIso: string,
  extra?: { column: string; value: string },
): Promise<number> {
  let q = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .gte(dateColumn, startIso)
    .lt(dateColumn, endIso);
  if (extra) q = q.eq(extra.column, extra.value);
  const { count, error } = await q;
  if (error) {
    Sentry.captureException(error, { extra: { table, dateColumn } });
    return 0;
  }
  return count ?? 0;
}

async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });

  const supabase: SupabaseClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // "Yesterday" = the full previous UTC day [start, end).
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - 24 * 3600 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const dateLabel = startIso.slice(0, 10); // yyyy-mm-dd

  // --- PostHog traffic ---
  // Wrapped so a PostHog outage doesn't kill the whole digest; we still send the
  // Supabase portion with traffic metrics null/empty. Read results defensively.
  let pageviews: number | null = null;
  let uniques: number | null = null;
  let topPages: FounderDigestTopPage[] = [];
  try {
    const [pvRes, uqRes, pagesRes] = await Promise.all([
      hogql(`SELECT count() FROM events WHERE event = '$pageview' AND toDate(timestamp) = yesterday()`),
      hogql(
        `SELECT count(distinct person_id) FROM events WHERE event = '$pageview' AND toDate(timestamp) = yesterday()`,
      ),
      hogql(
        `SELECT properties.$current_url, count() AS views FROM events WHERE event = '$pageview' AND toDate(timestamp) = yesterday() GROUP BY properties.$current_url ORDER BY views DESC LIMIT 5`,
      ),
    ]);
    pageviews = (pvRes.results?.[0]?.[0] as number | undefined) ?? 0;
    uniques = (uqRes.results?.[0]?.[0] as number | undefined) ?? 0;
    topPages = (pagesRes.results ?? []).map((row) => ({
      url: String(row?.[0] ?? "/"),
      views: Number(row?.[1] ?? 0),
    }));
  } catch (err) {
    Sentry.captureException(err, { extra: { stage: "posthog" } });
  }

  // --- Supabase business counts (each scoped to the [start, end) window) ---
  const signups = await countInWindow(supabase, "profiles", "created_at", startIso, endIso);
  const trials = await countInWindow(supabase, "grant_redemptions", "redeemed_at", startIso, endIso);
  // Approximate: counts new active subscriptions created yesterday. Does NOT
  // re-derive genuine-conversion vs renewal; fine for a rough daily number.
  const conversions = await countInWindow(supabase, "subscriptions", "created_at", startIso, endIso, {
    column: "status",
    value: "active",
  });
  const cancellations = await countInWindow(supabase, "subscriptions", "updated_at", startIso, endIso, {
    column: "status",
    value: "canceled",
  });

  // --- Rough MRR (approximate, hardcoded price constants; founder-facing
  // estimate, NOT reconciled revenue) ---
  let mrr = 0;
  const { data: activeSubs, error: subsErr } = await supabase
    .from("subscriptions")
    .select("billing_period")
    .eq("status", "active");
  if (subsErr) {
    Sentry.captureException(subsErr, { extra: { stage: "mrr" } });
  } else {
    const rows = (activeSubs ?? []) as { billing_period: string | null }[];
    const monthly = rows.filter((r) => r.billing_period === "monthly").length;
    const annual = rows.filter((r) => r.billing_period === "annual").length;
    mrr = Math.round(monthly * PRO_MONTHLY_GBP + annual * PRO_ANNUAL_MONTHLY_GBP);
  }

  const metrics = {
    dateLabel,
    pageviews,
    uniques,
    topPages,
    signups,
    trials,
    conversions,
    cancellations,
    mrr,
  };

  // --- Send one digest per founder (per-recipient + per-day idempotent) ---
  let sent = 0;
  for (const recipient of FOUNDER_EMAILS) {
    const res = await sendIdempotent({
      to: recipient,
      subject: `DividendMapper daily: ${dateLabel}`,
      template: "founder_digest",
      sendKey: `founder_digest_${dateLabel}_${recipient}`,
      userId: null,
      body: FounderDigestEmail({ ...metrics }),
      supabase,
    });
    if (res.ok) {
      sent++;
    } else if (res.reason !== "already_sent") {
      // Only db_error / resend_error remain; both carry an .error. Route genuine
      // failures to Sentry (already_sent is a non-error idempotent no-op).
      Sentry.captureException(res.error, { extra: { recipient, sendReason: res.reason } });
    }
  }

  return NextResponse.json({ ok: true, sent, metrics });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
