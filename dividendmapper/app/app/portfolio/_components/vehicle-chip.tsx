"use client";

import type { VehicleType } from "@/lib/scoring/load-vehicle-score";

// Distinct from the equity ScoreChip: prefixed with the vehicle-type label
// ("REIT 72", "BDC 67", "UK REIT 60") so the user reads what kind of income
// vehicle they're looking at, not just a bare number. Reuses the resilience
// ramp tokens introduced in Sprint 3 Day 19.

const TYPE_LABEL: Record<VehicleType, string> = {
  us_reit: "REIT",
  us_bdc: "BDC",
  uk_reit: "UK REIT",
};

const NEUTRAL_BORDER = "#94a3b8"; // gate-failed outline, matches ScoreChip's DNQ

function rampColor(score: number): string {
  // Same 5-stop ramp as LeverageGauge / ResilienceSpider so the chip in /app
  // matches the gauge on the public per-ticker page.
  if (score < 25) return "var(--color-resilience-1)";
  if (score < 50) return "var(--color-resilience-2)";
  if (score < 75) return "var(--color-resilience-3)";
  if (score < 90) return "var(--color-resilience-4)";
  return "var(--color-resilience-5)";
}

export interface VehicleChipProps {
  vehicleType: VehicleType;
  resilienceScore: number | null;
  qualityGatePassed: boolean;
  onOpen?: () => void;
}

export function VehicleChip({
  vehicleType,
  resilienceScore,
  qualityGatePassed,
  onOpen,
}: VehicleChipProps) {
  const label = TYPE_LABEL[vehicleType];
  const gateFailed = !qualityGatePassed || resilienceScore === null;
  const tone = gateFailed ? NEUTRAL_BORDER : rampColor(resilienceScore);

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="vehicle-chip"
      data-vehicle-type={vehicleType}
      data-color={tone}
      title={gateFailed ? "Quality gate failed for this vehicle" : undefined}
      aria-label={
        gateFailed
          ? `${label} resilience unavailable, quality gate failed`
          : `${label} resilience ${resilienceScore}`
      }
      className="inline-flex items-center gap-1.5 rounded-full border bg-[var(--surface-2)] px-2 py-0.5 leading-tight text-[var(--text)] transition-transform duration-150 hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-card"
      style={{ borderColor: tone }}
    >
      <span className="text-[11px] leading-[14px] text-[var(--text-muted)]">
        {label}
      </span>
      <span className="font-mono text-[13px] font-bold leading-[16px] tabular-nums">
        {gateFailed ? "—" : resilienceScore}
      </span>
    </button>
  );
}
