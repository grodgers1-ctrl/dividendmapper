import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redeemGrantCode, type RedeemResult } from "@/lib/billing/redeem-grant-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/referral/redeem
//
// Manual code entry by an already-signed-in user (e.g. "I have a referral
// code" box). JSON transport. All real logic lives in redeemGrantCode; this
// route only authenticates the session, builds a service-role client, and maps
// the RedeemResult to a status code.

// Maps a failure reason to an HTTP status. self_redemption is a client mistake
// (400); already_redeemed / ineligible_tier are conflicts with existing state
// (409); not_found is a 404; expired / exhausted are "gone" (410); error 500.
function statusForReason(reason: Exclude<RedeemResult, { ok: true }>["reason"]): number {
  switch (reason) {
    case "self_redemption":
      return 400;
    case "already_redeemed":
    case "ineligible_tier":
      return 409;
    case "not_found":
      return 404;
    case "expired":
    case "exhausted":
      return 410;
    case "error":
    default:
      return 500;
  }
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let code: unknown;
  try {
    const body = await req.json();
    code = body?.code;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof code !== "string" || code.trim() === "") {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[referral/redeem] missing service-role env");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const serviceRole = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await redeemGrantCode(serviceRole, { userId, code });
  if (result.ok) {
    return NextResponse.json({ ok: true, tierExpiresAt: result.tierExpiresAt });
  }
  return NextResponse.json(
    { error: result.reason },
    { status: statusForReason(result.reason) },
  );
}
