// Daily 08:00-UTC cron. 21 days after a user became a paying Pro subscriber,
// email them a single referral code they can hand to a friend (the friend gets
// a no-card 7-day Pro trial). This is the deliberate "later touchpoint" — NOT
// sent at signup/welcome.
//
// COHORT: active subscriptions joined to profiles, filtered in JS to
// tier === 'pro' AND tier_source === 'stripe'. This excludes founding members
// (tier_source='founding_member', and they have no subscriptions row anyway)
// and trial users (tier_source='trial'). We use a two-query fetch (active
// subscriptions, then profiles by id) — the same shape as send-weekly-digest —
// because no FK-embed relationship name is established in this repo.
//
// GATING ORDER: check sent_emails for the idempotency key FIRST, then apply
// shouldSendReferralOffer BEFORE issuing a code, so we never mint a grant_codes
// row for a user who isn't due yet. Auth: Authorization: Bearer ${CRON_SECRET}.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { issueReferralCodeForUser } from "@/lib/billing/issue-referral-code";
import { sendIdempotent } from "@/lib/email/send";
import { shouldSendReferralOffer } from "@/lib/email/pro-referral-offer";
import { ProReferralOfferEmail } from "@/emails/pro-referral-offer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DAY_MS = 24 * 3600 * 1000;

interface SubscriptionRow {
  user_id: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  email: string | null;
  tier: string | null;
  tier_source: string | null;
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

  // 1. Active subscriptions drive the cohort.
  const { data: subData, error: subErr } = await supabase
    .from("subscriptions")
    .select("user_id, created_at")
    .eq("status", "active");
  if (subErr) {
    Sentry.captureException(subErr);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const subs = (subData ?? []) as SubscriptionRow[];
  if (subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const subByUser = new Map<string, SubscriptionRow>();
  for (const s of subs) subByUser.set(s.user_id, s);
  const userIds = Array.from(subByUser.keys());

  // 2. Fetch those profiles, then filter to paying Pro (tier_source='stripe'),
  // excluding founding members and trials.
  const { data: profileData, error: profErr } = await supabase
    .from("profiles")
    .select("id, email, tier, tier_source")
    .in("id", userIds);
  if (profErr) {
    Sentry.captureException(profErr);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const eligible = ((profileData ?? []) as ProfileRow[]).filter(
    (p) => p.email && p.tier === "pro" && p.tier_source === "stripe",
  );

  const nowMs = Date.now();
  let sent = 0;

  for (const profile of eligible) {
    const uid = profile.id;
    const email = profile.email as string;
    const sub = subByUser.get(uid);
    if (!sub) continue;

    try {
      const daysSincePro = (nowMs - Date.parse(sub.created_at)) / DAY_MS;
      const sendKey = `pro_referral_offer_${uid}`;

      // Idempotency check first, then the pure gate — so we don't mint a code
      // for a user who isn't due yet.
      const { data: already } = await supabase
        .from("sent_emails")
        .select("id")
        .eq("send_key", sendKey)
        .limit(1);
      const alreadySent = (already?.length ?? 0) > 0;

      if (!shouldSendReferralOffer({ daysSincePro, alreadySent })) continue;

      const { code } = await issueReferralCodeForUser(supabase, { userId: uid, email });

      const res = await sendIdempotent({
        to: email,
        subject: "Give a friend 7 days of Pro, on us",
        template: "pro_referral_offer",
        sendKey,
        userId: uid,
        body: ProReferralOfferEmail({
          code,
          referralUrl: `${site}/refer/${code}`,
          accountUrl: `${site}/app/account`,
        }),
        supabase,
      });

      if (res.ok) {
        sent++;
      } else if (res.reason === "resend_error" || res.reason === "db_error") {
        // Genuine failure (Resend or DB) -> route to Sentry for operator
        // visibility. already_sent is a benign no-op (a prior run already sent
        // it), so it falls through without reporting.
        Sentry.captureException(res.error, {
          extra: { userId: uid, sendReason: res.reason },
        });
      }
    } catch (err) {
      Sentry.captureException(err, { extra: { userId: uid } });
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
