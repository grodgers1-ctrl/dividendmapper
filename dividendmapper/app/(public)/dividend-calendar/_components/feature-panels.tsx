export function FeaturePanels() {
  const panels = [
    {
      title: "Projected, not just confirmed",
      body:
        "We detect each holding's pay cadence and project the next 12 months, clearly distinguished from confirmed ex-dates and capped at ±20%/yr growth.",
    },
    {
      title: "Every dividend in one place",
      body:
        "Sync Trading 212, import a CSV, or enter manually. Your dividends, your wrappers, your currency.",
    },
    {
      title: "Tax-wrapper-aware",
      body:
        "ISA / Roth dividends tax-free in your locale, GIA / Brokerage shown net of dividend tax. Surfaced automatically.",
    },
  ];
  return (
    <section className="px-6 py-12">
      <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
        {panels.map((p) => (
          <div key={p.title} className="card-surface p-5">
            <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">{p.title}</h3>
            <p className="text-sm text-[var(--text-muted)]">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
