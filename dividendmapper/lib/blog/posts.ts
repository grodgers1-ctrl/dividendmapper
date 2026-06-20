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
    slug: "transfer-workplace-pension-to-trading-212-sipp",
    title: "How I Transferred My Workplace Pension Into the Trading 212 SIPP",
    description:
      "A first-hand walkthrough of moving a £7,350 Aviva workplace pension into the Trading 212 SIPP: what the app journey looks like, the watch-outs that catch people, and when it is still the right call.",
    publishedAt: "2026-06-20",
    readingTime: "10 min",
    tags: ["UK", "SIPP", "Pension Transfer"],
    locale: "uk",
  },
  {
    slug: "dividend-safety-score-uk-income-investors",
    title: "Dividend safety score: how to tell if a UK dividend stock is truly sustainable",
    description:
      "A practical framework for evaluating whether a UK dividend stock's payout is sustainable using payout ratio, dividend cover, free cash flow support, leverage, and sector context.",
    publishedAt: "2026-06-19",
    readingTime: "9 min",
    tags: ["UK", "Dividend", "Education"],
    locale: "uk",
  },
  {
    slug: "dcf-ddm-valuation-uk-income-investors",
    title:
      "DCF vs DDM for UK income investors: what valuation models actually tell you",
    description:
      "A practical guide on when to use DCF vs DDM for UK dividend stocks, how sensitive the outputs are to your assumptions, and how valuation fits in a real income strategy.",
    publishedAt: "2026-06-16",
    readingTime: "8 min",
    tags: ["UK", "Valuation", "Education"],
    locale: "uk",
  },
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
  {
    slug: "dividend-tracker-guide-uk-income-investors",
    title: "What is a dividend tracker, and does every UK income investor need one?",
    description:
      "Track your dividends like a pro. Learn what dividend tracking means for UK investors, compare manual vs automated approaches, and find the right fit for your portfolio size.",
    publishedAt: "2026-06-15",
    readingTime: "11 min",
    tags: ["UK", "Dividend", "Tracking"],
    locale: "uk",
  },
  {
    slug: "portfolio-tracking-dividend-income-uk-investors",
    title:
      "Portfolio tracking for dividend income: a UK investor's practical guide",
    description:
      "A practical guide to managing a UK dividend-income portfolio across wrappers: yield on cost, dividend-growth tracking, income rebalancing, and retirement-income projections from your actual tracking data.",
    publishedAt: "2026-06-16",
    readingTime: "9 min",
    tags: ["UK", "Dividend", "Portfolio"],
    locale: "uk",
  },
  {
    slug: "dividend-income-retirement-tax-planning-uk-investors",
    title:
      "Dividend income in retirement: tax and planning for UK investors",
    description:
      "A practical guide to how retirement changes UK dividend tax rules, covering the personal allowance taper, the £500 dividend allowance, state pension interaction, and the tax-efficient GIA-to-SIPP-to-ISA withdrawal order.",
    publishedAt: "2026-06-17",
    readingTime: "12 min",
    tags: ["UK", "Retirement", "Tax"],
    locale: "uk",
  },
  {
    slug: "uk-platform-fees-comparison",
    title:
      "UK dividend-investing platform fees: an ISA, SIPP, and GIA cost comparison for £10k, £50k, and £100k portfolios",
    description:
      "A practical cost comparison of UK investment platform fees for dividend investors, covering percentage vs fixed-fee pricing, crossover points at £10k/£50k/£100k+ portfolio sizes, dividend-specific costs, and a switching break-even framework.",
    publishedAt: "2026-06-18",
    readingTime: "12 min",
    tags: ["UK", "Fees", "Platform"],
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
