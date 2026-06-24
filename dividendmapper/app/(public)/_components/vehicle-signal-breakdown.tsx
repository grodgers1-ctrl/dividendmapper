"use client";

// Shared per-signal breakdown UI for the Resilience score. Pure render: takes
// signals + renders Q/D/C/R bars. Used by:
//   - VehicleProDetail on /reits/[ticker], /bdcs/[ticker], /uk-reits/[ticker]
//     (after the tier-gate fetch confirms the viewer is Pro).
//   - The /app/portfolio score drawer, where the viewer is known-Pro and the
//     tier gate would be a wasted fetch.

export type VehicleSignalRow = {
  code: string;
  humanLabel: string;
  rawScore: number | null;
  weight: number;
  contribution: number;
};

const CATEGORY_GROUPS: { prefix: "Q" | "D" | "C" | "R"; label: string }[] = [
  { prefix: "Q", label: "Quality" },
  { prefix: "D", label: "Discount" },
  { prefix: "C", label: "Concentration" },
  { prefix: "R", label: "Risk" },
];

const BAR_COLOR: Record<string, string> = {
  Q: "#0ea5e9",
  D: "#8b5cf6",
  C: "#f59e0b",
  R: "#e11d48",
};

export function VehicleSignalBreakdown({
  signals,
}: {
  signals: VehicleSignalRow[];
}) {
  return (
    <div className="space-y-6">
      {CATEGORY_GROUPS.map(({ prefix, label }) => {
        const group = signals.filter((s) => s.code.startsWith(`${prefix}_`));
        if (group.length === 0) return null;
        const max = Math.max(1, ...group.map((s) => Math.abs(s.contribution)));
        const accent = BAR_COLOR[prefix];
        return (
          <div key={prefix}>
            <h3 className="text-sm font-medium text-foreground">{label}</h3>
            <ul className="mt-2 space-y-2">
              {group.map((s) => {
                const pct = Math.round((Math.abs(s.contribution) / max) * 100);
                return (
                  <li key={s.code}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span data-testid="vehicle-signal-label" className="text-foreground">
                        {s.humanLabel}
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {s.rawScore === null ? "—" : Math.round(s.rawScore)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: accent }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
