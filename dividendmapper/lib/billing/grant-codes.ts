import { deriveSlugFromEmail, randomCodeSuffix } from "./founding-codes";

// Grant-code string generation for the referral-trial system.
//
// A grant code is a DB-only identifier (grant_codes.code) — unlike the
// founding-member flow, there is NO Stripe promotion code behind it. Keep this
// file Stripe-free so it stays cheap to call from the day-21 referral cron.
//
// Format reuses the founding-code shape (<SLUG>-<6 char suffix>) so codes read
// the same to users, e.g. GLENN-3K7QPA. Both halves are already uppercase
// (deriveSlugFromEmail uppercases the slug; randomCodeSuffix draws from an
// uppercase alphabet), so grant_codes.code is always stored uppercase and an
// exact `.eq("code", normalized)` match works at redeem time.

export function generateGrantCode(email: string): string {
  return `${deriveSlugFromEmail(email)}-${randomCodeSuffix()}`;
}
