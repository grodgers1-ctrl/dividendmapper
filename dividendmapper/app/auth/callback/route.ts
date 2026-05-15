import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_NEXT = "/app/portfolio";

function safeNext(raw: string | null): string {
  if (!raw) return DEFAULT_NEXT;
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_NEXT;
  return raw;
}

/**
 * PKCE magic-link callback. Supabase emails a link to
 * `${origin}/auth/callback?code=xxx&next=/where/to/land`. We exchange the
 * code for a session (sets the auth cookie) and redirect to `next`.
 *
 * Failure modes:
 *   - Missing or invalid code → bounce back to /login?error=callback
 *   - exchangeCodeForSession error → same
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=callback", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
