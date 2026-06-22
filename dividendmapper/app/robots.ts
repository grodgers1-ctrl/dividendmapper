import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// AI-crawler stance is declared explicitly rather than relying on the default-
// allow. DividendMapper benefits from being citable by AI search (Perplexity,
// ChatGPT browse, Google AI Overviews, Claude search) — there's no rights
// reason to block. Per SEO-AEO-AUDIT.md R1 (2026-06-22). Revisit if business
// or rights considerations change.
const AI_CRAWLER_AGENTS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/"] },
      ...AI_CRAWLER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/api/"],
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
