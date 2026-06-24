// SVG semicircular gauge. Parameterised by family so a single component
// renders FFO payout (US REIT), NII coverage (US BDC), or LTV (UK REIT).
// Tokens live in app/globals.css as --color-resilience-1..5 (color-expert
// 5-stop ramp).
//
// The `value` prop is the underlying SIGNAL's rawScore (0..100), already
// transformed by the engine into a directionally-positive resilience score
// (higher = healthier on every mode, including the inverted LTV/payout
// metrics). The gauge maps that 0..100 to the semicircle and picks a colour
// from the resilience ramp by band. The raw metric (e.g. "FFO payout 81%")
// is carried separately in `label` so the engine's banding stays the source
// of truth for both the gauge fill and the underlying number.

import type { LeverageMode } from "@/lib/scoring/data/vehicle-families";

interface Props {
  mode: LeverageMode;
  value: number | null;
  subSector?: string;
  label: string;
}

const MODE_TITLE: Record<LeverageMode, string> = {
  "ffo-payout": "FFO payout ratio",
  "nii-coverage": "NII coverage",
  ltv: "Loan-to-value",
};

function rampColor(score: number): string {
  // Five-stop ramp keyed to the engine's three Q-signal bands:
  //   0-25 / 25-50 / 50-75 / 75-90 / 90-100
  // The bands aren't even fifths because dividend-resilience risk skews
  // toward the bottom — the difference between 0 and 25 matters more than
  // the difference between 75 and 90.
  if (score < 25) return "var(--color-resilience-1)";
  if (score < 50) return "var(--color-resilience-2)";
  if (score < 75) return "var(--color-resilience-3)";
  if (score < 90) return "var(--color-resilience-4)";
  return "var(--color-resilience-5)";
}

// SVG geometry. Viewbox 0 0 200 110. Semicircle centred at (100, 100), r=80.
const CX = 100;
const CY = 100;
const R = 80;

function polarToCartesian(angleRad: number, radius: number): [number, number] {
  return [CX + radius * Math.cos(angleRad), CY - radius * Math.sin(angleRad)];
}

function arcPath(startFrac: number, endFrac: number, radius: number): string {
  // Semicircle goes from π (left) to 0 (right). Higher fraction = more arc.
  const startAngle = Math.PI - startFrac * Math.PI;
  const endAngle = Math.PI - endFrac * Math.PI;
  const [sx, sy] = polarToCartesian(startAngle, radius);
  const [ex, ey] = polarToCartesian(endAngle, radius);
  const largeArc = endFrac - startFrac > 0.5 ? 1 : 0;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

export function LeverageGauge({ mode, value, label }: Props) {
  const title = MODE_TITLE[mode];
  if (value === null || !Number.isFinite(value)) {
    return (
      <div
        role="img"
        aria-label={`${title}: data unavailable`}
        className="flex flex-col gap-1"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="font-mono text-2xl font-semibold tabular-nums text-muted-foreground">
          —
        </p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, value));
  const frac = clamped / 100;
  const color = rampColor(clamped);

  return (
    <div
      role="img"
      aria-label={`${title}: ${label}`}
      className="flex flex-col gap-1"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <svg
        viewBox="0 0 200 110"
        className="block h-auto w-full max-w-[280px]"
        aria-hidden="true"
      >
        {/* track */}
        <path
          d={arcPath(0, 1, R)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={12}
          strokeLinecap="round"
          className="text-muted-foreground"
        />
        {/* fill */}
        <path
          d={arcPath(0, Math.max(0.001, frac), R)}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
        />
      </svg>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
