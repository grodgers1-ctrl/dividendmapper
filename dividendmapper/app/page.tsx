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
              className="inline-flex h-12 items-center justify-center rounded-lg bg-brand-600 px-6 text-base font-medium text-white transition-all duration-200 hover:bg-brand-700 md:hover:shadow-md md:hover:shadow-brand-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Retirement calculator
            </Link>
            <Link
              href="/waitlist"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-card px-6 text-base font-medium text-foreground transition-colors duration-200 hover:border-brand-500 hover:bg-secondary"
            >
              Join the waitlist
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <CheckDot />
              Free, no signup
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckDot />
              UK and US tax wrappers built in
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckDot />
              Numbers stay in your browser
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
    title: "Three scenarios, weighted",
    href: "/tools/retirement-calculator",
    description:
      "Bear, Base and Bull projections plus a 25/50/25 weighted average. One number is comforting, but a range is honest, and a 30-year projection has a wide one.",
  },
  {
    title: "UK and US, properly",
    href: "/tools/dcf-calculator",
    description:
      "ISA, SIPP and GIA on the UK side. 401(k), IRA, Roth and Brokerage on the US side. The flag toggle in the header flips every label, currency and contribution limit at once.",
  },
  {
    title: "A DCF that fits dividend stocks",
    href: "/tools/dcf-calculator",
    description:
      "The DCF tab runs a Dividend Discount Model: Gordon Growth or 2-stage DDM. It values a stock by what it actually pays you, with a sensitivity table that shows how growth and discount rate shift the answer.",
  },
  {
    title: "When the math breaks, we say so",
    href: "/blog",
    description:
      "If a sensitivity cell can&rsquo;t be solved (growth ≥ discount), it shows &ldquo;—&rdquo; instead of NaN. Every output cites the assumption behind it. We don&rsquo;t pretend a 30-year forecast is precise to the pound.",
  },
  {
    title: "Everything stays in your browser",
    href: "/blog",
    description:
      "Calculator inputs never leave the page. No account, no analytics on your numbers, no &ldquo;send us your portfolio.&rdquo; When Phase 2 adds a saved-portfolio option, it will be opt-in.",
  },
  {
    title: "Roadmap on the table",
    href: "/waitlist",
    description:
      "The full Phase 1–6 plan lives on the waitlist page. Trading 212 sync lands in Phase 3, US brokers via SnapTrade in Phase 4. You get the dates and the order.",
  },
];

function FeaturesSection() {
  return (
    <section className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Tools that show their work.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
            Retirement calculators give you a single number and call it
            confidence. Stock screeners pretend tax wrappers don&rsquo;t exist.
            We made one tool that handles both, properly.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="group rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-brand-500 md:hover:-translate-y-0.5 md:hover:shadow-sm md:hover:shadow-brand-500/10"
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
      "Tap the UK or US flag at the top. Currency, tax wrappers, contribution limits and pension defaults flip to match your country.",
  },
  {
    label: "Enter your numbers",
    body:
      "Defaults are sensible; tweak the sliders to match your own situation. Portfolio value, monthly contribution, expected return, dividend yield, target retirement income. Outputs recompute as you slide.",
  },
  {
    label: "See the range",
    body:
      "Every projection runs three scenarios (Bear, Base, Bull) plus a weighted average. You see how sensitive the answer is to your assumptions, not just a single confident number.",
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
              className="rounded-xl border border-border bg-card p-6 transition-colors duration-200 md:hover:border-brand-500/50"
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
    a: "Phase 1 calculators are free forever. No signup, no credit card. Pro launches in Phase 2 at £15 a month with broker auto-sync; the free tier will keep manual portfolio entry.",
  },
  {
    q: "Do I need an account to use the calculators?",
    a: "No. The calculators run in your browser; nothing is sent anywhere. Accounts arrive in Phase 2 for saving portfolios and dividend-payment notifications, and they will be opt-in.",
  },
  {
    q: "UK or US, which is the focus?",
    a: "Both. The toggle in the header flips every label, currency and tax wrapper. ISA, SIPP and GIA on the UK side; 401(k), IRA, Roth and Brokerage on the US side. UK is the default for new visitors, and we also auto-detect from your browser language.",
  },
  {
    q: "How is the Dividend DCF different from a regular DCF?",
    a: "It is a Dividend Discount Model (DDM): you value the stock by discounting its future dividends instead of its free cash flow. We use &ldquo;DCF&rdquo; in the URL because that is what people search for. The math is the Gordon Growth Model and a 2-stage DDM, with an in-tool tooltip explaining the difference.",
  },
  {
    q: "What broker integrations are coming?",
    a: "Trading 212 first, in Phase 3 (around Month 4), covering UK ISA, SIPP and GIA in one connection. Schwab, Fidelity, Robinhood, Vanguard US and Interactive Brokers follow in Phase 4 through SnapTrade. We skipped Plaid; their $500-a-month minimum doesn&rsquo;t fit a £15 product.",
  },
  {
    q: "Is this financial advice?",
    a: "No. The calculators are illustrative. They use the numbers you put in, but they don&rsquo;t know your full circumstances, won&rsquo;t model inflation or sequence-of-returns risk, and can&rsquo;t predict tax changes. Talk to a qualified adviser before making investment decisions.",
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
          Two emails, total. One when Phase 1 goes live, one when Trading 212
          sync opens. No drip sequence, one-click unsubscribe.
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
