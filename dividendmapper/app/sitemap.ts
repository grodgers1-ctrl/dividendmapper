import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { POSTS } from "@/lib/blog/posts";
import { isPricingPublic } from "@/lib/flags/pricing";

export default function sitemap(): MetadataRoute.Sitemap {
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
  ];

  if (isPricingPublic()) {
    entries.push({
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    });
  }

  return entries;
}
