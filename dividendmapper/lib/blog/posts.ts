/**
 * Single source of truth for blog post metadata. The blog index, the sitemap,
 * and each post's structured-data block all consume this list. When adding a
 * new post:
 *   1. Append an entry here
 *   2. Create app/blog/{slug}/page.mdx
 *   3. The sitemap and index pick it up automatically
 */

export interface BlogPost {
  slug: string;
  title: string;
  /** One-line summary used in the index card and meta description. */
  description: string;
  /** Publication date in ISO 8601 (yyyy-mm-dd). */
  publishedAt: string;
  /** Last meaningful update — defaults to publishedAt when missing. */
  updatedAt?: string;
  /** Human reading-time estimate, e.g. "8 min". */
  readingTime: string;
  /** Short tags shown on the index card. Keep to 1-3. */
  tags: string[];
  /** Locale this post is primarily aimed at — affects index ordering by locale toggle. */
  locale: "uk" | "us" | "both";
}

export const POSTS: BlogPost[] = [
  {
    slug: "retirement-income-calculator-guide",
    title:
      "Retirement Income Calculator Guide: What Your Dividend Portfolio Could Pay",
    description:
      "A practical UK guide to the retirement income calculator: what the Bear, Base and Bull scenarios mean, how yield and wrapper choices change your post-tax picture, and how to use projections in your dividend planning.",
    publishedAt: "2026-06-13",
    readingTime: "7 min",
    tags: ["UK", "Retirement", "Calculator"],
    locale: "uk",
  },
  {
    slug: "isa-vs-sipp-dividend-investors",
    title: "ISA vs SIPP for Dividend Investors: What Actually Changes in Practice",
    description:
      "A practical UK guide to when an ISA beats a SIPP, when a SIPP beats an ISA, and how dividend investors should think about tax relief, access and wrapper mix.",
    publishedAt: "2026-05-31",
    readingTime: "8 min",
    tags: ["UK", "ISA", "SIPP"],
    locale: "uk",
  },
  {
    slug: "uk-dividend-tax-guide",
    title: "UK Dividend Tax Guide 2026/27",
    description:
      "What you actually pay on UK dividends in 2026/27. Allowance, rates, ISA and SIPP shielding, and worked examples for the gap year.",
    publishedAt: "2026-05-10",
    readingTime: "9 min",
    tags: ["UK", "Tax"],
    locale: "uk",
  },
  {
      slug: "retirement-income-calculator-guide",
      title: "Retirement Income Calculator Guide: What Your Dividend Portfolio Could Actually Pay",
      description:
        "How the DividendMapper retirement calculator works — wrapper-by-wrapper breakdown, three growth scenarios, and why post-tax numbers are the only ones that matter.",
      publishedAt: "2026-06-14",
      readingTime: "6 min",
      tags: ["UK", "Calculator", "Retirement"],
      locale: "uk",
    },
    {
      slug: "trading-212-sipp-review",
    title: "Trading 212 SIPP Review 2026: First Look",
    description:
      "First look at the Trading 212 SIPP, freshly approved by the FCA in February 2026. Fee structure, the Gaudi operator fee most reviews skip, what's missing, and where it sits vs HL and AJ Bell.",
    publishedAt: "2026-05-10",
    readingTime: "10 min",
    tags: ["UK", "Broker", "SIPP"],
    locale: "uk",
  },
  {
    slug: "sharesight-vs-dividendmapper-uk-income-investors",
    title: "Sharesight vs DividendMapper: what UK income investors actually need",
    description:
      "A straight comparison for UK dividend investors: where Sharesight is strong, where DividendMapper is different, and when you might use one, both, or neither.",
    publishedAt: "2026-06-04",
    readingTime: "9 min",
    tags: ["UK", "Comparison", "Dividend"],
    locale: "uk",
  },
  {
    slug: "why-headline-yield-can-be-misleading",
    title: "Why headline yield can be misleading",
    description:
      "A practical guide for UK dividend investors on the difference between a high quoted yield and income that is actually likely to hold up.",
    publishedAt: "2026-06-05",
    readingTime: "8 min",
    tags: ["UK", "Dividend", "Education"],
    locale: "uk",
  },
];

/** Looks up a post by slug. Throws if not found — fail loudly during build. */
export function requirePost(slug: string): BlogPost {
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) {
    throw new Error(`No blog post with slug: ${slug}`);
  }
  return post;
}

/** Format a publication date for human display, e.g. "10 May 2026". */
export function formatPublishedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Build the Next.js Metadata object for a post page from the manifest.
 * Each post's MDX file does `export const metadata = postMetadata("slug")`
 * so the manifest stays the single source of truth for title, description,
 * canonical URL, and OpenGraph fields.
 */
export function postMetadata(slug: string): import("next").Metadata {
  const post = requirePost(slug);
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `/blog/${slug}`,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: ["/opengraph-image"],
    },
  };
}
