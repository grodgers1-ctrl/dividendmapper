import { createHmac, timingSafeEqual } from "crypto";

// Namespace-prefixed sibling of lib/alerts/unsub-token.ts. The 'lc:' prefix
// goes through the HMAC so an alerts token for the same user does not verify
// as a lifecycle token (and vice versa). The cron secret is reused as the
// signing secret, same as alerts.

const NS = "lc:";

export function signLifecycleUnsubToken(userId: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(NS + userId).digest("base64url");
  return `${Buffer.from(userId).toString("base64url")}.${mac}`;
}

export function verifyLifecycleUnsubToken(token: string, secret: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  let userId: string;
  try {
    userId = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!userId) return null;

  const expected = createHmac("sha256", secret).update(NS + userId).digest("base64url");
  const given = Buffer.from(parts[1]);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  return userId;
}
