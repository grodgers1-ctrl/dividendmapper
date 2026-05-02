import Link from "next/link";
import { LocalisedHero } from "@/components/localised-hero";

export default function HomePage() {
  return (
    <div className="bg-background">
      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Phase 1 — building in public
          </span>

          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Map every{" "}
            <span className="text-brand-600 dark:text-brand-400">dividend</span>{" "}
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
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 md:grid-cols-3 md:px-6 lg:px-8">
          <FeatureCard
            title="Retirement income calculator"
            description="Project your dividend income at retirement across 3 scenarios (Bear / Base / Bull). UK ISA + SIPP + State Pension, or US 401(k) + IRA + Social Security."
          />
          <FeatureCard
            title="Dividend DCF calculator"
            description="Value any dividend stock with a 2-stage Dividend Discount Model. Sensitivity tables, margin of safety, and probability-weighted intrinsic value."
          />
          <FeatureCard
            title="UK & US first-class"
            description="Toggle between UK and US in the header. Tax wrappers, allowances, retirement ages, and currency all switch instantly. No assumptions about which side of the Atlantic you live on."
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="font-display text-lg font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
