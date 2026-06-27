import Link from "next/link";

interface Props {
  secondsLeft: number;
}

export function FreeCountdown({ secondsLeft }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <p className="font-display text-lg font-semibold text-foreground">
        Next score available in {secondsLeft}s
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Free accounts can score two shares per minute. Pro lifts the limit and
        applies scores automatically to every holding in your portfolio and
        watchlist.
      </p>
      <Link
        href="/pricing"
        className="mt-5 inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        See Pro
      </Link>
    </div>
  );
}
