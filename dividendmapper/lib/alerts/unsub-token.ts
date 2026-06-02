// One-click unsubscribe token: `${base64url(userId)}.${hmac}`. HMAC-SHA256 over
// the raw user id with a server-only secret (the cron secret is reused). The
// token only lets the bearer disable their own alerts, so a stable secret is
// acceptable. Pure: the secret is passed in.
import { createHmac, timingSafeEqual } from "crypto";

export function signUnsubToken(userId: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(userId).digest("base64url");
  return `${Buffer.from(userId).toString("base64url")}.${mac}`;
}

export function verifyUnsubToken(token: string, secret: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  let userId: string;
  try {
    userId = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!userId) return null;

  const expected = createHmac("sha256", secret).update(userId).digest("base64url");
  const given = Buffer.from(parts[1]);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  return userId;
}
