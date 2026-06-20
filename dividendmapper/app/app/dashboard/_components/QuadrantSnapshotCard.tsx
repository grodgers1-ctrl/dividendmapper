// Day 6 dashboard. Pro-only — Free users get nothing in this slot per the
// "single UpgradeCard per dashboard" rule (the Hero-row UpgradeCard already
// covers Free). Wraps QuadrantMap in compact mode with a card surround and a
// "Open Portfolio Manager →" CTA to the full scoring page.

import Link from "next/link";
import { QuadrantMap } from "@/app/app/portfolio/_components/quadrant-map";
import type {
  ExcludedHolding,
  QuadrantPoint,
} from "@/lib/scoring/quadrant";

export interface QuadrantSnapshotCardProps {
  points: QuadrantPoint[];
  excluded: ExcludedHolding[];
  isBeta: boolean;
}

export function QuadrantSnapshotCard({
  points,
  excluded,
  isBeta,
}: QuadrantSnapshotCardProps) {
  return (
    <div className="flex h-full flex-col rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold tracking-tight text-[var(--text)]">
          Quality vs Risk
        </h2>
      </div>
      <div className="mt-3 flex-1">
        <QuadrantMap
          points={points}
          excluded={excluded}
          isBeta={isBeta}
          compact
        />
      </div>
      <div className="mt-4 text-right">
        <Link
          href="/app/portfolio/scoring"
          className="text-sm text-[var(--brand)] hover:underline"
        >
          Open Portfolio Manager →
        </Link>
      </div>
    </div>
  );
}
