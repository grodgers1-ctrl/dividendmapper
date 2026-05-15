import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
};

/**
 * Returns the verified current user, or null if not signed in.
 * Uses getClaims() — validates the JWT locally against Supabase's published
 * keys, no network call to Auth server. Safe on hot paths.
 *
 * React cache() memoises across a single request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return {
    id: data.claims.sub as string,
    email: (data.claims.email as string | undefined) ?? "",
  };
});

/**
 * Gate for auth-required pages. Redirects to /login with `next` preserved if
 * the user isn't signed in. Returns the verified user otherwise.
 *
 * Pass the current path (e.g. "/app/portfolio") so post-login lands them back
 * where they started.
 */
export async function requireUser(currentPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  }
  return user;
}
