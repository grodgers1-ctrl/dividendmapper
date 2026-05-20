import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/billing/checkout
//
// Form-submit endpoint from /pricing. Resolves the requested price via its
// Stripe lookup_key (no price IDs baked into the codebase), creates a
// Checkout session, and 303s the browser to Stripe's hosted page.
//
// The /pricing form already forks anon vs auth at render time, so a missing
// session here is treated as an edge case (race, expired cookie). Either way
// we redirect to /login with the next param preserved.

const ALLOWED_LOOKUP_KEYS = new Set(["pro_monthly", "pro_annual"]);

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.redirect(
      `${SITE_URL}/login?next=${encodeURIComponent("/pricing")}`,
      303,
    );
  }

  let lookupKey: string;
  try {
    const formData = await req.formData();
    const raw = formData.get("lookup_key");
    if (typeof raw !== "string" || !ALLOWED_LOOKUP_KEYS.has(raw)) {
      return NextResponse.json({ error: "invalid_lookup_key" }, { status: 400 });
    }
    lookupKey = raw;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email, stripe_customer_id")
    .eq("id", userId)
    .maybeSingle<{ email: string; stripe_customer_id: string | null }>();
  if (profileError || !profile) {
    console.error("[billing/checkout] profile lookup failed", profileError);
    return NextResponse.json({ error: "profile_not_found" }, { status: 500 });
  }

  const stripe = getStripe();

  let priceId: string;
  try {
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 1,
      active: true,
    });
    if (prices.data.length === 0) {
      return NextResponse.json({ error: "unknown_price" }, { status: 400 });
    }
    priceId = prices.data[0].id;
  } catch (err) {
    console.error("[billing/checkout] price lookup failed", err);
    return NextResponse.json({ error: "stripe_unavailable" }, { status: 502 });
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: userId,
    success_url: `${SITE_URL}/app/account?welcome=1`,
    cancel_url: `${SITE_URL}/pricing`,
    allow_promotion_codes: true,
  };
  if (profile.stripe_customer_id) {
    sessionParams.customer = profile.stripe_customer_id;
  } else {
    sessionParams.customer_email = profile.email;
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.url) {
      console.error("[billing/checkout] session created without url");
      return NextResponse.json({ error: "no_session_url" }, { status: 500 });
    }
    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error("[billing/checkout] session creation failed", err);
    return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
  }
}
