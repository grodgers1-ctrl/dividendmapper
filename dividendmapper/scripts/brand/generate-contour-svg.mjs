#!/usr/bin/env node
// Generates a static topographic contour SVG asset for use as a background
// pattern (drawer footer, HeroIncomeCard, empty states) per the Day-1 plan
// at planning/plans/2026-06-14-app-shell-redesign-days-1-9.md.
//
// Ports the buildGeometry() function from
// components/visual/topography-motif.tsx using intensity="subtle". The animated
// hero variant is intentionally not used here — this asset is decoration at
// ~4% opacity, so the subtle line count is enough.
//
// Usage: node scripts/brand/generate-contour-svg.mjs public/brand/contour.svg
//
// Re-run whenever the source motif visual identity changes.

import { writeFileSync } from "node:fs";

const VIEW_W = 1200;
const VIEW_H = 600;
const HORIZON = 150;
const VP_X = VIEW_W / 2;
const FLOOR_BOTTOM = VIEW_H - 24;

function buildGeometry() {
  const horizCount = 12;
  const splayCount = 20;
  const accentEvery = 5;

  const horizontals = [];
  for (let i = 0; i < horizCount; i++) {
    const t = i / (horizCount - 1);
    const depth = t * t;
    const baseY = HORIZON + (FLOOR_BOTTOM - HORIZON) * depth;

    const amp1 = 5 + depth * 14;
    const amp2 = 2.5 + depth * 7;
    const phase1 = i * 0.55;
    const phase2 = i * 0.32 + 1.2;
    const f1 = (2 * Math.PI * 2.2) / VIEW_W;
    const f2 = (2 * Math.PI * 4.3) / VIEW_W;

    const sampleStep = 10;
    const parts = [];
    for (let x = 0; x <= VIEW_W; x += sampleStep) {
      const y =
        baseY +
        amp1 * Math.sin(x * f1 + phase1) +
        amp2 * Math.cos(x * f2 + phase2);
      parts.push(`${x === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(2)}`);
    }
    const strokeWidth = 0.4 + depth * 0.7;
    horizontals.push({
      d: parts.join(" "),
      strokeWidth,
      accent: i % accentEvery === 0,
    });
  }

  const splays = [];
  const margin = 240;
  const startOffsetY = 14;

  for (let i = 0; i < splayCount; i++) {
    const t = i / (splayCount - 1);
    const bottomX = -margin + t * (VIEW_W + 2 * margin);
    const startY = HORIZON + startOffsetY;
    const startX =
      VP_X + (bottomX - VP_X) * (startOffsetY / (FLOOR_BOTTOM - HORIZON));

    splays.push({
      d: `M${startX.toFixed(1)},${startY} L${bottomX.toFixed(1)},${FLOOR_BOTTOM}`,
      strokeWidth: 0.4,
      accent: i % accentEvery === 0,
    });
  }

  return { horizontals, splays };
}

// Static stroke colour: brand emerald. The SVG wrapper drops the asset to ~4%
// opacity overall, so the exact hue barely shows through — green ties the
// background to the brand without being legible as a colour.
const STROKE = "#0EA874";
const STROKE_ACCENT = "#0EA874";

function renderPath(p, accent) {
  const stroke = accent ? STROKE_ACCENT : STROKE;
  const opacity = accent ? "0.9" : "0.55";
  return `<path d="${p.d}" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="${p.strokeWidth.toFixed(2)}" stroke-linecap="round" fill="none"/>`;
}

function renderSvg() {
  const { horizontals, splays } = buildGeometry();
  const paths = [
    ...splays.map((s) => renderPath(s, s.accent)),
    ...horizontals.map((h) => renderPath(h, h.accent)),
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <radialGradient id="topo-fade" cx="50%" cy="68%" r="62%">
      <stop offset="0%" stop-color="white" stop-opacity="1"/>
      <stop offset="55%" stop-color="white" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="topo-sky" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="white" stop-opacity="0"/>
      <stop offset="22%" stop-color="white" stop-opacity="0.35"/>
      <stop offset="40%" stop-color="white" stop-opacity="1"/>
      <stop offset="100%" stop-color="white" stop-opacity="1"/>
    </linearGradient>
    <mask id="topo-mask">
      <rect width="${VIEW_W}" height="${VIEW_H}" fill="url(#topo-fade)"/>
      <rect width="${VIEW_W}" height="${HORIZON + 40}" fill="url(#topo-sky)" style="mix-blend-mode: multiply;"/>
    </mask>
  </defs>
  <g opacity="0.04" mask="url(#topo-mask)">
    ${paths.join("\n    ")}
  </g>
</svg>
`;
}

const out = process.argv[2] ?? "public/brand/contour.svg";
writeFileSync(out, renderSvg());
console.log(`wrote ${out}`);
