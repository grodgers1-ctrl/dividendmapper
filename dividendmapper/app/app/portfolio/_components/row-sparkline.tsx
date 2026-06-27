// Server-rendered SVG sparkline for one holding row. Reuses the line-path math
// from price-nav-sparkline.tsx, sized for an inline table cell.

import type { SparklineRange, SparklineSeries } from "@/lib/portfolio/load-sparkline-series";

const VB_W = 120;
const VB_H = 40;
const PAD_X = 2;
const PAD_Y = 4;

interface Props {
  ticker: string;
  name?: string;
  range: SparklineRange;
  series: SparklineSeries | null;
}

export function RowSparkline({ ticker, name, range, series }: Props) {
  if (!series || series.points.length < 8) {
    return (
      <span
        className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
        title="Price history collects after the next nightly update."
      >
        Collecting…
      </span>
    );
  }

  const { points, lastClose, currency } = series;
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const range_v = hi - lo;
  const innerW = VB_W - 2 * PAD_X;
  const innerH = VB_H - 2 * PAD_Y;

  const x = (i: number) => PAD_X + (i / (points.length - 1)) * innerW;
  const y = (v: number) =>
    range_v === 0
      ? PAD_Y + innerH / 2
      : PAD_Y + innerH - ((v - lo) / range_v) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p).toFixed(1)}`)
    .join(" ");

  const areaPath =
    `${linePath} L ${x(points.length - 1).toFixed(1)} ${(VB_H - PAD_Y).toFixed(1)} ` +
    `L ${x(0).toFixed(1)} ${(VB_H - PAD_Y).toFixed(1)} Z`;

  const lastX = x(points.length - 1);
  const lastY = y(lastClose);
  const gradId = `spark-grad-${ticker.replace(/[^a-z0-9]/gi, "")}`;
  const labelNum = Number.isFinite(lastClose) ? lastClose.toFixed(2) : String(lastClose);

  return (
    <div
      role="img"
      aria-label={`${ticker}${name ? ` (${name})` : ""} ${range} price line, ended at ${labelNum} ${currency}`}
      className="inline-block text-brand-500"
    >
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block h-10 w-[120px]" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={lastX} cy={lastY} r={1.8} fill="currentColor" />
      </svg>
    </div>
  );
}
