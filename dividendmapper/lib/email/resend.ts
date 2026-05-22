import "server-only";
import { Resend } from "resend";

// Lazy singleton. Resend SDK is small but we cache it the same way as
// lib/billing/stripe.ts so cold-start routes that don't send mail pay nothing.

let cached: Resend | null = null;

export function getResend(): Resend {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  cached = new Resend(apiKey);
  return cached;
}

export const EMAIL_FROM = "DividendMapper <hello@dividendmapper.com>";
export const EMAIL_REPLY_TO = "hello@dividendmapper.com";
