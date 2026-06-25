const FAQS = [
  {
    q: "How do projections work?",
    a: "We detect each holding's pay cadence (monthly / quarterly / semi-annual / annual) from FMP's historical dividend data, then project the next 12 months at the latest amount, adjusted by 3-year CAGR (capped ±20%/yr). Recent cuts override the growth assumption.",
  },
  {
    q: "Which currencies do you support?",
    a: "GBP and USD as the primary display. Holdings in other currencies convert via daily FX rates.",
  },
  {
    q: "Which brokers can I connect?",
    a: "Trading 212 (Invest + ISA) live today, with CSV import for any broker. Interactive Brokers, HL, AJ Bell, and Freetrade are next.",
  },
  {
    q: "Why do you cap growth at ±20% per year?",
    a: "A single one-off bonus payment or a recently-cut dividend can distort short-period CAGR. The cap keeps projections sensible — if you see a ⚠ on a bar, it means the underlying CAGR hit the limit.",
  },
  {
    q: "What's free vs Pro?",
    a: "Free users get the preview + sample-portfolio demo. Pro unlocks the full /app/calendar surface with your real holdings, wrappers, and numbers.",
  },
];

export function LandingFaq() {
  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-4 text-2xl font-semibold text-[var(--text)]">FAQ</h2>
        <dl className="space-y-4">
          {FAQS.map((f) => (
            <div key={f.q}>
              <dt className="text-sm font-semibold text-[var(--text)]">{f.q}</dt>
              <dd className="mt-1 text-sm text-[var(--text-muted)]">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
