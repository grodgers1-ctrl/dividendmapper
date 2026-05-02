import Link from "next/link";

interface ComingSoonProps {
  title: string;
  shipDay: number; // 1-10 sprint day
  blurb: string;
  bullets?: string[];
}

export function ComingSoon({ title, shipDay, blurb, bullets }: ComingSoonProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 md:px-6 md:py-28 lg:px-8">
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
        Ships Day {shipDay} of the Phase 1 sprint
      </span>

      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        {title}
      </h1>

      <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
        {blurb}
      </p>

      {bullets && bullets.length > 0 && (
        <ul className="mt-6 space-y-2 text-sm text-foreground">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:border-brand-500 hover:bg-secondary"
        >
          ← Back to home
        </Link>
        <Link
          href="/waitlist"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Get notified at launch
        </Link>
      </div>
    </div>
  );
}
