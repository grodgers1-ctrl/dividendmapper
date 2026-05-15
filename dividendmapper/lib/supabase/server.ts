import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client (anon key). Reads/writes the session cookie via
 * Next 16's async cookies() API. Use from Server Components, Server Actions,
 * and Route Handlers.
 *
 * Cookie writes from Server Components are swallowed silently — Next forbids
 * setting cookies during render. The proxy (Day 2) refreshes the session per
 * navigation so this is safe.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components can't set cookies. Proxy handles refresh.
          }
        },
      },
    },
  );
}
