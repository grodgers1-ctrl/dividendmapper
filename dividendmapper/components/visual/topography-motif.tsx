"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

type Intensity = "subtle" | "hero";

interface TopographyMotifProps {
  intensity?: Intensity;
  animated?: boolean;
  className?: string;
}

interface MotifGeometry {
  horizontals: { d: string; accent: boolean }[];
  verticals: { d: string; accent: boolean }[];
  stroke: number;
}

const VIEW_W = 1200;
const VIEW_H = 600;

function buildGeometry(intensity: Intensity): MotifGeometry {
  const hero = intensity === "hero";
  const horizontalCount = hero ? 16 : 11;
  const verticalCount = hero ? 26 : 18;
  const amplitude = hero ? 26 : 12;
  const accentEvery = hero ? 3 : 4;
  const stroke = hero ? 0.9 : 0.55;

  const topMargin = 40;
  const bottomMargin = 40;
  const usableH = VIEW_H - topMargin - bottomMargin;
  const horizontalDy = usableH / (horizontalCount - 1);

  const horizontals = Array.from({ length: horizontalCount }, (_, i) => {
    const baseY = topMargin + i * horizontalDy;
    const phase = i * 0.7;
    const wavelength = 360;
    const sampleStep = 14;
    const parts: string[] = [];
    for (let x = 0; x <= VIEW_W; x += sampleStep) {
      const y = baseY + amplitude * Math.sin((x / wavelength) * 2 * Math.PI + phase);
      parts.push(`${x === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(2)}`);
    }
    return { d: parts.join(" "), accent: i % accentEvery === 0 };
  });

  const verticalDx = VIEW_W / (verticalCount - 1);
  const verticals = Array.from({ length: verticalCount }, (_, i) => {
    const x = i * verticalDx;
    return {
      d: `M${x.toFixed(1)},${topMargin} L${x.toFixed(1)},${VIEW_H - bottomMargin}`,
      accent: i % accentEvery === 0,
    };
  });

  return { horizontals, verticals, stroke };
}

export function TopographyMotif({
  intensity = "subtle",
  animated = false,
  className,
}: TopographyMotifProps) {
  const geometry = useMemo(() => buildGeometry(intensity), [intensity]);
  const prefersReducedMotion = useReducedMotion();
  const reallyAnimated = animated && !prefersReducedMotion;

  const Group = reallyAnimated ? motion.g : "g";
  const groupProps = reallyAnimated
    ? {
        animate: { y: [0, -10, 0] },
        transition: { duration: 8, ease: "easeInOut" as const, repeat: Infinity },
      }
    : {};

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className={className}
    >
      <defs>
        <radialGradient id="topo-fade" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="60%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="topo-mask">
          <rect width={VIEW_W} height={VIEW_H} fill="url(#topo-fade)" />
        </mask>
      </defs>
      <Group mask="url(#topo-mask)" fill="none" {...groupProps}>
        {geometry.verticals.map((v, i) => (
          <path
            key={`v${i}`}
            d={v.d}
            stroke={v.accent ? "var(--mesh-strong)" : "var(--mesh)"}
            strokeWidth={geometry.stroke}
          />
        ))}
        {geometry.horizontals.map((h, i) => (
          <path
            key={`h${i}`}
            d={h.d}
            stroke={h.accent ? "var(--mesh-strong)" : "var(--mesh)"}
            strokeWidth={geometry.stroke}
            strokeLinecap="round"
          />
        ))}
      </Group>
    </svg>
  );
}
