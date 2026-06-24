import Link from "next/link";

// Friendly 404 for /reits/[ticker] misses. Coverage is locked at ~50 US REITs
// in V1; visitors who guess at tickers outside the universe land here.
// Synchronous (no data fetch) so Next returns a real 404 status, not a 200
// soft-404, on this indexable surface.
export default function ReitNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center md:px-6 md:py-28 lg:px-8">
      <span className="font-mono text-sm font-medium uppercase tracking-wider text-brand-600 dark:text-brand-400">
        Not in coverage
      </span>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        That REIT is not in the V1 universe
      </h1>
      <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
        We score a fixed list of US REITs in V1. Browse the universe, or read how the score
        works.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/reits"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-600 px-5 text-base font-medium text-white transition-colors hover:bg-brand-700"
        >
          Browse all REITs
        </Link>
        <Link
          href="/methodology/income-vehicles#us-reits"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-5 text-base font-medium text-foreground transition-colors hover:border-brand-500 hover:bg-secondary"
        >
          How scoring works
        </Link>
      </div>
    </div>
  );
}
