import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/billing/portal
//
// Form-submit endpoint from /app/account. Resolves the signed-in user's
// Stripe customer id and creates a Billing Portal session, then 303s the
// browser to Stripe's hosted portal. The portal uses the account's default
// configuration (created once via the Stripe API), so no configuration id is
// passed here. Errors redirect back to /app/account with a billing_error flag
// rather than returning JSON, because the entry point is a browser form.

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.redirect(
      `${SITE_URL}/login?next=${encodeURIComponent("/app/account")}`,
      303,
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle<{ stripe_customer_id: string | null }>();
  if (profileError || !profile) {
    console.error("[billing/portal] profile lookup failed", profileError);
    return NextResponse.redirect(`${SITE_URL}/app/account?billing_error=1`, 303);
  }
  if (!profile.stripe_customer_id) {
    console.warn("[billing/portal] no stripe_customer_id for user", userId);
    return NextResponse.redirect(
      `${SITE_URL}/app/account?billing_error=no_customer`,
      303,
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${SITE_URL}/app/account`,
    });
    if (!session.url) {
      console.error("[billing/portal] session created without url");
      return NextResponse.redirect(
        `${SITE_URL}/app/account?billing_error=1`,
        303,
      );
    }
    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error("[billing/portal] session creation failed", err);
    return NextResponse.redirect(`${SITE_URL}/app/account?billing_error=1`, 303);
  }
}
