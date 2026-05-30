"use client";

export interface ConcentrationWarningProps {
  overweight: { ticker: string; weight: number }[];
  threshold: number;
}

export function ConcentrationWarning({
  overweight,
  threshold,
}: ConcentrationWarningProps) {
  if (overweight.length === 0) return null;

  const thresholdPct = Math.round(threshold * 100);

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-foreground dark:border-amber-400/20 dark:bg-amber-900/20"
    >
      <p className="font-display text-sm font-semibold">Concentration check</p>
      <p className="mt-0.5 text-muted-foreground">
        {overweight.length === 1 ? (
          <>
            <span className="font-mono">{overweight[0].ticker}</span> is{" "}
            {Math.round(overweight[0].weight * 100)}% of your portfolio&apos;s
            value. A single holding above {thresholdPct}% raises how much your
            income and capital ride on one company. Worth a look when you next
            add funds.
          </>
        ) : (
          <>
            {overweight.map((p, i) => (
              <span key={p.ticker}>
                {i > 0 && i < overweight.length - 1 && ", "}
                {i > 0 && i === overweight.length - 1 && " and "}
                <span className="font-mono">{p.ticker}</span> (
                {Math.round(p.weight * 100)}%)
              </span>
            ))}{" "}
            each exceed {thresholdPct}% of your portfolio&apos;s value. Holdings
            above that share raise how much your income and capital ride on a
            single company. Worth a look when you next add funds.
          </>
        )}
      </p>
    </div>
  );
}
