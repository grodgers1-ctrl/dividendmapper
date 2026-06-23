# SEO & AEO Audit — DividendMapper

**Date:** 2026-06-22
**Framework:** Next.js 16.2.4 (App Router only), React 19.2.4, TypeScript
**Scope:** Static-analysis audit of source files. No live Core Web Vitals or Lighthouse measurements.
**Trigger:** Day 10 polish post app-shell-redesign merge (1b16fac → c1fabe1 → 06e20e5 → 9b86a25 → 1acb503). Specifically asked to confirm marketing routes haven't regressed.

---

## Executive summary

- **No SEO regression from the app-shell redesign or the marketing-chrome split (9b86a25).** /, /pricing, /blog all return 200 with the full marketing chrome still rendered. The fix only hides chrome under `/app/*`, which are already `noindex`.
- **Two real gaps worth fixing.** Pricing page has no canonical and no Open Graph block. Root layout has no `Organization`/`WebSite` JSON-LD — biggest single AEO weakness for entity disambiguation.
- **Blog content is well-structured.** Every post uses `postMetadata()` for consistent canonical/OG/twitter, plus Article + FAQ JSON-LD via `<PostHeader>` and `<FaqJsonLd>`. 17 posts, all wired up.
- **AI crawler stance is implicit-allow.** No explicit `GPTBot` / `ClaudeBot` / `PerplexityBot` rules in `app/robots.ts`. Works as a "yes please cite us" stance but it's not declared.
- **No llms.txt.** Adoption is sparse but growing; flagged as nice-to-have.
- **Indexability is clean.** All 11 `/app/*` and 2 `/preview/*` routes are explicitly `robots: { index: false, follow: false }`. 404 page does the right thing.
- **OG image route works live** (168KB PNG, 200 response from `/opengraph-image`).
- **Sitemap is dynamic and feeds off `POSTS` + scored tickers** — no hardcoded list to drift.

---

## Scorecard

| Category | Status | Notes |
|---|---|---|
| Metadata | ✅ Pass | All 20 pages export metadata. Root layout sets `metadataBase`, `title.template`, default title, description, OG, Twitter card |
| Canonical URLs | ⚠️ Partial | 8 pages have explicit canonicals. **/pricing is missing one** |
| robots.txt & sitemap | ✅ Pass | `app/robots.ts` + `app/sitemap.ts` both live. Sitemap pulls from `POSTS` + Supabase scored tickers, `revalidate: 3600` |
| Open Graph & Twitter | ⚠️ Partial | 6 page-level OG blocks + blog helper + scoring `[ticker]`. **/pricing missing OG** |
| Structured data | ⚠️ Partial | Article + FAQPage + scoring JSON-LD present. **Root `Organization`/`WebSite` missing** |
| Images & media | ✅ Pass | `next/image` throughout; `opengraph-image.tsx` route serves a generated PNG (verified live, 168KB) |
| Headings & content | ✅ Pass | Per-page `<h1>` via `<PostHeader>` on blog, hero sections on marketing; mdx-components.tsx defines a clean type scale |
| Links & navigation | ✅ Pass | `next/link` for internal, `rel="noopener noreferrer"` on external `<a>` (sampled blog layout) |
| Performance signals | ✅ Pass | `next/font` (Plus Jakarta Sans + Inter + JetBrains Mono); server components by default; no raw Google Fonts `<link>` |
| Internationalisation | ➖ N/A | LocaleProvider is React-context-based UK/US toggle, not URL-routed; no hreflang needed |
| Indexability hygiene | ✅ Pass | All `/app/*` and `/preview/*` are `robots: { index: false, follow: false }`. Scoring `[ticker]` 404 case sets noindex. `app/(public)/scoring/not-found.tsx` keeps a real 404 status |
| AEO: Content answerability | ⚠️ Partial | Blog FAQ schema is excellent. Homepage has visible FAQ section but no `FAQPage` JSON-LD |
| AEO: Entity clarity | ⚠️ Partial | Brand name + tagline consistent. No `Organization` JSON-LD with `sameAs` for disambiguation |
| AEO: Schema as LLM fodder | ⚠️ Partial | Article + FAQ on blog; calculator pages have JSON-LD; **no site-wide Organization/WebSite** |
| AEO: Citable primary content | ✅ Pass | Author byline + datePublished + dateModified visible on every post |
| AEO: Machine-readable facts | ✅ Pass | Calculators emit text outputs, not screenshots; tools render numbers via DOM, not images |
| AEO: AI crawler crawlability | ⚠️ Partial | No explicit GPTBot/ClaudeBot/PerplexityBot rules — default allow. Declare your stance |
| AEO: llms.txt | ❌ Fail | Not present. Adoption is sparse but rising |
| AEO: Freshness signals | ✅ Pass | `dateModified` populated from `post.updatedAt ?? post.publishedAt` in both Article schema and visible byline |
| AEO: Content depth | ✅ Pass | Sample posts (dividend-safety-score, pension-transfer, retirement-calculator-guide) are 1.5k+ words with specific data |
| AEO: Conversational query | ✅ Pass | Post titles answer questions ("How I Transferred…", "What is the Best…", "Why headline yield can be misleading") |

---

## Critical issues

### C1 — Pricing page has no canonical or Open Graph

**File:** `app/pricing/page.tsx` (lines 10–15).

**What's wrong:** Only `title` and `description` are set. No `alternates.canonical`, no `openGraph` block, no `twitter` card. Pricing is the highest-conversion marketing URL — when shared on social, it falls back to whatever default OG data crawlers grab.

**Verified live:** `curl https://www.dividendmapper.com/pricing | grep canonical` returns nothing.

**Fix:**

```tsx
export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free dividend portfolio tools, plus a Pro tier that lifts the 10-holding cap, scores every holding for quality and risk, sends threshold alert emails, and ships broker sync in 2026.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "DividendMapper Pricing: Free + Pro tier for UK and US investors",
    description:
      "Free dividend tools plus a Pro tier with unlimited holdings, resilience scoring, threshold alerts, and broker sync.",
    url: "/pricing",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "DividendMapper Pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image"],
  },
};
```

### C2 — No `Organization` or `WebSite` JSON-LD in root layout

**File:** `app/layout.tsx` (no JSON-LD `<script>` present).

**Why it matters:** This is the single biggest AEO gap. LLM search engines (Perplexity, ChatGPT browse, Google AI Overviews) use `Organization` JSON-LD with `sameAs` links to disambiguate entities. Without it, "DividendMapper" is just a string in their index — they can't reliably tell you apart from a hypothetical "Dividend Mapper Inc." A `WebSite` schema with `potentialAction` for the in-app search is the second highest-value addition.

**Fix:** Add a JSON-LD `<script>` block inside `<body>` (above the providers) in `app/layout.tsx`:

```tsx
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "DividendMapper",
  url: "https://dividendmapper.com",
  logo: "https://dividendmapper.com/icon.png",
  description:
    "Free dividend portfolio tools and resilience scoring for UK and US investors.",
  sameAs: [
    // Add real profiles here as they go live (Twitter/X, LinkedIn, Crunchbase, etc.)
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "DividendMapper",
  url: "https://dividendmapper.com",
  publisher: { "@id": "https://dividendmapper.com#org" },
};

// then inside <body>, before <ThemeProvider>:
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationJsonLd, websiteJsonLd]) }}
/>
```

The `sameAs` array is the key payoff — fill it with the official social/professional profiles as they're created. Empty `sameAs` is still better than no schema.

---

## Recommended issues

### R1 — Declare AI-crawler stance explicitly in `app/robots.ts`

**File:** `app/robots.ts` (no AI crawler rules).

**Why it matters:** Default is allow, so AI crawlers can index today. But the rule is implicit, which means a future change ("let's be stricter about /api") could accidentally tighten too far, and there's no record of an intentional choice. For DividendMapper specifically — being cited by AI search is high-value (free distribution to "what's the best UK dividend tracker?" queries), so the explicit allow is the right answer.

**Fix:**

```ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/"] },
      // Explicit allow for AI crawlers. DividendMapper benefits from AI search
      // citations; revisit if rights/business reasons change.
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "anthropic-ai", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      { userAgent: "CCBot", allow: "/" },
      { userAgent: "Applebot-Extended", allow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
```

### R2 — Article author should be a `Person`, not `Organization`

**File:** `components/blog/post-header.tsx` (lines 22–27).

**Why it matters:** Google's E-E-A-T and LLM trust signals weight identified human authors more than corporate authorship. Right now every blog post is authored by "DividendMapper" as an Organization. Add a Person sub-schema for Glenn (or whoever the author is per-post), keep DividendMapper as the publisher.

**Fix:**

```ts
const structuredData = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: post.title,
  description: post.description,
  datePublished: post.publishedAt,
  dateModified: updatedAt,
  author: {
    "@type": "Person",
    name: "Glenn Rodgers",      // or pull from post.author when you add per-post bylines
    url: "https://dividendmapper.com/about",  // need an author/about page for the URL to resolve
  },
  publisher: {
    "@type": "Organization",
    name: "DividendMapper",
    logo: { "@type": "ImageObject", url: "https://dividendmapper.com/icon.png" },
  },
  mainEntityOfPage: `https://dividendmapper.com/blog/${slug}`,
};
```

Requires creating `/about` (or `/author/glenn`) with a real bio for the author URL to resolve — otherwise the schema points at a 404.

### R3 — Homepage FAQ section has no `FAQPage` JSON-LD

**File:** `app/page.tsx` references a `<FaqSection />` (line ~29).

**Why it matters:** Google AI Overviews and Perplexity extract `FAQPage` answers verbatim. The homepage has visible FAQs but the structured data is missing — for blog posts you've already wired this up via `<FaqJsonLd>`. Re-use the same component on the homepage.

**Fix:** Import and render `<FaqJsonLd items={[…]} />` in `<FaqSection>` or directly in `app/page.tsx`, with the same Q&A pairs that render visibly.

---

## Nice-to-haves

- **llms.txt** at `public/llms.txt` summarising the top entry points (homepage, calculators, blog index, scoring methodology). Sparse adoption but growing; cheap to add.
- **`/about` or `/author/glenn` page** with a real human-authored bio. Resolves the URL referenced by R2 and gives LLMs an entity to anchor on for author trust.
- **Glossary / "What is" landing pages** — "What is a SIPP", "What is dividend cover", etc. Strong AEO surface area; many of the blog posts already brush these topics.
- **Per-post hero `<image>`** for richer OG previews. Right now every post falls back to the site-default `/opengraph-image`. A per-post variant (or a `/api/og?slug=…` route) would improve social click-through.
- **`SoftwareApplication` schema** on the homepage for the DividendMapper app itself — useful for "best dividend tracker" surface-area queries.
- **Sitemap `priority`** values on /pricing, /scoring, /blog/[slug] vary today; double-check the ranking reflects current commercial intent.

---

## What this audit did not cover

| Gap | What would cover it |
|---|---|
| Live Core Web Vitals (LCP, INP, CLS) | Lighthouse / PageSpeed Insights / Vercel Analytics field data |
| Backlink profile + referring domains | Ahrefs, Semrush, or Moz |
| Keyword rankings | Search Console / commercial rank trackers |
| Competitor gap analysis | Ahrefs Content Gap, Semrush Domain vs Domain |
| Live schema validation (Google Rich Results Test, schema.org validator) | Submit the live URLs to Rich Results Test |
| Actual indexing status in Google / Bing | Search Console + Bing Webmaster Tools |
| Real-world rendering of OG cards across platforms | opengraph.xyz, Twitter Card Validator, LinkedIn Post Inspector |
| LLM citation rates today (are we getting cited?) | Manual queries on ChatGPT, Perplexity, Google AI Overviews, Claude search |

The Lighthouse task (Day 10 polish item #4) covers the field-measurement gap. The rest is ongoing measurement work that doesn't belong in a static audit.

---

## Marketing-route regression check (specific to the user's brief)

The app-shell redesign + marketing-chrome split (9b86a25) only modified `app/layout.tsx` to conditionally hide `<SiteHeader />` and `<SiteFooter />` for `/app/*`. Live verification:

- `GET /` → 200, `<link rel="canonical" href="https://dividendmapper.com"/>` present, SiteHeader visible.
- `GET /pricing` → 200, SiteHeader visible (canonical absent — pre-existing, see C1).
- `GET /blog` → 200, SiteHeader visible, canonical to `/blog`.
- `GET /opengraph-image` → 200, image/png, 168114 bytes.
- `GET /sitemap.xml` → 200, 18.4KB.
- `GET /robots.txt` → 200, 121 bytes.

**No SEO regression from the chrome split.** Marketing chrome still renders on every non-`/app/*` route. Canonicals unchanged. OG image route still serving.
