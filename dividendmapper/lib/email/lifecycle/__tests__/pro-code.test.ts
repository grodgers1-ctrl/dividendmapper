import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createSpy = vi.fn().mockResolvedValue({ id: "promo_123", code: "DM60-AB12CD" });

vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({
    promotionCodes: { create: createSpy },
  }),
}));

import { generateLifecycleProCode } from "../pro-code";

describe("generateLifecycleProCode", () => {
  it("creates a one-time, 7-day-expiry promotion code with the lifecycle coupon", async () => {
    createSpy.mockClear();
    const result = await generateLifecycleProCode({
      couponId: "lifecycle_day60_50off_first_month",
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
    });
    expect(result.code).toMatch(/^DM60-/);
    expect(result.promoCodeId).toBe("promo_123");

    const arg = createSpy.mock.calls[0][0];
    expect(arg.promotion).toEqual({
      type: "coupon",
      coupon: "lifecycle_day60_50off_first_month",
    });
    expect(arg.max_redemptions).toBe(1);
    expect(arg.expires_at).toBe(
      Math.floor(
        (Date.parse("2026-06-13T00:00:00Z") + 7 * 24 * 60 * 60 * 1000) / 1000,
      ),
    );
    expect(arg.code).toMatch(/^DM60-[A-Z0-9]{6}$/);
  });

  it("generates a fresh code on each call", async () => {
    createSpy.mockClear();
    await generateLifecycleProCode({
      couponId: "c1",
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
    });
    await generateLifecycleProCode({
      couponId: "c1",
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
    });
    const code1 = createSpy.mock.calls[0][0].code;
    const code2 = createSpy.mock.calls[1][0].code;
    expect(code1).not.toBe(code2);
  });
});
