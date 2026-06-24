// SVG sparkline of price/NAV ratio over the window with a ±1σ shaded band.
// Server-rendered (no client interactivity in V1) so it ships in the static
// HTML and counts toward LCP rather than fighting it.
//
// Data shape comes from loadVehicleScoreHistory — observed_at ASC. We render
// every point if there are enough, fall back to "insufficient history" when
// fewer than 8 observations are available (~2 weeks of daily snapshots is the
// minimum for a meaningful stdev band).

interface Props {
  history: { observed_at: string; price_nav_ratio: number | null }[];
}

const VB_W = 600;
const VB_H = 160;
const PAD_X = 4;
const PAD_TOP = 8;
const PAD_BOTTOM = 24;

function bandStats(values: number[]): { mean: number; stdev: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, stdev: 0 };
  const mean = values.reduce((a, v) => a + v, 0) / n;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
  return { mean, stdev: Math.sqrt(variance) };
}

export function PriceNavSparkline({ history }: Props) {
  const valid = history.filter(
    (p): p is { observed_at: string; price_nav_ratio: number } =>
      p.price_nav_ratio !== null,
  );
  if (valid.length < 8) {
    return (
      <p
        role="img"
        aria-label="Price/NAV history unavailable: insufficient observations"
        className="text-sm text-muted-foreground"
      >
        Insufficient price history (need ≥ 8 daily observations).
      </p>
    );
  }

  const values = valid.map((p) => p.price_nav_ratio);
  const { mean, stdev } = bandStats(values);
  const lo = Math.min(...values, mean - stdev);
  const hi = Math.max(...values, mean + stdev);
  const range = hi - lo || 1;

  const innerW = VB_W - 2 * PAD_X;
  const innerH = VB_H - PAD_TOP - PAD_BOTTOM;

  const x = (i: number): number => PAD_X + (i / (valid.length - 1)) * innerW;
  const y = (v: number): number =>
    PAD_TOP + innerH - ((v - lo) / range) * innerH;

  const linePath = valid
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.price_nav_ratio).toFixed(1)}`)
    .join(" ");

  const bandTop = y(mean + stdev);
  const bandBottom = y(mean - stdev);
  const lastX = x(valid.length - 1);
  const lastY = y(valid.at(-1)!.price_nav_ratio);
  const meanY = y(mean);

  const current = valid.at(-1)!.price_nav_ratio;
  const sigmaFromMean = stdev > 0 ? (current - mean) / stdev : 0;
  const sigmaLabel =
    Math.abs(sigmaFromMean) < 0.05
      ? "at the mean"
      : sigmaFromMean > 0
        ? `+${sigmaFromMean.toFixed(1)}σ vs the rolling mean`
        : `${sigmaFromMean.toFixed(1)}σ vs the rolling mean`;

  return (
    <div role="img" aria-label={`Price-to-NAV ratio history: current ${current.toFixed(2)}×, ${sigmaLabel}`}>
      <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
        {current.toFixed(2)}×
      </p>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="mt-2 block h-auto w-full" aria-hidden="true">
        {/* ±1σ band */}
        <rect
          x={PAD_X}
          y={bandTop}
          width={innerW}
          height={Math.max(2, bandBottom - bandTop)}
          fill="var(--color-resilience-4)"
          fillOpacity={0.18}
        />
        {/* mean line */}
        <line
          x1={PAD_X}
          x2={PAD_X + innerW}
          y1={meanY}
          y2={meanY}
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeDasharray="2 4"
          className="text-muted-foreground"
        />
        {/* price/NAV line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-resilience-5)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* current point */}
        <circle cx={lastX} cy={lastY} r={4} fill="var(--color-resilience-5)" />
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">
        Current Price/NAV ratio. {sigmaLabel} over {valid.length} daily observations.
      </p>
    </div>
  );
}
