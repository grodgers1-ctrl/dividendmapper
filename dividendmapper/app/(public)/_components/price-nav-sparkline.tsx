// Day 14 placeholder. Day 19 replaces this with an SVG sparkline + ±1σ band.

interface Props {
  history: { observed_at: string; price_nav_ratio: number | null }[];
}

export function PriceNavSparkline({ history }: Props) {
  const valid = history.filter((p) => p.price_nav_ratio !== null);
  if (valid.length < 2) {
    return (
      <p className="text-sm text-muted-foreground" role="img" aria-label="Price/NAV history unavailable">
        Insufficient price history.
      </p>
    );
  }
  const last = valid.at(-1)!;
  const prev = valid[0];
  const delta = (last.price_nav_ratio as number) - (prev.price_nav_ratio as number);
  return (
    <div role="img" aria-label="Price-to-NAV ratio history">
      <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
        {(last.price_nav_ratio as number).toFixed(2)}×
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Current Price / NAV ratio. Δ {delta >= 0 ? "+" : ""}
        {delta.toFixed(2)} over the window ({valid.length} observations).
      </p>
    </div>
  );
}
