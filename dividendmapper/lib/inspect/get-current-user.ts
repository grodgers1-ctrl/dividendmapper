import "server-only";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InspectUserTier = "free" | "pro" | "premium";

export type UserAndTier = {
  user: CurrentUser | null;
  tier: InspectUserTier;
};

/**
 * Thin wrapper that returns the verified current user plus their billing tier.
 * Used by /api/inspect/[ticker] to choose between anon / free / pro rate-limit
 * buckets. Anon visitors (no session) get { user: null, tier: 'free' } and the
 * caller bumps them to the 'anon' bucket separately.
 *
 * Reads tier from the `profiles` table the same way load-priced-holdings.ts
 * does — kept here as a wrapper so the route test can mock auth + tier as a
 * single seam.
 */
export async function getCurrentUserAndTier(): Promise<UserAndTier> {
  const user = await getCurrentUser();
  if (!user) return { user: null, tier: "free" };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle<{ tier: InspectUserTier }>();

  return { user, tier: data?.tier ?? "free" };
}
