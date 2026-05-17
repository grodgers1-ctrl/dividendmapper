import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next 16 Proxy (formerly Middleware). Two jobs:
 *
 *  1. Refresh the Supabase session cookie. getUser() is the only Supabase
 *     SSR call that triggers the refresh-token cookie write — getClaims()
 *     and getSession() do not. The result is ignored; page-level
 *     requireUser() still authorises via getClaims() against the local JWT.
 *
 *  2. Inject `x-pathname` into the upstream request headers so server
 *     components (notably app/app/layout.tsx) can build a correct
 *     /login?next=<deep-path> redirect URL. headers() doesn't expose the
 *     incoming pathname directly; the proxy is the canonical place to
 *     surface it.
 *
 * The setAll callback re-clones request.headers AFTER request.cookies.set
 * mutations so the refreshed Cookie header propagates upstream alongside
 * the x-pathname header. Matches the canonical Supabase SSR pattern.
 *
 * Matcher is tight on purpose: every matched path adds an Auth-server RTT.
 * Public pages, /auth/callback (which sets the cookie itself), and the
 * Stripe webhook (signature-verified, no session) are excluded.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

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
          // Re-clone request headers so the refreshed Cookie header
          // propagates upstream alongside our injected x-pathname.
          const updatedHeaders = new Headers(request.headers);
          updatedHeaders.set("x-pathname", pathname);
          response = NextResponse.next({
            request: { headers: updatedHeaders },
          });
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
