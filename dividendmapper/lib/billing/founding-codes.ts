// Slug + suffix generation for founding-member promo codes.
//
// Format: <SLUG>-<6 char random>, e.g. GLENN-3K7QPA.
// Slug = email local-part, uppercased, alphanumeric only, max 10 chars.
// Suffix alphabet excludes 0/O/1/I/L for human-readable spoken codes.

const SLUG_MAX_LEN = 10;
const SUFFIX_LEN = 6;
const SUFFIX_ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function deriveSlugFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const upper = local.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!upper) return "MEMBER";
  return upper.slice(0, SLUG_MAX_LEN);
}

export function randomCodeSuffix(): string {
  const bytes = new Uint8Array(SUFFIX_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += SUFFIX_ALPHA[b % SUFFIX_ALPHA.length];
  }
  return out;
}
