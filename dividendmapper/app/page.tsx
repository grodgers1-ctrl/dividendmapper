import Link from "next/link";
import { LocalisedHero } from "@/components/localised-hero";

export default function HomePage() {
  return (
    <div className="bg-background">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <FaqSection />
      <FinalCtaSection />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── Hero */

function HeroSection() {
  return (
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
  );
}

/* ─────────────────────────────────────────────────────────── Features */

const FEATURES = [
  {
    title: "Three scenarios — never one",
    href: "/tools/retirement-calculator",
    description:
      "Bear / Base / Bull projections with a probability-weighted average. Single-point retirement projections give false confidence; we show the range so you plan against reality.",
  },
  {
    title: "UK and US, equal-weight",
    href: "/tools/dcf-calculator",
    description:
      "ISA, SIPP, GIA, State Pension on the UK side. 401(k), IRA, Roth IRA, Brokerage, Social Security on the US side. One click in the header flips every input.",
  },
  {
    title: "Dividend-focused valuation",
    href: "/tools/dcf-calculator",
    description:
      "The DCF calculator is a Dividend Discount Model — Gordon Growth and 2-stage DDM. The right valuation method for income-paying stocks, with a sensitivity table for growth × discount rate.",
  },
  {
    title: "Honest about uncertainty",
    href: "/blog",
    description:
      "We tell you when the sensitivity table can&rsquo;t solve a cell (growth ≥ discount rate). We surface the assumptions that drive each number. We don&rsquo;t pretend a 30-year projection is precise to the pound.",
  },
  {
    title: "Browser-only — no data exits",
    href: "/blog",
    description:
      "Calculator inputs live in your browser. No accounts, no telemetry on your figures, no &ldquo;send us your portfolio.&rdquo; Phase 2&rsquo;s saved-portfolio features will be opt-in and explicit.",
  },
  {
    title: "Open about the roadmap",
    href: "/waitlist",
    description:
      "The full Phase 1–6 plan is on the waitlist page. Trading 212 sync arrives Phase 3, US brokers via SnapTrade in Phase 4. We say what&rsquo;s shipping and when.",
  },
];

function FeaturesSection() {
  return (
    <section className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Built for dividend investors who want the math to be right.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
            Most retirement tools paper over uncertainty with a single
            confident number. Most stock screeners ignore tax wrappers
            entirely. DividendMapper does neither.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="group rounded-xl border border-border bg-background p-6 transition-colors hover:border-brand-500"
            >
              <h3 className="font-display text-lg font-semibold text-foreground">
                {f.title}
              </h3>
              <p
                className="mt-2 text-sm leading-relaxed text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: f.description }}
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── How it works */

const STEPS = [
  {
    label: "Pick your locale",
    body:
      "Click the UK or US flag in the header. Currency, tax wrappers, retirement age, contribution limits, and the State Pension / Social Security defaults all flip to your jurisdiction.",
  },
  {
    label: "Enter your numbers",
    body:
      "Use the defaults to start. Set your real portfolio value, monthly contribution, expected return, dividend yield, and target monthly retirement income. Sliders update results in real time.",
  },
  {
    label: "See the range, not just a single number",
    body:
      "Every projection shows three scenarios — Bear, Base, Bull — alongside a probability-weighted average. You see how sensitive the answer is to your inputs, not a false single point.",
  },
];

function HowItWorksSection() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            Three steps, no signup, free forever.
          </p>
        </div>

        <ol className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.label}
              className="rounded-xl border border-border bg-card p-6"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 font-mono text-sm font-semibold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                {step.label}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── FAQ */

const FAQS = [
  {
    q: "Is DividendMapper free?",
    a: "All Phase 1 calculators are free forever — no signup, no credit card. Pro features (auto-syncing your portfolio from Trading 212 and US brokers) launch in Phase 2 at £15/month, with a free tier that includes manual portfolio entry.",
  },
  {
    q: "Do I need to create an account to use the calculators?",
    a: "No. The calculators run entirely in your browser. No data leaves your machine. Accounts come in Phase 2 for saving holdings and getting dividend payment notifications, and they&rsquo;ll be opt-in.",
  },
  {
    q: "UK or US — which is the focus?",
    a: "Both are first-class. The UK/US toggle in the header flips every input, label, and tax wrapper. ISA, SIPP, and GIA on the UK side; 401(k), IRA, Roth IRA, and Brokerage on the US side. Default to UK for new users; we auto-detect from your browser language too.",
  },
  {
    q: "How is the Dividend DCF different from a regular DCF?",
    a: "It&rsquo;s a Dividend Discount Model (DDM) — the right valuation method for income-paying stocks. We use &ldquo;DCF&rdquo; in the URL because that&rsquo;s what investors search for, but the underlying math is pure dividend-stream PV (Gordon Growth Model and 2-stage DDM). A tooltip in the calculator explains the distinction.",
  },
  {
    q: "What broker integrations are coming?",
    a: "Trading 212 (UK ISA + SIPP + GIA) is first, in Phase 3 / Month 4. US brokers — Schwab, Fidelity, Robinhood, Vanguard US, Interactive Brokers — follow in Phase 4 via SnapTrade. We deliberately skipped Plaid because of its $500/month minimum that doesn&rsquo;t match a £15/mo product.",
  },
  {
    q: "Is this financial advice?",
    a: "No. DividendMapper provides illustrative tools only. Calculations are based on the inputs you provide and don&rsquo;t account for your full circumstances, inflation, sequence-of-returns risk, or future tax changes. Consult a qualified adviser before making investment decisions.",
  },
];

function FaqSection() {
  return (
    <section className="border-t border-border bg-card">
      <div className="mx-auto max-w-3xl px-4 py-16 md:px-6 md:py-20 lg:px-8">
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Frequently asked questions
        </h2>

        <dl className="mt-10 space-y-8">
          {FAQS.map((item) => (
            <div key={item.q}>
              <dt className="font-display text-base font-semibold text-foreground md:text-lg">
                {item.q}
              </dt>
              <dd
                className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base"
                dangerouslySetInnerHTML={{ __html: item.a }}
              />
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── Final CTA */

function FinalCtaSection() {
  return (
    <section className="relative isolate overflow-hidden border-t border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[360px] bg-[radial-gradient(50%_60%_at_50%_70%,rgba(14,168,116,0.12)_0%,rgba(14,168,116,0)_70%)] dark:bg-[radial-gradient(50%_60%_at_50%_70%,rgba(52,211,153,0.10)_0%,rgba(52,211,153,0)_70%)]"
      />
      <div className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6 md:py-24 lg:px-8">
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Get the launch email.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
          We&rsquo;ll email you when the Phase 1 calculators go live (Day 10),
          and again when Trading 212 sync opens up. No drip sequence. Unsubscribe
          one-click.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/waitlist"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-brand-600 px-6 text-base font-medium text-white transition-colors hover:bg-brand-700"
          >
            Join the waitlist
          </Link>
          <Link
            href="/tools/retirement-calculator"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-card px-6 text-base font-medium text-foreground transition-colors hover:border-brand-500 hover:bg-secondary"
          >
            Preview retirement calculator
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── helpers */

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
