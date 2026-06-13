// Daily 07:30 UTC lifecycle email cron. Walks free users through the
// SEQUENCE, applies skip-gates, sends each step idempotently via
// sent_emails. Auth: Authorization: Bearer ${CRON_SECRET}.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { runLifecycle } from "@/lib/email/lifecycle/run-lifecycle";
import { buildLifecycleContext } from "@/lib/email/lifecycle/build-context";
import { dispatchLifecycleStep } from "@/lib/email/lifecycle/dispatcher";
import { captureServerEvent } from "@/lib/analytics/posthog-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ProfileRow {
  id: string;
  email: string | null;
  tier: "free" | "pro" | "premium";
  lifecycle_emails_unsubscribed: boolean;
  created_at: string;
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

  // 1. Free-tier profiles (we drive the program off this set).
  const { data: usersData, error: usersErr } = await supabase
    .from("profiles")
    .select("id, email, tier, lifecycle_emails_unsubscribed, created_at")
    .eq("tier", "free");
  if (usersErr) {
    Sentry.captureException(usersErr);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const profileRows = (usersData ?? []) as ProfileRow[];
  const ids = new Set(profileRows.map((u) => u.id));

  // 2. last_sign_in_at lives on auth.users; page through admin.listUsers
  // to populate it. For our current cohort this is one page; the guard
  // caps at 50 pages to prevent runaway in the future.
  const signInById = new Map<string, string | null>();
  let page = 1;
  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) break;
    for (const u of data.users) {
      if (ids.has(u.id)) signInById.set(u.id, u.last_sign_in_at ?? null);
    }
    if (data.users.length < 200) break;
    page++;
  }

  const users = profileRows
    .filter((u) => u.email && u.tier === "free")
    .map((u) => ({
      userId: u.id,
      email: u.email as string,
      tier: u.tier,
      createdAt: u.created_at,
      lastSignInAt: signInById.get(u.id) ?? null,
      lifecycleUnsubscribed: u.lifecycle_emails_unsubscribed,
    }));

  const nowMs = Date.now();

  const result = await runLifecycle({
    users,
    nowMs,
    buildCtx: (u) =>
      buildLifecycleContext(supabase, {
        userId: u.userId,
        tier: u.tier,
        lifecycleUnsubscribed: u.lifecycleUnsubscribed,
        lastSignInAt: u.lastSignInAt,
        nowMs,
      }),
    alreadySent: async (_userId, sendKey) => {
      const { data } = await supabase
        .from("sent_emails")
        .select("id")
        .eq("send_key", sendKey)
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
    sendStep: (args) =>
      dispatchLifecycleStep({
        user: args.user,
        stepKey: args.stepKey,
        context: args.context,
        supabase,
        siteUrl: site,
        cronSecret: secret,
      }),
    onSkipped: (uid, stepKey, reason) =>
      captureServerEvent(uid, "lifecycle_email_skipped", {
        template: stepKey,
        reason,
      }),
  });

  if (result.sent > 100) {
    Sentry.captureMessage(`lifecycle cron sent ${result.sent} emails in one run`, "warning");
  }

  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
