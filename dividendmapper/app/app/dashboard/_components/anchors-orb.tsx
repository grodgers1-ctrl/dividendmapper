"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { IncomeBand } from "@/lib/scoring/income-band-helpers";

interface AnchorsOrbProps {
  totalsGbp: Record<IncomeBand, number>;
  countsByBand: Record<IncomeBand, number>;
  totalGbp: number;
}

interface Ring {
  band: Exclude<IncomeBand, "unscored">;
  label: string;
  radius: number;
  stroke: string;
  glow: string;
}

const VIEW = 200;
const STROKE = 11;
const PX = 200;

const RINGS: Ring[] = [
  {
    band: "anchor",
    label: "Anchors",
    radius: 85,
    stroke: "var(--color-resilience-5)",
    glow: "color-mix(in oklab, var(--color-resilience-5) 35%, transparent)",
  },
  {
    band: "exposure",
    label: "Exposures",
    radius: 66,
    stroke: "var(--color-resilience-3)",
    glow: "color-mix(in oklab, var(--color-resilience-3) 35%, transparent)",
  },
  {
    band: "risk",
    label: "Risk",
    radius: 47,
    stroke: "var(--color-resilience-1)",
    glow: "color-mix(in oklab, var(--color-resilience-1) 35%, transparent)",
  },
];

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function AnchorsOrb({
  totalsGbp,
  countsByBand,
  totalGbp,
}: AnchorsOrbProps) {
  const reduce = useReducedMotion();

  const fractions: Record<Ring["band"], number> = {
    anchor: totalGbp > 0 ? totalsGbp.anchor / totalGbp : 0,
    exposure: totalGbp > 0 ? totalsGbp.exposure / totalGbp : 0,
    risk: totalGbp > 0 ? totalsGbp.risk / totalGbp : 0,
  };

  return (
    <div className="flex flex-col items-center">
      <div
        role="img"
        aria-label={`Forward annual income of ${GBP.format(Math.round(totalGbp))}: ${Math.round(fractions.anchor * 100)} percent anchors, ${Math.round(fractions.exposure * 100)} percent exposures, ${Math.round(fractions.risk * 100)} percent risk.`}
        className="relative"
        style={{ width: PX, height: PX }}
      >
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="absolute inset-0 h-full w-full -rotate-90"
          fill="none"
        >
          {RINGS.map((ring, i) => {
            const circumference = 2 * Math.PI * ring.radius;
            const fraction = fractions[ring.band];
            const dashOffset = circumference * (1 - fraction);
            return (
              <g key={ring.band}>
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
                  stroke={ring.stroke}
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
                  style={{ filter: `drop-shadow(0 0 6px ${ring.glow})` }}
                />
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-bold tabular-nums text-foreground">
            {GBP.format(Math.round(totalGbp))}
          </span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            per year
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 font-mono text-[11px]">
        {RINGS.map((ring) => {
          const total = totalsGbp[ring.band];
          const count = countsByBand[ring.band];
          return (
            <span
              key={ring.band}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{
                backgroundColor: `color-mix(in oklab, ${ring.stroke} 12%, transparent)`,
                color: "var(--foreground)",
              }}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: ring.stroke }}
              />
              {ring.label} {GBP.format(Math.round(total))} · {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}
