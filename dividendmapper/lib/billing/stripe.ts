import "server-only";
import Stripe from "stripe";

// Lazy singleton. Stripe SDK is heavy and we want to keep cold-start light
// for routes that don't touch billing. Routes that need it call getStripe().
//
// No apiVersion pin: defaults to the version set on the Stripe account
// dashboard. Pinning here would silently diverge from dashboard-side
// webhook event shapes.

let cachedStripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (cachedStripe) return cachedStripe;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  cachedStripe = new Stripe(secretKey, { typescript: true });
  return cachedStripe;
}
