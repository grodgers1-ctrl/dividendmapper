import type { Metadata } from "next";
import Link from "next/link";
import { POSTS, formatPublishedDate } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "UK dividend investing guides and calculator explainers",
  description:
    "Plain-English UK dividend investing guides covering tax, retirement income planning, platform fees, dividend trackers, and calculator walkthroughs.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "DividendMapper: UK dividend investing guides and calculator explainers",
    description:
      "Plain-English UK dividend investing guides on tax, retirement income planning, platform fees, dividend trackers, and calculator walkthroughs.",
    url: "/blog",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "DividendMapper blog: UK dividend investing guides and calculator explainers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image"],
  },
};

// Slugs surfaced above the chronological grid. Ordered to match the
// tracker-intent cluster Google already routes traffic to.
const FEATURED_SLUGS = [
  "dividend-tracker-guide-uk-income-investors",
  "portfolio-tracking-dividend-income-uk-investors",
  "sharesight-vs-dividendmapper-uk-income-investors",
  "retirement-income-calculator-guide",
];

export default function BlogIndexPage() {
  // Newest posts first. Stable secondary sort by slug so equal-date posts
  // don't reshuffle between renders.
  const posts = [...POSTS].sort((a, b) => {
    const cmp = b.publishedAt.localeCompare(a.publishedAt);
    return cmp !== 0 ? cmp : a.slug.localeCompare(b.slug);
  });

  const featuredSet = new Set(FEATURED_SLUGS);
  const featured = FEATURED_SLUGS
    .map((slug) => posts.find((p) => p.slug === slug))
    .filter((p): p is (typeof posts)[number] => Boolean(p));
  const rest = posts.filter((post) => !featuredSet.has(post.slug));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:px-6 md:py-16">
      <header className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          Guides
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          UK dividend investing guides and calculator explainers
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
          Plain-English UK dividend tax guides, retirement-income explainers,
          platform-fee comparisons, dividend-tracker walkthroughs, and
          calculator support content. Worked examples, tool-linked follow-ons,
          and no fluff.
        </p>
      </header>

      {featured.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-foreground md:text-2xl">
              Start here
            </h2>
            <p className="text-xs font-medium uppercase tracking-wider text-brand-700 dark:text-brand-400">
              Most common starting points
            </p>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            If you are new here, these four cover what a dividend tracker is,
            how to manage a portfolio across wrappers, how we compare to
            Sharesight, and how to project retirement income.
          </p>
          <ul className="mt-6 grid gap-5 md:grid-cols-2">
            {featured.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block h-full rounded-xl border border-brand-500/30 bg-brand-500/5 p-6 transition-all duration-200 hover:border-brand-500 md:hover:-translate-y-0.5 md:hover:shadow-sm md:hover:shadow-brand-500/10"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <h3 className="mt-3 font-display text-xl font-semibold leading-tight text-foreground transition-colors group-hover:text-brand-700 dark:group-hover:text-brand-400">
                    {post.title}
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {post.description}
                  </p>

                  <div className="mt-4 flex items-center gap-x-3 text-xs text-muted-foreground">
                    <time dateTime={post.publishedAt}>
                      {formatPublishedDate(post.publishedAt)}
                    </time>
                    <span aria-hidden>·</span>
                    <span>{post.readingTime} read</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rest.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold text-foreground md:text-2xl">
            All guides
          </h2>
          <ul className="mt-6 grid gap-5 md:grid-cols-2">
            {rest.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block h-full rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-brand-500 md:hover:-translate-y-0.5 md:hover:shadow-sm md:hover:shadow-brand-500/10"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <h3 className="mt-3 font-display text-xl font-semibold leading-tight text-foreground transition-colors group-hover:text-brand-700 dark:group-hover:text-brand-400">
                    {post.title}
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {post.description}
                  </p>

                  <div className="mt-4 flex items-center gap-x-3 text-xs text-muted-foreground">
                    <time dateTime={post.publishedAt}>
                      {formatPublishedDate(post.publishedAt)}
                    </time>
                    <span aria-hidden>·</span>
                    <span>{post.readingTime} read</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-12 text-center text-sm text-muted-foreground">
        More guides land alongside the Phase 2 launch.{" "}
        <Link
          href="/waitlist"
          className="text-brand-600 underline decoration-brand-600/40 underline-offset-2 hover:text-brand-700 hover:decoration-brand-600"
        >
          Join the waitlist
        </Link>{" "}
        to get the next one in your inbox.
      </p>
    </div>
  );
}
