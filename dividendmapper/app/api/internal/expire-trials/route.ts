// Daily 06:00-UTC cron that expires referral trials. When a user redeems a
// referral code (migration 0031) their profile is set tier='pro',
// tier_source='trial', tier_expires_at=now()+7d. Nothing reverts that until
// this cron runs. For each trial whose tier_expires_at has passed we downgrade
// to free and send ONE idempotent "trial ended" email.
//
// SCOPE: acts ONLY on tier_source='trial'. Founding-member grants also use
// tier_expires_at (tier_source='founding_member') but are a separate,
// out-of-scope expiry path — the strict tier_source filter on both the SELECT
// and the UPDATE keeps them untouched. Auth: Bearer ${CRON_SECRET}.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { sendIdempotent } from "@/lib/email/send";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { TrialExpiredEmail } from "@/emails/trial-expired";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  const { data: expiredData, error: selErr } = await supabase
    .from("profiles")
    .select("id, email, tier_expires_at")
    .eq("tier_source", "trial")
    .lt("tier_expires_at", nowIso);
  if (selErr) {
    Sentry.captureException(selErr);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const expiredProfiles = (expiredData ?? []) as {
    id: string;
    email: string | null;
    tier_expires_at: string | null;
  }[];

  let expired = 0;
  for (const profile of expiredProfiles) {
    if (!profile.email) continue;

    try {
      // Downgrade first, re-guarding tier_source='trial' in the UPDATE filter
      // itself. If the user converted to a real Stripe subscription in the
      // gap between the SELECT above and this UPDATE, their tier_source is now
      // 'stripe' and tier_expires_at is null, so this filter matches 0 rows and
      // .select() returns []. In that race we must NOT send the "trial ended"
      // email or fire analytics — they are a paying customer now.
      const { data: updated, error: updErr } = await supabase
        .from("profiles")
        .update({ tier: "free", tier_source: "free", tier_expires_at: null })
        .eq("id", profile.id)
        .eq("tier_source", "trial")
        .select("id");
      if (updErr) {
        Sentry.captureException(updErr, { extra: { userId: profile.id } });
        continue;
      }
      // Update matched 0 rows -> the row was no longer a trial (race). Skip.
      if (!updated || updated.length === 0) continue;

      expired++;

      // sendIdempotent returns { ok: false, reason } rather than throwing, so
      // the try/catch above never sees a failed send. The profile is already
      // downgraded, so a dropped email is never retried on the next run — route
      // genuine failures to Sentry for operator visibility. already_sent is a
      // non-error no-op (a prior run already sent it), so don't report it.
      const res = await sendIdempotent({
        to: profile.email,
        subject: "Your 7-day Pro trial has ended",
        template: "trial_expired",
        sendKey: `trial_expired_${profile.id}`,
        userId: profile.id,
        body: TrialExpiredEmail({ pricingUrl: `${site}/pricing` }),
        supabase,
      });
      if (!res.ok && res.reason !== "already_sent") {
        // Only db_error / resend_error remain after excluding already_sent;
        // both variants carry an .error.
        Sentry.captureException(res.error, {
          extra: { userId: profile.id, sendReason: res.reason },
        });
      }

      await captureServerEvent(profile.id, "trial_expired", {});
    } catch (err) {
      Sentry.captureException(err, { extra: { userId: profile.id } });
    }
  }

  return NextResponse.json({ ok: true, expired });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
