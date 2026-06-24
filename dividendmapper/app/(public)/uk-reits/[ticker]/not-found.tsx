import Link from "next/link";

// Friendly 404 for /uk-reits/[ticker] misses. UK REIT universe is the
// hand-classified 25-ticker set in uk-reit-classification.json.
export default function UkReitNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center md:px-6 md:py-28 lg:px-8">
      <span className="font-mono text-sm font-medium uppercase tracking-wider text-brand-600 dark:text-brand-400">
        Not in coverage
      </span>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        That UK REIT is not in the V1 universe
      </h1>
      <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
        We score a hand-classified list of LSE-listed REITs in V1. Browse the universe, or
        read how the score works.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/uk-reits"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-600 px-5 text-base font-medium text-white transition-colors hover:bg-brand-700"
        >
          Browse all UK REITs
        </Link>
        <Link
          href="/methodology/income-vehicles#uk-reits"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-5 text-base font-medium text-foreground transition-colors hover:border-brand-500 hover:bg-secondary"
        >
          How scoring works
        </Link>
      </div>
    </div>
  );
}
