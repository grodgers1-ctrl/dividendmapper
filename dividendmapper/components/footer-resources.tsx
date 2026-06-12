"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale/context";
import { POSTS } from "@/lib/blog/posts";

export function FooterResources() {
  const { config } = useLocale();
  const localePosts = POSTS.filter(
    (p) => p.locale === config.locale || p.locale === "both"
  ).slice(0, 2);

  return (
    <div>
      <h3 className="font-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Resources
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        <li>
          <Link
            href="/blog"
            className="text-foreground transition-colors hover:text-brand-600 dark:hover:text-brand-400"
          >
            Research
          </Link>
        </li>
        {localePosts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="text-foreground transition-colors hover:text-brand-600 dark:hover:text-brand-400"
            >
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
