import type { Metadata } from "next";
import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist-form";

export const metadata: Metadata = {
  title: "Waitlist",
  description:
    "Free dividend calculators are live. Portfolio tracking and the Pro tier launched in Phase 2; broker sync follows in Phase 3. Sign up for the launch email.",
  alternates: { canonical: "/waitlist" },
};

const ROADMAP = [
  {
    when: "Phase 1 (shipped 15 May)",
    label: "Free calculators live",
    body:
      "Retirement income calculator (UK ISA/SIPP/GIA + US 401k/IRA/Brokerage) and Dividend DCF calculator with sensitivity tables. Free forever, no signup.",
  },
  {
    when: "Phase 2 (live)",
    label: "Sign-in, manual portfolio, Pro tier",
    body:
      "Magic-link sign-in (now live), track holdings by hand, projected income per tax wrapper. Free covers up to 10 holdings; Pro is £15 a month for unlimited.",
  },
  {
    when: "Phase 3 (Month 4)",
    label: "Trading 212 integration",
    body:
      "First UK platform to surface T212 ISA + SIPP positions automatically. Live yield, ex-dividend dates, payment calendar.",
  },
];

export default function WaitlistPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-24 lg:px-8 lg:py-28">
      <div className="grid gap-12 md:grid-cols-5 md:gap-16">
        <div className="md:col-span-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Phase 2 · live
          </span>

          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Get the launch email.
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            DividendMapper is being built in the open. Calculators are live;
            sign-in and portfolio tracking are live too. Drop your email and
            we&apos;ll let you know when broker integrations roll out in
            Phase 3. No drip sequences.
          </p>

          <div className="mt-8 max-w-md">
            <WaitlistForm />
          </div>

          <p className="mt-6 max-w-md text-xs text-muted-foreground">
            We use{" "}
            <a
              href="https://supabase.com"
              className="underline hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              Supabase
            </a>{" "}
            (EU region) to store your email. We&apos;ll never share it. You can
            ask us to delete it any time at{" "}
            <a
              href="mailto:hello@dividendmapper.com"
              className="underline hover:text-foreground"
            >
              hello@dividendmapper.com
            </a>
            .
          </p>
        </div>

        <aside className="md:col-span-2">
          <h2 className="font-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Roadmap
          </h2>
          <ol className="mt-4 space-y-5">
            {ROADMAP.map((item, i) => (
              <li key={item.label} className="relative pl-8">
                <span
                  aria-hidden
                  className="absolute left-0 top-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card font-mono text-xs font-medium text-muted-foreground"
                >
                  {i + 1}
                </span>
                <p className="font-display text-sm font-semibold text-foreground">
                  {item.label}
                </p>
                <p className="mt-0.5 font-mono text-xs text-brand-600 dark:text-brand-400">
                  {item.when}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-8 border-t border-border pt-6">
            <Link
              href="/tools/retirement-calculator"
              className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Try the retirement calculator →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
