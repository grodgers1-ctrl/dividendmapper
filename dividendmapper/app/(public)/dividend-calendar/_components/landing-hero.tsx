import Link from "next/link";

export function LandingHero() {
  return (
    <section className="px-6 py-16 text-center">
      <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight text-[var(--text)] sm:text-5xl">
        Know exactly when every dividend lands
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--text-muted)]">
        Past payments, confirmed forecasts, and cadence-projected estimates —
        across every wrapper, in your own currency.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/signup"
          className="rounded-md border border-[var(--brand)] bg-[var(--brand)] px-5 py-2 text-sm font-medium text-white"
        >
          See it with your portfolio
        </Link>
        <a
          href="#demo"
          className="rounded-md border border-[var(--border-subtle)] px-5 py-2 text-sm font-medium text-[var(--text)]"
        >
          Sample portfolio demo
        </a>
      </div>
    </section>
  );
}
