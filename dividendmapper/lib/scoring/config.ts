// Sprint-level constants used by the scoring engine + UI.
// BETA_UNTIL gates the "β" badge on score chips (Day 6 UI).
// ADMIN_EMAILS gates /app/admin/scoring/audit (Day 7).

export const BETA_UNTIL = new Date("2026-07-29T00:00:00Z");
export const ADMIN_EMAILS = ["glenn@dividendmapper.com", "grodgers1@googlemail.com"];

export function isBeta(now: Date = new Date()): boolean {
  return now < BETA_UNTIL;
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
