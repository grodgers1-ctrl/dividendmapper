"use client";

import { chipColor, type Delta, type ScoreType } from "@/lib/scoring/chip-display";

// Day 8 restyle: colour moves from the chip's background to a 1px coloured
// border, sitting on the new --surface-2 token. The β superscript and the
// dual-text-ink heuristic are gone — labels are always text-muted, numbers
// are always foreground. DNQ renders as a text-only pill on a neutral grey
// outline. Same props API as before; no consumer changes.

const GATE_FAIL_COLOR = "#94a3b8"; // neutral grey for DNQ outline

const TYPE_LABEL: Record<ScoreType, string> = {
  buy: "Quality",
  trim: "Trim",
  risk: "Risk",
};

export interface ScoreChipProps {
  type: ScoreType;
  score: number | null;
  delta?: Delta | null;
  gateReason?: string | null;
  isBeta?: boolean;
  hidden?: boolean;
  onOpen?: () => void;
}

export function ScoreChip({
  type,
  score,
  delta,
  gateReason,
  hidden,
  onOpen,
}: ScoreChipProps) {
  const gateFailed = score === null;
  const tone = gateFailed ? GATE_FAIL_COLOR : chipColor(type, score).hex;
  const label = TYPE_LABEL[type];

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="score-chip"
      data-color={tone}
      title={gateFailed ? (gateReason ?? "Quality concern") : undefined}
      aria-label={
        gateFailed
          ? `${label} score unavailable: ${gateReason ?? "quality concern"}`
          : `${label} score ${score}${hidden ? ", hidden" : ""}`
      }
      className="inline-flex items-center gap-1.5 rounded-full border bg-[var(--surface-2)] px-2 py-0.5 leading-tight text-[var(--text)] transition-transform duration-150 hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-card"
      style={{ borderColor: tone }}
    >
      {hidden ? (
        <span className="text-[11px] font-medium text-[var(--text-muted)]">Hidden</span>
      ) : gateFailed ? (
        <span className="text-[11px] font-semibold tracking-wide text-[var(--text-muted)]">
          DNQ
        </span>
      ) : (
        <>
          <span className="font-mono text-[13px] font-bold leading-[16px] tabular-nums">
            {score}
          </span>
          <span className="text-[11px] leading-[14px] text-[var(--text-muted)]">
            {label}
          </span>
          {delta && (
            <span className="ml-0.5 inline-flex items-center gap-0.5 text-[11px] text-[var(--text-muted)]">
              <span className="tabular-nums">{delta.label}</span>
              <span aria-hidden>{delta.arrow}</span>
            </span>
          )}
        </>
      )}
    </button>
  );
}
