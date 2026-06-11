"use client";

import { chipColor, type Delta, type ScoreType } from "@/lib/scoring/chip-display";

const GATE_FAIL_COLOR = "#27272a"; // charcoal, per spec — never red (red = Risk)

const TYPE_LABEL: Record<ScoreType, string> = {
  buy: "Quality",
  trim: "Trim",
  risk: "Risk",
};

// Glow shadow per type — resolves to translucent rgba via :root vars and
// brightens in dark mode. Gate-failed chips do NOT glow.
const GLOW_BY_TYPE: Record<ScoreType, string> = {
  buy: "var(--shadow-glow-quality)",
  trim: "var(--shadow-glow-trim)",
  risk: "var(--shadow-glow-risk)",
};

// Readable text colour over the chip's background. The two lightest tiers
// (light amber, grey-blue) need dark ink; everything else takes white.
const DARK_INK_BACKGROUNDS = new Set(["#fbbf24", "#94a3b8"]);
function inkFor(bg: string): string {
  return DARK_INK_BACKGROUNDS.has(bg) ? "#1a1a1a" : "#ffffff";
}

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
  isBeta,
  hidden,
  onOpen,
}: ScoreChipProps) {
  const gateFailed = score === null;
  const bg = gateFailed ? GATE_FAIL_COLOR : chipColor(type, score).hex;
  const ink = inkFor(bg);
  const label = TYPE_LABEL[type];
  const glow = gateFailed || hidden ? "none" : GLOW_BY_TYPE[type];

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="score-chip"
      data-color={bg}
      title={gateFailed ? (gateReason ?? "Quality concern") : undefined}
      aria-label={
        gateFailed
          ? `${label} score unavailable: ${gateReason ?? "quality concern"}`
          : `${label} score ${score}${hidden ? ", hidden" : ""}`
      }
      className="inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-medium leading-tight transition-[opacity,box-shadow] duration-200 hover:opacity-95 hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-card"
      style={{ backgroundColor: bg, color: ink, boxShadow: glow }}
    >
      {hidden ? (
        <span className="font-medium">Hidden</span>
      ) : gateFailed ? (
        // Short fixed-width "Did Not Qualify" tag keeps the chip row aligned;
        // the full reason surfaces on hover (title) + in the drawer.
        <span className="font-semibold">DNQ</span>
      ) : (
        <>
          <span className="font-mono font-semibold tabular-nums">{score}</span>
          <span className="opacity-90 tracking-wide">{label}</span>
          {isBeta && (
            <sup className="ml-0.5 text-[0.6rem] leading-none opacity-80">β</sup>
          )}
          {delta && (
            <span className="ml-0.5 inline-flex items-center gap-0.5 opacity-90">
              <span className="tabular-nums">{delta.label}</span>
              <span aria-hidden>{delta.arrow}</span>
            </span>
          )}
        </>
      )}
    </button>
  );
}
