import { cache } from "react";
import { readCachedBundle } from "@/lib/inspect/read-cached-bundle";
import { loadInspectBundle } from "@/lib/inspect/load-inspect-bundle";
import { inspectAdminClient } from "@/lib/inspect/supabase-admin";
import type { InspectBundle } from "@/lib/inspect/types";

// Shared per-request data loaders for the Inspect ticker page. Used by both
// the public /inspect/[ticker] (anon, ISR) surface and /app/inspect/[ticker]
// (auth-required, in-app shell). Memoised via React's `cache()` so
// generateMetadata + the page body collapse to a single upstream call.

export type LoadResult =
  | { ok: true; bundle: InspectBundle; cacheHit: boolean }
  | { ok: false; reason: "uncoverable" };

export const loadInspectBundleResult = cache(
  async (ticker: string): Promise<LoadResult> => {
    const cached = await readCachedBundle(ticker).catch(() => null);
    if (cached) return { ok: true, bundle: cached, cacheHit: true };

    const loaded = await loadInspectBundle(ticker);
    if (loaded.status === "uncoverable") {
      return { ok: false, reason: "uncoverable" };
    }
    return { ok: true, bundle: loaded.bundle, cacheHit: false };
  },
);

// Company name lookup from equity_scores. Memoised per request so header
// and metadata share one query; the page still ships if the row is missing.
export const loadInspectProfile = cache(
  async (ticker: string): Promise<{ name: string | null }> => {
    try {
      const sb = inspectAdminClient();
      const { data } = await sb
        .from("equity_scores")
        .select("name")
        .eq("ticker", ticker)
        .maybeSingle();
      return { name: (data?.name as string | null) ?? null };
    } catch {
      return { name: null };
    }
  },
);
