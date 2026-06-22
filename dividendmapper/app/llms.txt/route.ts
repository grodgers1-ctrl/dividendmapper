import { POSTS, formatPublishedDate } from "@/lib/blog/posts";
import { SITE_URL } from "@/lib/site";
import { isPricingPublic } from "@/lib/flags/pricing";

// Refresh on the same cadence as the sitemap so blog additions surface quickly.
export const revalidate = 3600;

// llms.txt — a human-readable summary of the site's content and structure for
// LLM-powered search engines (ChatGPT browse, Perplexity, Claude search). Spec
// at https://llmstxt.org. Sparse adoption today but rising; cheap to publish.
// Per SEO-AEO-AUDIT.md nice-to-have (2026-06-22).
export async function GET(): Promise<Response> {
  const sortedPosts = [...POSTS].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );

  const sections: string[] = [];

  sections.push("# DividendMapper");
  sections.push("");
  sections.push(
    "> Free dividend portfolio tools and resilience scoring for UK and US investors. Track ISA, SIPP, GIA, 401(k), IRA and taxable holdings. Quality / Trim / Risk scores on every position. Retirement income and DCF (dividend-discount) calculators.",
  );
  sections.push("");

  sections.push("## Core pages");
  sections.push("");
  sections.push(
    `- [Homepage](${SITE_URL}/): What DividendMapper does, who it is for, and how the tier and broker integrations work.`,
  );
  sections.push(
    `- [Retirement Calculator](${SITE_URL}/tools/retirement-calculator): UK (ISA, SIPP, GIA) and US (401(k), IRA, Roth, brokerage) retirement income projections with Bear / Base / Bull scenarios.`,
  );
  sections.push(
    `- [DCF Calculator](${SITE_URL}/tools/dcf-calculator): Dividend Discount Model valuation (Gordon Growth and 2-stage DDM) tuned for income stocks.`,
  );
  sections.push(
    `- [Resilience Scoring](${SITE_URL}/scoring): Public Quality / Trim / Risk scoring pages per ticker, with methodology breakdown.`,
  );
  if (isPricingPublic()) {
    sections.push(
      `- [Pricing](${SITE_URL}/pricing): Free + Pro tiers. Pro lifts the 10-holding cap, scores every holding nightly, sends threshold alert emails, and ships broker sync in 2026.`,
    );
  }
  sections.push(`- [Blog](${SITE_URL}/blog): UK dividend investing guides.`);
  sections.push("");

  sections.push("## Blog posts");
  sections.push("");
  for (const post of sortedPosts) {
    const date = formatPublishedDate(post.updatedAt ?? post.publishedAt);
    sections.push(
      `- [${post.title}](${SITE_URL}/blog/${post.slug}) (${date}): ${post.description}`,
    );
  }
  sections.push("");

  sections.push("## About the data");
  sections.push("");
  sections.push(
    "DividendMapper publishes original resilience scores combining payout ratio, dividend cover, free cash flow, leverage, earnings revisions, and a no-dividend-cut history check. Methodology is documented and weights are tuned monthly. Scores are informational, not financial advice.",
  );

  return new Response(sections.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
