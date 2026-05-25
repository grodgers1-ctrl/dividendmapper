import "server-only";
import Stripe from "stripe";

// Lazy singleton. Stripe SDK is heavy and we want to keep cold-start light
// for routes that don't touch billing. Routes that need it call getStripe().
//
// No apiVersion pin: defaults to the version set on the Stripe account
// dashboard. Pinning here would silently diverge from dashboard-side
// webhook event shapes.

let cachedStripe: Stripe | null = null;

// Pick the secret key by environment. Production always uses STRIPE_SECRET_KEY
// (the live key on Vercel prod). Outside production we prefer an explicit
// STRIPE_TEST_SECRET_KEY when present, so a local `npm run dev` can't charge
// real cards even while STRIPE_SECRET_KEY holds an sk_live_ value. Falls back
// to STRIPE_SECRET_KEY if no test key is set (with a loud warning if it's live).
function resolveSecretKey(): string {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd && process.env.STRIPE_TEST_SECRET_KEY) {
    return process.env.STRIPE_TEST_SECRET_KEY;
  }
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!isProd && secretKey.startsWith("sk_live_")) {
    console.warn(
      "[billing/stripe] Using a LIVE Stripe key outside production. Set " +
        "STRIPE_TEST_SECRET_KEY in .env.local to avoid charging real cards.",
    );
  }
  return secretKey;
}

export function getStripe(): Stripe {
  if (cachedStripe) return cachedStripe;
  cachedStripe = new Stripe(resolveSecretKey(), { typescript: true });
  return cachedStripe;
}
