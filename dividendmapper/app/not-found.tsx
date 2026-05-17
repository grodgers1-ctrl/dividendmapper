import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center md:px-6 md:py-32 lg:px-8">
      <span className="font-mono text-sm font-medium uppercase tracking-wider text-brand-600 dark:text-brand-400">
        404 — page not found
      </span>

      <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
        That page is off the map.
      </h1>

      <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
        The page you tried to reach doesn&apos;t exist, or it hasn&apos;t
        shipped yet. Calculators are live and Phase 2 (portfolio tracking)
        lands 22 May.
      </p>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-600 px-5 text-base font-medium text-white transition-colors hover:bg-brand-700"
        >
          Back to home
        </Link>
        <Link
          href="/tools/retirement-calculator"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-5 text-base font-medium text-foreground transition-colors hover:border-brand-500 hover:bg-secondary"
        >
          Retirement calculator
        </Link>
      </div>
    </div>
  );
}
