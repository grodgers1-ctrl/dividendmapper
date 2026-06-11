import Link from "next/link";
import { HeroSection } from "@/components/hero-section";

export default function HomePage() {
  return (
    <div className="bg-background">
      <HeroSection />
      <FeaturesSection />
      <ProofSection />
      <HowItWorksSection />
      <FaqSection />
      <FinalCtaSection />
    </div>
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
      "If a sensitivity cell can&rsquo;t be solved (growth ≥ discount), it shows &ldquo;&mdash;&rdquo; instead of NaN. Every output cites the assumption behind it. We don&rsquo;t pretend a 30-year forecast is precise to the pound.",
  },
  {
    title: "Calculators stay in your browser",
    href: "/blog",
    description:
      "Calculator inputs never leave the page. No account, no analytics on your numbers, no &ldquo;send us your portfolio.&rdquo; Signed-in portfolio tracking is opt-in and lives behind your own login.",
  },
  {
    title: "Roadmap on the table",
    href: "/waitlist",
    description:
      "Calculators landed in Phase 1. Portfolio tracking and the Pro tier are live in Phase 2. Trading 212 sync follows in Phase 3, US brokers via SnapTrade in Phase 4. Dates and order, on one page.",
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

/* ─────────────────────────────────────────────────────────── Proof */

const PROOF_CARDS = [
  {
    title: "Quality score",
    headline: "2.5x",
    body: 'Top-quartile Quality names returned <span class="font-medium text-foreground">+4.87%</span> over the next 3 months vs <span class="font-medium text-foreground">+1.97%</span> for the bottom quartile (1,105 observations). Used as a resilience screen on what you already own, not a market-timing buy signal.',
  },
  {
    title: "Trim score",
    headline: "2.8x",
    body: 'Least-stretched Trim bucket returned <span class="font-medium text-foreground">+7.04%</span> over the next 3 months vs <span class="font-medium text-foreground">+2.49%</span> baseline. Most-stretched UK bucket went negative (<span class="font-medium text-foreground">-0.9%</span>, 140 UK obs). Used as a contribution brake, not a sell signal.',
  },
  {
    title: "Reinvest Recommender",
    headline: "£73k",
    body: 'Pro Quality-weighted contributions finished at <span class="font-medium text-foreground">£560,000</span> over 15 years vs <span class="font-medium text-foreground">£487,000</span> equal-weight. £80,000 start, £400/mo, 13-stock US basket. Microsoft did most of the heavy lifting; different basket, different headline.',
  },
];

function ProofSection() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Proof, not promises.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
            We backtested the Quality, Trim and Reinvest scoring across 4,680
            monthly observations of US and UK dividend payers (2010 to 2024).
            Every number below is reproducible from the repo.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PROOF_CARDS.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-border bg-card p-6"
            >
              <h3 className="font-display text-lg font-semibold text-foreground">
                {card.title}
              </h3>
              <p className="mt-3 font-display text-3xl font-bold text-brand-600 dark:text-brand-400">
                {card.headline}
              </p>
              <p
                className="mt-3 text-sm leading-relaxed text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: card.body }}
              />
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          28-ticker basket. 2010 to 2024 is a US large-cap growth supercycle:
          different basket, different period, different headline. Survivorship
          bias real. Methodology and CSVs published; reproduce with{" "}
          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">
            npm run analyst:event-study
          </code>
          .
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            href="/scoring"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            See the public scores
            <span aria-hidden>→</span>
          </Link>
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
    a: "Calculators are free forever. No signup, no credit card. Pro is £15 a month for unlimited holdings and projected income; the Free tier keeps up to 10 manual holdings. Broker auto-sync lands in Phase 3.",
  },
  {
    q: "Do I need an account to use the calculators?",
    a: "No. The calculators run in your browser; nothing is sent anywhere. Sign-in is now live for the portfolio side: add holdings by hand, see real projected dividend income, keep your numbers across visits. Calculators stay anonymous.",
  },
  {
    q: "UK or US, which is the focus?",
    a: "Both. The toggle in the header flips every label, currency and tax wrapper. ISA, SIPP and GIA on the UK side; 401(k), IRA, Roth and Brokerage on the US side. UK is the default for new visitors, and we also auto-detect from your browser language.",
  },
  {
    q: "How is the Dividend DCF different from a regular DCF?",
    a: "It is a Dividend Discount Model (DDM), the species of DCF designed for income stocks. You value the stock by discounting its future dividends instead of its free cash flow. The math is the Gordon Growth Model and a 2-stage DDM, with an in-tool tooltip explaining the difference.",
  },
  {
    q: "What broker integrations are coming?",
    a: "Trading 212 first, in Phase 3 (around Month 4), covering UK ISA, SIPP and GIA in one connection. Schwab, Fidelity, Robinhood, Vanguard US and Interactive Brokers follow in Phase 4 through SnapTrade. We skipped Plaid; their $500-a-month minimum doesn&rsquo;t fit a low-priced consumer product.",
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
          Start tracking your dividends.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Free, no card. Up to 10 holdings on the Free tier, or upgrade to Pro
          for weekly Buy, Trim and Risk scores on every position.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-brand-600 px-6 text-base font-medium text-white transition-colors hover:bg-brand-700"
          >
            Start for free
          </Link>
          <Link
            href="/tools/retirement-calculator"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-card px-6 text-base font-medium text-foreground transition-colors hover:border-brand-500 hover:bg-secondary"
          >
            Try the retirement calculator
          </Link>
        </div>
      </div>
    </section>
  );
}

