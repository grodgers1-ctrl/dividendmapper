import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_LOCALES = new Set(["uk", "us"]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
      { status: 400 }
    );
  }

  const { email, locale, website } = body as {
    email?: unknown;
    locale?: unknown;
    website?: unknown;
  };

  // Honeypot — silently succeed for bots that fill the hidden field.
  if (typeof website === "string" && website.trim() !== "") {
    return NextResponse.json({ ok: true, alreadyOn: false });
  }

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400 }
    );
  }

  if (typeof locale !== "string" || !VALID_LOCALES.has(locale)) {
    return NextResponse.json(
      { ok: false, error: "invalid_locale" },
      { status: 400 }
    );
  }

  const trimmedEmail = email.trim().toLowerCase();

  const supabase = getSupabase();
  const { error } = await supabase
    .from("waitlist")
    .insert({ email: trimmedEmail, locale });

  if (error) {
    // Postgres unique_violation → email already on waitlist; idempotent UX.
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, alreadyOn: true });
    }
    console.error("[waitlist] insert error:", error);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, alreadyOn: false });
}
