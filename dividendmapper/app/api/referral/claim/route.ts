import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redeemGrantCode } from "@/lib/billing/redeem-grant-code";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/referral/claim?code=CODE
//
// Where a friend lands after signing in via the /refer/[code] page's magic
// link. The LoginForm's `next` param is set to this URL, so the auth callback
// bounces the freshly-signed-in user here. Redeems the trial, then redirects
// into the app. Same core logic as /api/referral/redeem; different transport
// (redirect UX instead of JSON).

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;

  if (!userId) {
    // Defensive: the friend should already be signed in by the time they hit
    // this (the /refer page's LoginForm redirects here post-sign-in). If not,
    // send them to login preserving this claim URL as the next hop.
    const claimPath = `/api/referral/claim${url.search}`;
    return NextResponse.redirect(
      `${SITE_URL}/login?next=${encodeURIComponent(claimPath)}`,
      303,
    );
  }

  // A missing/blank code can't be redeemed; treat it as the generic error UX.
  if (typeof code !== "string" || code.trim() === "") {
    return NextResponse.redirect(`${SITE_URL}/app/account?trial=error`, 303);
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[referral/claim] missing service-role env");
    return NextResponse.redirect(`${SITE_URL}/app/account?trial=error`, 303);
  }
  const serviceRole = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await redeemGrantCode(serviceRole, { userId, code });
  const target = result.ok
    ? `${SITE_URL}/app/account?trial=1`
    : `${SITE_URL}/app/account?trial=error`;
  return NextResponse.redirect(target, 303);
}
