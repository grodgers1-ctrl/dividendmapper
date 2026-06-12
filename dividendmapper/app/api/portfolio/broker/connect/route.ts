import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createT212Client } from "@/lib/brokers/t212/client";
import { encryptCredential } from "@/lib/brokers/crypto";
import { validateConnectBody } from "@/app/api/portfolio/broker/connect/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST   /api/portfolio/broker/connect  — connect (validate creds, store encrypted, create connection)
// DELETE /api/portfolio/broker/connect  — disconnect ONE connection by id (delete credential, revoke; holdings retained)
//
// Pro-gated. The T212 key+secret is encrypted at rest (AES-256-GCM) in the
// service-role-only broker_credentials table and NEVER logged or returned to
// the client. Each connection is ONE account (one wrapper), so the user picks
// the wrapper (ISA vs Invest) — the API doesn't expose it. A user may hold more
// than one connection (e.g. ISA + Invest); uniqueness is (user_id, provider,
// wrapper), so a second wrapper inserts a new row rather than overwriting.

function adminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = validateConnectBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Pro gate (mirrors the proOnly tab): Free users can't connect a broker.
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
  if ((profile?.tier ?? "free") === "free") {
    return NextResponse.json(
      { code: "pro_required", message: "Connecting a broker is a Pro feature" },
      { status: 403 },
    );
  }

  // Probe-validate read-only access with ONE T212 call. A bad key/secret 401s.
  // Never log the credential, even on failure.
  try {
    const client = createT212Client({ apiKey: parsed.value.apiKey, apiSecret: parsed.value.apiSecret });
    await client.fetchPortfolio();
  } catch {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });
  }

  let ciphertext: string;
  try {
    ciphertext = encryptCredential(`${parsed.value.apiKey}:${parsed.value.apiSecret}`);
  } catch (err) {
    console.error("[broker/connect] encrypt failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const admin = adminClient();
  if (!admin) {
    console.error("[broker/connect] missing service-role env");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const { data: conn, error: connErr } = await admin
    .from("broker_connections")
    .upsert(
      {
        user_id: userId,
        provider: "trading212",
        wrapper: parsed.value.wrapper,
        status: "active",
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider,wrapper" },
    )
    .select("id")
    .single<{ id: string }>();
  if (connErr || !conn) {
    console.error("[broker/connect] connection upsert failed", connErr);
    return NextResponse.json({ error: "connect_failed" }, { status: 500 });
  }

  const { error: credErr } = await admin
    .from("broker_credentials")
    .upsert(
      { connection_id: conn.id, ciphertext, updated_at: new Date().toISOString() },
      { onConflict: "connection_id" },
    );
  if (credErr) {
    console.error("[broker/connect] credential upsert failed", credErr);
    return NextResponse.json({ error: "connect_failed" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, connection: { provider: "trading212", wrapper: parsed.value.wrapper, status: "active" } },
    { status: 201 },
  );
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // A user can have multiple connections (ISA + Invest), so disconnect targets
  // ONE by id. The client sends it in the JSON body.
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

  // RLS + the explicit user_id eq ensure the user owns this connection.
  const { data: conn } = await supabase
    .from("broker_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("id", connectionId)
    .maybeSingle<{ id: string }>();
  if (!conn) {
    return NextResponse.json({ error: "not_connected" }, { status: 404 });
  }

  const admin = adminClient();
  if (!admin) {
    console.error("[broker/connect] missing service-role env");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  // Delete the secret; revoke the connection. Synced holdings are RETAINED as a
  // frozen snapshot (no data loss) — the user can delete them manually.
  const { error: credErr } = await admin
    .from("broker_credentials")
    .delete()
    .eq("connection_id", conn.id);
  if (credErr) {
    console.error("[broker/connect] credential delete failed", credErr);
    return NextResponse.json({ error: "disconnect_failed" }, { status: 500 });
  }

  const { error: connErr } = await admin
    .from("broker_connections")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", conn.id);
  if (connErr) {
    console.error("[broker/connect] connection revoke failed", connErr);
    return NextResponse.json({ error: "disconnect_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
