// Day 14 placeholder. Day 19 replaces this with an SVG 4-axis radar.

interface Props {
  q: number | null;
  d: number | null;
  c: number | null;
  r: number | null;
}

const ROWS: { key: keyof Props; label: string }[] = [
  { key: "q", label: "Quality" },
  { key: "d", label: "Discount" },
  { key: "c", label: "Concentration" },
  { key: "r", label: "Risk" },
];

export function ResilienceSpider(props: Props) {
  return (
    <ul role="img" aria-label="Resilience category breakdown" className="space-y-2">
      {ROWS.map(({ key, label }) => {
        const value = props[key];
        const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
        return (
          <li key={key} className="flex items-center gap-3 text-sm">
            <span className="w-28 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded bg-secondary">
              <div
                className="h-full rounded bg-emerald-500"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
            <span className="w-8 text-right font-mono tabular-nums text-foreground">
              {value === null ? "—" : value}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
