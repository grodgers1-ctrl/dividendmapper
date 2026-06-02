import Link from "next/link";
import { MissingTicker } from "./_components/missing-ticker";

// Friendly 404 for /scoring/[ticker] misses. The search offers the whole
// market but only a handful of shares are scored, so an uncovered pick lands
// here instead of the generic site 404.
//
// Deliberately SYNCHRONOUS (no data fetch): an async not-found streams its
// response, and Next returns 200 for streamed responses (a soft-404). Keeping
// it non-streaming guarantees a real 404 status (Next then injects noindex) on
// this public, indexable surface. The covered-share list lives one click away
// on /scoring, so we link there rather than fetch it here.
export default function ScoringNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center md:px-6 md:py-28 lg:px-8">
      <span className="font-mono text-sm font-medium uppercase tracking-wider text-brand-600 dark:text-brand-400">
        Not scored yet
      </span>

      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        We haven&apos;t scored{" "}
        <span className="font-mono">
          <MissingTicker />
        </span>{" "}
        yet
      </h1>

      <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
        Coverage is expanding. We don&apos;t have a dividend-resilience score for this share
        yet. Browse the shares we score today, or read how the scores work.
      </p>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/scoring"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-600 px-5 text-base font-medium text-white transition-colors hover:bg-brand-700"
        >
          Browse scored shares
        </Link>
        <Link
          href="/scoring-methodology"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-5 text-base font-medium text-foreground transition-colors hover:border-brand-500 hover:bg-secondary"
        >
          How scoring works
        </Link>
      </div>
    </div>
  );
}
