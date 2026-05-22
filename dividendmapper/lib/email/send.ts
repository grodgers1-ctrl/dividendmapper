import "server-only";
import { render } from "@react-email/components";
import type { ReactElement } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMAIL_FROM, EMAIL_REPLY_TO, getResend } from "./resend";

// Idempotent transactional send wrapper.
//
// Pattern: INSERT into sent_emails first (acting as a lock via the unique
// constraint on send_key), then call Resend, then if Resend fails DELETE
// the lock row so a retry can attempt again. The lock-first ordering means
// two concurrent webhook firings can't both pass the gate and double-send.

export type SendResult =
  | { ok: true; emailId: string | null }
  | { ok: false; reason: "already_sent" }
  | { ok: false; reason: "db_error"; error: unknown }
  | { ok: false; reason: "resend_error"; error: unknown };

interface SendOptions {
  to: string;
  subject: string;
  template: string;
  sendKey: string;
  userId?: string | null;
  body: ReactElement;
  supabase: SupabaseClient;
}

export async function sendIdempotent(opts: SendOptions): Promise<SendResult> {
  const { data: lockRow, error: lockError } = await opts.supabase
    .from("sent_emails")
    .insert({
      user_id: opts.userId ?? null,
      send_key: opts.sendKey,
      template: opts.template,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (lockError) {
    // 23505 = unique_violation (PostgreSQL). PostgREST surfaces it on .code.
    if (lockError.code === "23505") {
      return { ok: false, reason: "already_sent" };
    }
    return { ok: false, reason: "db_error", error: lockError };
  }

  const html = await render(opts.body);

  try {
    const result = await getResend().emails.send({
      from: EMAIL_FROM,
      to: opts.to,
      replyTo: EMAIL_REPLY_TO,
      subject: opts.subject,
      html,
    });

    if (result.error) {
      if (lockRow?.id) {
        await opts.supabase
          .from("sent_emails")
          .delete()
          .eq("id", lockRow.id);
      }
      return { ok: false, reason: "resend_error", error: result.error };
    }

    return { ok: true, emailId: result.data?.id ?? null };
  } catch (err) {
    if (lockRow?.id) {
      await opts.supabase.from("sent_emails").delete().eq("id", lockRow.id);
    }
    return { ok: false, reason: "resend_error", error: err };
  }
}
