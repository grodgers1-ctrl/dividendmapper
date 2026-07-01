import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendIdempotent } from "@/lib/email/send";
import { FounderAlertEmail } from "@/emails/founder-alert";

// Deliberately a NEW constant here, NOT lib/scoring/config.ts's ADMIN_EMAILS.
// That one gates an unrelated admin UI page (/app/admin/scoring/audit) and is
// a different concern that may diverge later; keep the two lists independent.
export const FOUNDER_EMAILS = [
  "glenn@dividendmapper.com",
  "grodgers1@googlemail.com",
] as const;

interface NotifyFoundersOptions {
  sendKey: string;
  subject: string;
  heading: string;
  lines: string[];
}

// Emails every founder about a high-value business event. Never throws: a
// failed founder alert must not break the webhook / redemption path that
// triggers it (mirrors how the Stripe webhook treats a failed welcome email
// as non-fatal). Genuine failures are logged and we move on.
export async function notifyFounders(
  supabase: SupabaseClient,
  opts: NotifyFoundersOptions,
): Promise<void> {
  for (const recipient of FOUNDER_EMAILS) {
    // Per-recipient send_key suffix: the send_key column is unique, so a
    // shared key would let only the first recipient through. This way both
    // founders get their own sent_emails row.
    const result = await sendIdempotent({
      to: recipient,
      subject: opts.subject,
      template: "founder_alert",
      sendKey: `${opts.sendKey}_${recipient}`,
      userId: null,
      body: FounderAlertEmail({ heading: opts.heading, lines: opts.lines }),
      supabase,
    });

    // already_sent just means this founder already got this alert; not an error.
    if (!result.ok && result.reason !== "already_sent") {
      console.error(
        `notifyFounders: failed to alert ${recipient} (${result.reason})`,
        "error" in result ? result.error : undefined,
      );
    }
  }
}
