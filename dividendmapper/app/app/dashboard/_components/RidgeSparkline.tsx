// Day 5 brand accent #3: topographic-ridge sparkline. Solid emerald line on
// top of 2-3 fainter parallel "contour" copies offset 4-6px down. Pure SVG,
// deterministic from a `{ at, value }[]` series — no animation, no random,
// safe for both server and client render. Decorative — no axes / labels.

import { Fragment } from "react";

export interface RidgePoint {
  at: Date;
  value: number;
}

export interface RidgeSparklineProps {
  data: ReadonlyArray<RidgePoint>;
  width?: number;
  height?: number;
  className?: string;
}

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 64;
const CONTOUR_OFFSETS = [4, 5, 6] as const;
const CONTOUR_OPACITIES = [0.5, 0.25, 0.12] as const;
const PADDING_Y = 8;

function buildPath(
  data: ReadonlyArray<RidgePoint>,
  width: number,
  height: number,
  yOffset = 0,
): string {
  const n = data.length;
  if (n === 0) return "";

  const usableHeight = Math.max(1, height - PADDING_Y * 2);
  const minValue = Math.min(...data.map((d) => d.value));
  const maxValue = Math.max(...data.map((d) => d.value));
  const valueRange = maxValue - minValue || 1;

  const points = data.map((d, i) => {
    const x = n === 1 ? width / 2 : (i / (n - 1)) * width;
    const normalised = (d.value - minValue) / valueRange;
    const y = height - PADDING_Y - normalised * usableHeight + yOffset;
    return [x, y] as const;
  });

  return points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
}

export function RidgeSparkline({
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className,
}: RidgeSparklineProps) {
  if (data.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        aria-hidden
        className={className}
      />
    );
  }

  if (data.length === 1) {
    const cx = width / 2;
    const cy = height / 2;
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        aria-hidden
        className={className}
      >
        <circle cx={cx} cy={cy} r={2.5} fill="var(--brand)" />
      </svg>
    );
  }

  const mainPath = buildPath(data, width, height, 0);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      aria-hidden
      className={className}
    >
      {CONTOUR_OFFSETS.map((offset, i) => (
        <Fragment key={offset}>
          <path
            d={buildPath(data, width, height, offset)}
            stroke="var(--brand)"
            strokeOpacity={CONTOUR_OPACITIES[i]}
            strokeWidth={1}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Fragment>
      ))}
      <path
        d={mainPath}
        stroke="var(--brand)"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
