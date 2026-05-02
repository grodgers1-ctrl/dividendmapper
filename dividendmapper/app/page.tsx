import Link from "next/link";
import { LocalisedHero } from "@/components/localised-hero";

export default function HomePage() {
  return (
    <div className="bg-background">
      {/* Hero — subtle radial wash behind the headline keeps brand colour
          present without competing with content */}
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-32 -z-10 h-[420px] bg-[radial-gradient(50%_60%_at_50%_40%,rgba(14,168,116,0.10)_0%,rgba(14,168,116,0)_70%)] dark:bg-[radial-gradient(50%_60%_at_50%_40%,rgba(52,211,153,0.10)_0%,rgba(52,211,153,0)_70%)]"
        />
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Phase 1 — building in public
            </span>

            <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
              Map every{" "}
              <span className="text-brand-600 dark:text-brand-400">
                dividend
              </span>{" "}
              in your portfolio.
            </h1>

            <LocalisedHero />

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/tools/retirement-calculator"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-brand-600 px-6 text-base font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Retirement calculator
              </Link>
              <Link
                href="/waitlist"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-card px-6 text-base font-medium text-foreground transition-colors hover:border-brand-500 hover:bg-secondary"
              >
                Join the waitlist
              </Link>
            </div>

            {/* Trust pills — concrete, no fake "Trusted by N investors" */}
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
              <li className="inline-flex items-center gap-1.5">
                <CheckDot />
                Free — no signup, no credit card
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckDot />
                UK and US tax wrappers
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckDot />
                Calculations stay in your browser
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 md:grid-cols-3 md:px-6 md:py-16 lg:px-8">
          <FeatureCard
            title="Retirement income calculator"
            description="Project your dividend income at retirement across 3 scenarios (Bear / Base / Bull). UK ISA + SIPP + State Pension, or US 401(k) + IRA + Social Security."
            href="/tools/retirement-calculator"
          />
          <FeatureCard
            title="Dividend DCF calculator"
            description="Value any dividend stock with a 2-stage Dividend Discount Model. Sensitivity tables, margin of safety, and probability-weighted intrinsic value."
            href="/tools/dcf-calculator"
          />
          <FeatureCard
            title="UK & US first-class"
            description="Toggle between UK and US in the header. Tax wrappers, allowances, retirement ages, and currency all switch instantly. No assumptions about which side of the Atlantic you live on."
            href="/blog"
          />
        </div>
      </section>
    </div>
  );
}

function CheckDot() {
  return (
    <span
      aria-hidden
      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-400"
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
        <path
          d="M2.5 6.5L5 9L9.5 3.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function FeatureCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-brand-500"
    >
      <h2 className="font-display text-lg font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 transition-transform group-hover:translate-x-0.5 dark:text-brand-400">
        Learn more
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className="h-3.5 w-3.5"
          fill="none"
        >
          <path
            d="M3 8h10m0 0L9 4m4 4l-4 4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </Link>
  );
}
