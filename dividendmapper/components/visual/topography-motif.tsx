"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

type Intensity = "subtle" | "hero";

interface TopographyMotifProps {
  intensity?: Intensity;
  animated?: boolean;
  className?: string;
}

interface Line {
  d: string;
  strokeWidth: number;
  accent: boolean;
}

interface Geometry {
  horizontals: Line[];
  splays: Line[];
}

// Viewport is a wide 2:1 panel. The horizon sits high so the foreground gets
// most of the canvas — that's where the perspective splay reads strongest.
const VIEW_W = 1200;
const VIEW_H = 600;
const HORIZON = 150;
const VP_X = VIEW_W / 2;
const FLOOR_BOTTOM = VIEW_H - 24;

function buildGeometry(intensity: Intensity): Geometry {
  const hero = intensity === "hero";
  const horizCount = hero ? 18 : 12;
  const splayCount = hero ? 30 : 20;
  const accentEvery = hero ? 4 : 5;

  // ── Horizontal contour lines ──────────────────────────────────────────────
  // Y position is quadratic in depth (t²), so lines bunch near the horizon
  // and spread out as they approach the camera. Each line is a sum of two
  // sine terms — one low frequency for rolling hills, one higher for detail.
  // Amplitude and stroke width both grow with t (foreground reads heavier).
  const horizontals: Line[] = [];
  for (let i = 0; i < horizCount; i++) {
    const t = i / (horizCount - 1);
    const depth = t * t;
    const baseY = HORIZON + (FLOOR_BOTTOM - HORIZON) * depth;

    const amp1 = (hero ? 9 : 5) + depth * (hero ? 24 : 14);
    const amp2 = (hero ? 4.5 : 2.5) + depth * (hero ? 12 : 7);
    const phase1 = i * 0.55;
    const phase2 = i * 0.32 + 1.2;
    const f1 = (2 * Math.PI * 2.2) / VIEW_W;
    const f2 = (2 * Math.PI * 4.3) / VIEW_W;

    const sampleStep = 10;
    const parts: string[] = [];
    for (let x = 0; x <= VIEW_W; x += sampleStep) {
      const y =
        baseY +
        amp1 * Math.sin(x * f1 + phase1) +
        amp2 * Math.cos(x * f2 + phase2);
      parts.push(`${x === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(2)}`);
    }
    const strokeWidth = (hero ? 0.55 : 0.4) + depth * (hero ? 1.05 : 0.7);
    horizontals.push({
      d: parts.join(" "),
      strokeWidth,
      accent: i % accentEvery === 0,
    });
  }

  // ── Splay lines ───────────────────────────────────────────────────────────
  // Straight rays from the vanishing point out to the foreground floor. Start
  // a few units below the horizon so the cluster at VP doesn't smear, end at
  // FLOOR_BOTTOM. Edge lines exit the viewbox so the splay reads wider than
  // the visible area.
  const splays: Line[] = [];
  const margin = 240;
  const startOffsetY = 14; // pixels below the horizon

  for (let i = 0; i < splayCount; i++) {
    const t = i / (splayCount - 1);
    const bottomX = -margin + t * (VIEW_W + 2 * margin);

    const startY = HORIZON + startOffsetY;
    // Project the start point along the same ray as the bottom point
    const startX =
      VP_X +
      (bottomX - VP_X) * (startOffsetY / (FLOOR_BOTTOM - HORIZON));

    const strokeWidth = hero ? 0.55 : 0.4;
    splays.push({
      d: `M${startX.toFixed(1)},${startY} L${bottomX.toFixed(1)},${FLOOR_BOTTOM}`,
      strokeWidth,
      accent: i % accentEvery === 0,
    });
  }

  return { horizontals, splays };
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
        initial: { opacity: 0, scale: 1.04 },
        animate: { opacity: 1, scale: 1 },
        transition: {
          duration: 1.6,
          ease: [0.22, 1, 0.36, 1] as const,
        },
        style: { transformOrigin: `${VP_X}px ${HORIZON}px` },
      }
    : {};

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMax slice"
      className={className}
    >
      <defs>
        {/* Atmospheric fade — bright near the centre-foreground, vanishing
            radially outward and especially toward the top (sky). The vertical
            offset is tuned so the foreground stays visible while the area
            above the horizon reads as empty sky. */}
        <radialGradient id="topo-fade" cx="50%" cy="68%" r="62%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="55%" stopColor="white" stopOpacity="0.8" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="topo-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="22%" stopColor="white" stopOpacity="0.35" />
          <stop offset="40%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="1" />
        </linearGradient>
        <mask id="topo-mask">
          <rect width={VIEW_W} height={VIEW_H} fill="url(#topo-fade)" />
          <rect
            width={VIEW_W}
            height={HORIZON + 40}
            fill="url(#topo-sky)"
            style={{ mixBlendMode: "multiply" }}
          />
        </mask>
      </defs>

      <Group mask="url(#topo-mask)" fill="none" {...groupProps}>
        {/* Splays first so horizontal contours sit "in front" */}
        {geometry.splays.map((s, i) => (
          <path
            key={`s${i}`}
            d={s.d}
            stroke={s.accent ? "var(--mesh-strong)" : "var(--mesh)"}
            strokeWidth={s.strokeWidth}
            strokeLinecap="round"
          />
        ))}
        {geometry.horizontals.map((h, i) => (
          <path
            key={`h${i}`}
            d={h.d}
            stroke={h.accent ? "var(--mesh-strong)" : "var(--mesh)"}
            strokeWidth={h.strokeWidth}
            strokeLinecap="round"
          />
        ))}
      </Group>
    </svg>
  );
}
