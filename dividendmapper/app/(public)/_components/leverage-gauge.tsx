// Day 14 placeholder. Day 19 will replace this with a polished SVG semicircle.
// The shape (props + roles) is locked here so the template doesn't move.

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

export function LeverageGauge({ mode, value, label }: Props) {
  // Day 14 renders the metric label + raw signal score as a compact strip.
  // Day 19 replaces this with the SVG gauge.
  return (
    <div
      role="img"
      aria-label={`${MODE_TITLE[mode]}: ${label}`}
      className="flex flex-col gap-1"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {MODE_TITLE[mode]}
      </p>
      <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
        {value === null ? "—" : value}
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
