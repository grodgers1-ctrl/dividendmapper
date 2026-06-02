// Lightweight fixed-window in-memory rate limiter. Pure factory (now is passed
// in) so it unit-tests deterministically.
//
// CAVEAT (documented for the caller): state lives in the module's process
// memory. On Vercel's serverless/Fluid runtime each instance and region keeps
// its own counter and a cold start resets it, so this is BEST-EFFORT abuse
// dampening, not a hard global quota. It is deliberately dependency-free: no
// Upstash/Redis (that is a Phase-3 dependency). Swap in a shared store later if
// a hard global limit is needed.

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

type Entry = { count: number; resetAt: number };

// Bound the map so a flood of distinct keys can't grow it without limit.
const MAX_KEYS = 10_000;

export function createRateLimiter(opts: RateLimitOptions) {
  const buckets = new Map<string, Entry>();

  return function check(key: string, now: number): RateLimitResult {
    const existing = buckets.get(key);
    if (!existing || now >= existing.resetAt) {
      // Opportunistically drop expired keys before inserting a fresh one.
      if (buckets.size >= MAX_KEYS) {
        for (const [k, v] of buckets) {
          if (now >= v.resetAt) buckets.delete(k);
        }
      }
      const resetAt = now + opts.windowMs;
      buckets.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: opts.limit - 1, resetAt };
    }

    existing.count += 1;
    const allowed = existing.count <= opts.limit;
    return {
      allowed,
      remaining: Math.max(0, opts.limit - existing.count),
      resetAt: existing.resetAt,
    };
  };
}

/**
 * Best-effort client IP for rate-limit keying. Vercel sets x-forwarded-for
 * (client first); x-real-ip is a fallback. Returns "unknown" when neither is
 * present, so a missing header buckets together rather than throwing.
 */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
