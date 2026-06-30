import type { EtfBundle } from "@/lib/etf/load-etf-bundle";

// Inlined per project convention — see feedback_duplicate_over_share_roadmap_boundary.
// The 4 vehicle-scoring components keep their own copy too.
function rampColor(score: number): string {
  if (score < 25) return "var(--color-resilience-1)";
  if (score < 50) return "var(--color-resilience-2)";
  if (score < 75) return "var(--color-resilience-3)";
  if (score < 90) return "var(--color-resilience-4)";
  return "var(--color-resilience-5)";
}

function Pillar({
  label,
  score,
  sub,
}: {
  label: string;
  score: number | null;
  sub: string;
}) {
  const color = score == null ? "var(--text-muted)" : rampColor(score);
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-2 font-mono text-3xl tabular-nums" style={{ color }}>
        {score ?? "—"}
      </div>
      <div className="mt-1 text-xs text-text-muted">{sub}</div>
    </div>
  );
}

export function EtfQualityBreakdown({ facts }: { facts: EtfBundle["facts"] }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-text-muted">
        Income Quality
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Pillar
          label="Cost"
          score={facts?.quality_cost ?? null}
          sub="TER vs UCITS peers"
        />
        <Pillar
          label="Process"
          score={facts?.quality_process ?? null}
          sub="AUM and fund age"
        />
        <Pillar
          label="Income"
          score={facts?.quality_income ?? null}
          sub="Distribution, cadence, yield stability"
        />
      </div>
    </section>
  );
}
