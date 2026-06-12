import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runBrokerSync } from "@/lib/brokers/run-sync";
import type { Wrapper } from "@/lib/brokers/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// T212 calls are spaced ~6-8s; a full sync (portfolio + paginated dividends +
// instruments) can run well past the default function timeout.
export const maxDuration = 300;

// POST /api/portfolio/broker/sync — on-demand "Sync now" for ONE connection.
// Pro-gated. Pulls that connection's T212 holdings + actual dividends and
// reconciles them (provenance + supersede). A user may have several connections
// (ISA + Invest), so the client names the one to sync by id in the body. The
// heavy lifting + the compute-before-write guarantee live in runBrokerSync;
// this route is auth + connection lookup + service-role handoff.

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
  if ((profile?.tier ?? "free") === "free") {
    return NextResponse.json(
      { code: "pro_required", message: "Broker sync is a Pro feature" },
      { status: 403 },
    );
  }

  let connectionId: string | undefined;
  try {
    const body = (await req.json()) as { connectionId?: unknown };
    if (typeof body?.connectionId === "string") connectionId = body.connectionId;
  } catch {
    // fall through to the 400 below
  }
  if (!connectionId) {
    return NextResponse.json({ error: "missing_connection_id" }, { status: 400 });
  }

  const { data: conn } = await supabase
    .from("broker_connections")
    .select("id, status, wrapper")
    .eq("user_id", userId)
    .eq("id", connectionId)
    .maybeSingle<{ id: string; status: string; wrapper: Wrapper | null }>();
  if (!conn) {
    return NextResponse.json({ error: "not_connected" }, { status: 404 });
  }
  if (conn.status === "revoked") {
    return NextResponse.json({ error: "connection_revoked" }, { status: 409 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[broker/sync] missing service-role env");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await runBrokerSync({
    supabase: admin,
    connection: { id: conn.id, user_id: userId, wrapper: conn.wrapper },
  });

  if (!result.ok) {
    return NextResponse.json({ error: "sync_failed", detail: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    positions: result.positionCount,
    dividends: result.dividendCount,
    inserted: result.inserted,
    updated: result.updated,
    archived: result.archived,
  });
}
