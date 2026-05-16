import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next 16 Proxy (formerly Middleware). Runs before each matched request,
 * refreshes the Supabase session cookie via getUser(), and forwards the
 * request. Page-level requireUser() (getClaims, local-only) still authorises;
 * the proxy exists so the cookie stays fresh and getClaims sees a valid JWT.
 *
 * getUser() is the only Supabase SSR call that triggers the refresh-token
 * cookie write — getClaims() and getSession() do not. The result is ignored.
 *
 * Matcher is tight on purpose: every matched path adds an Auth-server RTT.
 * Public pages, /auth/callback (which sets the cookie itself), and the Stripe
 * webhook (signature-verified, no session) are excluded.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  // /app/* and write-side API prefixes. Portfolio/billing routes are
  // pre-listed so adding them in Days 3+/7+ doesn't need a matcher edit.
  // /auth/* and /api/webhooks/* are deliberately omitted.
  matcher: [
    "/app/:path*",
    "/api/portfolio/:path*",
    "/api/billing/:path*",
    "/api/auth/:path*",
  ],
};
