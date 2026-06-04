// Daily cron: re-sync every active broker connection. For each one it runs the
// SAME core as the on-demand "Sync now" route (runBrokerSync), so holdings +
// actual dividends stay current without the user clicking. Per-connection
// failures are recorded on the connection (last_sync_error) and never abort the
// run. The wrapper is read back off the connection (the user picked it at
// connect time; no user is present here).
//
// Auth: Authorization: Bearer ${CRON_SECRET} (Vercel Cron sends it).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { runBrokerSync } from "@/lib/brokers/run-sync";
import type { Wrapper } from "@/lib/brokers/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[sync-brokers] CRON_SECRET not set");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[sync-brokers] missing supabase env");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = Date.now();
  const { data: connections, error } = (await supabase
    .from("broker_connections")
    .select("id, user_id, wrapper")
    .eq("status", "active")) as {
    data: { id: string; user_id: string; wrapper: Wrapper | null }[] | null;
    error: unknown;
  };
  if (error) {
    Sentry.captureException(error, { extra: { stage: "sync-brokers:list" } });
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  let succeeded = 0;
  let failed = 0;
  for (const conn of connections ?? []) {
    try {
      const result = await runBrokerSync({
        supabase,
        connection: { id: conn.id, user_id: conn.user_id, wrapper: conn.wrapper },
      });
      if (result.ok) succeeded++;
      else failed++;
    } catch (err) {
      // runBrokerSync records its own failures; this guards against an
      // unexpected throw so one bad connection can't abort the whole run.
      failed++;
      console.error(`[sync-brokers] connection ${conn.id} threw`, err);
      Sentry.captureException(err, { extra: { connectionId: conn.id } });
    }
  }

  return NextResponse.json({
    ok: true,
    connectionCount: (connections ?? []).length,
    succeeded,
    failed,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
