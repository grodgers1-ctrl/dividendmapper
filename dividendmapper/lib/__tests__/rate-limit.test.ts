import { describe, it, expect } from "vitest";
import { createRateLimiter, clientIp } from "../rate-limit";

describe("createRateLimiter", () => {
  it("allows requests up to the limit within the window", () => {
    const check = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect(check("ip", 0).allowed).toBe(true);
    expect(check("ip", 100).allowed).toBe(true);
    expect(check("ip", 200).allowed).toBe(true);
  });

  it("blocks the request that exceeds the limit", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1000 });
    check("ip", 0);
    check("ip", 1);
    expect(check("ip", 2).allowed).toBe(false);
  });

  it("counts remaining down and never below zero", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(check("ip", 0).remaining).toBe(1);
    expect(check("ip", 1).remaining).toBe(0);
    expect(check("ip", 2).remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(check("ip", 0).allowed).toBe(true);
    expect(check("ip", 500).allowed).toBe(false);
    expect(check("ip", 1000).allowed).toBe(true); // window rolled over
  });

  it("tracks keys independently", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(check("a", 0).allowed).toBe(true);
    expect(check("b", 0).allowed).toBe(true);
    expect(check("a", 0).allowed).toBe(false);
  });

  it("exposes resetAt so callers can set Retry-After", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(check("ip", 200).resetAt).toBe(1200);
  });
});

describe("clientIp", () => {
  it("takes the first IP from x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIp(h)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(clientIp(h)).toBe("9.9.9.9");
  });

  it("returns 'unknown' when no IP header is present", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
