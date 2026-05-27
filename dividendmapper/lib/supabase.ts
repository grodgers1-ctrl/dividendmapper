import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client (anon key — safe to use from server and client).
 * The waitlist table has RLS enabled with an "anon can insert" policy,
 * so this single client works for both the API route and any future
 * direct-from-browser inserts.
 */
let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  cached = createClient(url, anonKey, {
    auth: { persistSession: false }, // we don't use Supabase auth in Phase 1
  });
  return cached;
}
