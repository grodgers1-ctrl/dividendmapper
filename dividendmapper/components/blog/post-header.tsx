import Link from "next/link";
import { requirePost, formatPublishedDate } from "@/lib/blog/posts";

interface PostHeaderProps {
  slug: string;
}

/**
 * Per-post header strip rendered above the MDX body. Owns the visible h1, the
 * publication date / reading time line, and the JSON-LD structured data —
 * keeps each .mdx file focused on prose.
 */
export function PostHeader({ slug }: PostHeaderProps) {
  const post = requirePost(slug);
  const updatedAt = post.updatedAt ?? post.publishedAt;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: updatedAt,
    author: {
      "@type": "Organization",
      name: "DividendMapper",
      url: "https://dividendmapper.com",
    },
    publisher: {
      "@type": "Organization",
      name: "DividendMapper",
      logo: {
        "@type": "ImageObject",
        url: "https://dividendmapper.com/icon.png",
      },
    },
    mainEntityOfPage: `https://dividendmapper.com/blog/${slug}`,
  };

  return (
    <header className="mb-8">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="flex flex-wrap gap-2">
        {post.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>

      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
        {post.title}
      </h1>

      <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
        {post.description}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <time dateTime={post.publishedAt}>
          {formatPublishedDate(post.publishedAt)}
        </time>
        <span aria-hidden>·</span>
        <span>{post.readingTime} read</span>
        {post.updatedAt && post.updatedAt !== post.publishedAt && (
          <>
            <span aria-hidden>·</span>
            <span>
              Updated {formatPublishedDate(post.updatedAt)}
            </span>
          </>
        )}
      </div>
    </header>
  );
}

interface PostFooterProps {
  /** Where to point the "next" CTA — typically a calculator or another post. */
  nextHref?: string;
  nextLabel?: string;
}

/**
 * Bottom-of-post strip with disclaimers, a "back to all guides" link, and an
 * optional "what to read or do next" CTA. Each MDX file ends with this.
 */
export function PostFooter({ nextHref, nextLabel }: PostFooterProps) {
  return (
    <footer className="mt-12 border-t border-border pt-8">
      {nextHref && nextLabel && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-700 dark:text-brand-400">
            What to do next
          </p>
          <Link
            href={nextHref}
            className="mt-2 block font-display text-lg font-semibold text-foreground transition-colors hover:text-brand-700 md:text-xl"
          >
            {nextLabel} →
          </Link>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link
          href="/blog"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          ← All guides
        </Link>
        <Link
          href="/pricing"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          See pricing
        </Link>
      </div>
    </footer>
  );
}
