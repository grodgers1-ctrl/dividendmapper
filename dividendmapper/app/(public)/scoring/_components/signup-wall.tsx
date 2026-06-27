import Link from "next/link";

interface Props {
  ticker: string;
}

export function SignupWall({ ticker }: Props) {
  const next = encodeURIComponent(`/scoring/${ticker}`);
  return (
    <div className="rounded-xl border border-brand-500/30 bg-brand-50 p-8 text-center dark:border-brand-400/20 dark:bg-brand-900/20">
      <p className="font-display text-xl font-bold text-foreground">
        You&rsquo;ve used your two free scores today.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Sign up free to keep going. No card, no commitment. Your counter resets
        the moment you sign in.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`/login?next=${next}`}
          className="inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Sign up free
        </Link>
        <Link
          href={`/login?next=${next}`}
          className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
        >
          I&rsquo;m already a member
        </Link>
      </div>
    </div>
  );
}
