import { createClient } from "@supabase/supabase-js";

/**
 * Cookieless, session-less Supabase client (anon key) for PUBLIC static reads.
 *
 * The /scoring pages are statically generated with ISR (revalidate 3600). The
 * cookie-bound server client (lib/supabase/server.ts) reads next/headers
 * cookies(), which would force those pages to render dynamically. This client
 * carries no session and touches no cookies, so a page that only reads
 * public-RLS tables (equity_scores, equity_score_signals) through it stays
 * statically renderable.
 *
 * Use ONLY for public-read data. It can never see a user's session, so it must
 * not be used for any per-user or RLS-protected query.
 */
export function createSupabasePublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
