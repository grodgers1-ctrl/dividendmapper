import "server-only";
import { randomBytes } from "crypto";
import { getStripe } from "@/lib/billing/stripe";

// Mints a single-use, 7-day-expiry 50% off promotion code off the lifecycle
// parent coupon. Called by the day-60 dispatcher for one fresh code per
// recipient. Code format DM60-XXXXXX (uppercase alphanumeric; I/O/0/1 omitted
// for legibility).

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function randomSuffix(): string {
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export interface GenerateProCodeOpts {
  couponId: string;
  nowMs: number;
}

export interface GeneratedProCode {
  promoCodeId: string;
  code: string;
}

export async function generateLifecycleProCode(
  opts: GenerateProCodeOpts,
): Promise<GeneratedProCode> {
  const stripe = getStripe();
  const code = `DM60-${randomSuffix()}`;
  const expiresAt = Math.floor((opts.nowMs + SEVEN_DAYS_MS) / 1000);
  const created = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: opts.couponId },
    code,
    max_redemptions: 1,
    expires_at: expiresAt,
  });
  return { promoCodeId: created.id, code: created.code ?? code };
}
