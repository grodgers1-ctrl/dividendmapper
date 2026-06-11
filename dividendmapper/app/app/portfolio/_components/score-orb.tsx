"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ScoreType } from "@/lib/scoring/chip-display";
import {
  arcGlowColor,
  arcLength,
  arcStrokeColor,
  formatScoreLabel,
  orbAriaLabel,
} from "@/lib/scoring/orb-display";

interface ScoreOrbProps {
  ticker: string;
  quality: number | null;
  trim: number | null;
  risk: number | null;
  qualityGateReason?: string | null;
  size?: "md" | "lg";
  className?: string;
}

interface Ring {
  type: ScoreType;
  label: string;
  radius: number;
}

const VIEW = 200;
const STROKE = 11;
const RINGS: Ring[] = [
  { type: "buy", label: "Quality", radius: 85 },
  { type: "trim", label: "Trim", radius: 66 },
  { type: "risk", label: "Risk", radius: 47 },
];

export function ScoreOrb({
  ticker,
  quality,
  trim,
  risk,
  qualityGateReason,
  size = "md",
  className,
}: ScoreOrbProps) {
  const reduce = useReducedMotion();
  const px = size === "lg" ? 240 : 168;
  const tickerClass = size === "lg" ? "text-2xl" : "text-lg";
  const labelClass = size === "lg" ? "text-xs" : "text-[11px]";

  const scoresByType: Record<ScoreType, number | null> = {
    buy: quality,
    trim,
    risk,
  };

  return (
    <div
      className={className}
      role="img"
      aria-label={orbAriaLabel(ticker, quality, trim, risk)}
    >
      <div className="relative mx-auto" style={{ width: px, height: px }}>
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="absolute inset-0 h-full w-full -rotate-90"
          fill="none"
        >
          {RINGS.map((ring, i) => {
            const circumference = 2 * Math.PI * ring.radius;
            const fraction = arcLength(scoresByType[ring.type]);
            const dashOffset = circumference * (1 - fraction);
            const stroke = arcStrokeColor(ring.type);
            const glow = arcGlowColor(ring.type);
            return (
              <g key={ring.type}>
                <circle
                  cx={VIEW / 2}
                  cy={VIEW / 2}
                  r={ring.radius}
                  stroke="var(--border)"
                  strokeOpacity={0.4}
                  strokeWidth={STROKE}
                />
                <motion.circle
                  cx={VIEW / 2}
                  cy={VIEW / 2}
                  r={ring.radius}
                  stroke={stroke}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={
                    reduce
                      ? { strokeDashoffset: dashOffset }
                      : { strokeDashoffset: circumference }
                  }
                  animate={{ strokeDashoffset: dashOffset }}
                  transition={{
                    duration: reduce ? 0 : 1.1,
                    delay: reduce ? 0 : 0.1 + i * 0.12,
                    ease: [0.22, 1, 0.36, 1] as const,
                  }}
                  style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
                />
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`font-mono font-bold tracking-wider text-foreground ${tickerClass}`}
          >
            {ticker}
          </span>
        </div>
      </div>

      <div
        className={`mt-4 flex flex-wrap items-center justify-center gap-1.5 font-mono ${labelClass}`}
      >
        {RINGS.map((ring) => {
          const stroke = arcStrokeColor(ring.type);
          const score = scoresByType[ring.type];
          const reason =
            ring.type === "buy" ? (qualityGateReason ?? null) : null;
          return (
            <span
              key={ring.type}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{ backgroundColor: `${stroke}1f`, color: stroke }}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: stroke }}
              />
              {ring.label} {formatScoreLabel(score, reason)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
