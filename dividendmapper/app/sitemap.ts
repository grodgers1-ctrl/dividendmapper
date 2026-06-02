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
      url: `${SITE_URL}/waitlist`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
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
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("equity_scores")
      .select("ticker, computed_at")
      .order("ticker", { ascending: true });
    const rows = (data ?? []) as { ticker: string; computed_at: string }[];

    let newest: Date | null = null;
    for (const row of rows) {
      const computed = new Date(row.computed_at);
      if (Number.isFinite(computed.getTime()) && (newest === null || computed > newest)) {
        newest = computed;
      }
    }
    entries.push({
      url: `${SITE_URL}/scoring`,
      lastModified: newest ?? now,
      changeFrequency: "daily",
      priority: 0.8,
    });
    for (const row of rows) {
      const computed = new Date(row.computed_at);
      entries.push({
        url: `${SITE_URL}/scoring/${row.ticker}`,
        lastModified: Number.isFinite(computed.getTime()) ? computed : now,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  } catch {
    // Best-effort: still list the index even if the ticker lookup fails.
    entries.push({
      url: `${SITE_URL}/scoring`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  return entries;
}
