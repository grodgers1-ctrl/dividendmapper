import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { POSTS } from "@/lib/blog/posts";
import { isPricingPublic } from "@/lib/flags/pricing";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// Refresh the sitemap on the same cadence as the scored tickers it lists.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/tools/retirement-calculator`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/tools/dcf-calculator`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...POSTS.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt ?? post.publishedAt),
      changeFrequency: "yearly" as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  if (isPricingPublic()) {
    entries.push({
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    });
  }

  // Public scoring pages. The index plus one entry per currently-scored ticker.
  // Scores refresh nightly, so daily is the right crawl cadence. lastModified
  // uses each ticker's real computed_at (not `now`) so crawlers get a truthful
  // change signal; the index uses the most recent computed_at. A DB hiccup must
  // not break the whole sitemap, so the ticker fan-out is best-effort.
  //
  // The equity and vehicle universes share crawl shape: family list page (0.8)
  // plus one per-ticker entry (0.6). Both run in parallel via Promise.all so a
  // slow vehicle query doesn't block the equity fan-out (and vice versa).
  //
  // Supabase-js returns PromiseLike (not Promise) so we can't chain .catch
  // directly — wrap each query in a try/catch helper before handing it to
  // Promise.all. The client construction itself can also throw at build time
  // if env vars aren't exposed to the prerender step, so we wrap that too.
  // A DB hiccup or missing env still degrades gracefully to "just the index
  // entries" rather than failing the sitemap prerender.

  type ScoredRow = { ticker: string; computed_at: string };
  type VehicleRow = ScoredRow & { vehicle_type: "us_reit" | "us_bdc" | "uk_reit" };

  async function safeQuery<T>(
    run: () => PromiseLike<{ data: unknown; error: unknown }>,
  ): Promise<T[] | null> {
    try {
      const { data, error } = await run();
      if (error) return null;
      return (data ?? []) as T[];
    } catch {
      return null;
    }
  }

  let equityResult: ScoredRow[] | null = null;
  let vehicleResult: VehicleRow[] | null = null;
  try {
    const supabase = createSupabasePublicClient();
    [equityResult, vehicleResult] = await Promise.all([
      safeQuery<ScoredRow>(() =>
        supabase
          .from("equity_scores")
          .select("ticker, computed_at")
          .order("ticker", { ascending: true }),
      ),
      safeQuery<VehicleRow>(() =>
        supabase
          .from("vehicle_scores")
          .select("ticker, computed_at, vehicle_type")
          .order("ticker", { ascending: true }),
      ),
    ]);
  } catch {
    // createSupabasePublicClient threw (missing env at build) — leave both
    // null so pushFamily emits just the index entries below.
  }

  function pushFamily(indexUrl: string, rows: ScoredRow[] | null, perRowUrl: (r: ScoredRow) => string) {
    if (rows === null) {
      entries.push({
        url: indexUrl,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      });
      return;
    }
    let newest: Date | null = null;
    for (const row of rows) {
      const computed = new Date(row.computed_at);
      if (Number.isFinite(computed.getTime()) && (newest === null || computed > newest)) {
        newest = computed;
      }
    }
    entries.push({
      url: indexUrl,
      lastModified: newest ?? now,
      changeFrequency: "daily",
      priority: 0.8,
    });
    for (const row of rows) {
      const computed = new Date(row.computed_at);
      entries.push({
        url: perRowUrl(row),
        lastModified: Number.isFinite(computed.getTime()) ? computed : now,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  }

  pushFamily(`${SITE_URL}/scoring`, equityResult, (r) => `${SITE_URL}/scoring/${r.ticker}`);

  // Three vehicle families share one Supabase round-trip; split by vehicle_type
  // after the fact rather than running three separate queries.
  const byType: Record<"us_reit" | "us_bdc" | "uk_reit", VehicleRow[]> = {
    us_reit: [],
    us_bdc: [],
    uk_reit: [],
  };
  if (vehicleResult) {
    for (const row of vehicleResult) {
      byType[row.vehicle_type]?.push(row);
    }
  }
  pushFamily(`${SITE_URL}/reits`, vehicleResult ? byType.us_reit : null, (r) => `${SITE_URL}/reits/${r.ticker}`);
  pushFamily(`${SITE_URL}/bdcs`, vehicleResult ? byType.us_bdc : null, (r) => `${SITE_URL}/bdcs/${r.ticker}`);
  pushFamily(`${SITE_URL}/uk-reits`, vehicleResult ? byType.uk_reit : null, (r) => `${SITE_URL}/uk-reits/${r.ticker}`);

  // Methodology page sits alongside the family routes — single static entry.
  entries.push({
    url: `${SITE_URL}/methodology/income-vehicles`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  });

  // Income vehicles hub — peer of /scoring at the same priority band.
  entries.push({
    url: `${SITE_URL}/income-vehicles`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  });

  // Dividend calendar public landing — flagship marketing surface.
  entries.push({
    url: `${SITE_URL}/dividend-calendar`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.9,
  });

  return entries;
}
