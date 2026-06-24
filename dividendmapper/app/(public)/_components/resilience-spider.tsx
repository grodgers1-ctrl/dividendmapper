// SVG 4-axis radar chart for the four resilience categories Q / D / C / R.
// Pure server-rendered SVG. Values are 0..100. Null axes pull to centre with
// a dashed segment so a sparse vehicle still reads as a four-arm shape rather
// than collapsing into a point.

interface Props {
  q: number | null;
  d: number | null;
  c: number | null;
  r: number | null;
}

// VB is wider than tall so the long "Concentration" label fits without
// clipping at the top/bottom of the chart.
const VB_W = 280;
const VB_H = 240;
const CX = VB_W / 2;
const CY = VB_H / 2;
const R_OUTER = 80;
const RINGS = [0.25, 0.5, 0.75, 1.0];

// Axes go Q (top) → D (right) → C (bottom) → R (left), 90° apart starting
// at -90° (12 o'clock).
const AXES: { key: "q" | "d" | "c" | "r"; label: string; angle: number }[] = [
  { key: "q", label: "Quality", angle: -Math.PI / 2 },
  { key: "d", label: "Discount", angle: 0 },
  { key: "c", label: "Concentration", angle: Math.PI / 2 },
  { key: "r", label: "Risk", angle: Math.PI },
];

function pointFor(value: number | null, angle: number): [number, number, boolean] {
  const v = value === null ? 0 : Math.max(0, Math.min(100, value));
  const r = (v / 100) * R_OUTER;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle), value === null];
}

function labelPos(angle: number): [number, number] {
  const r = R_OUTER + 18;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

export function ResilienceSpider({ q, d, c, r }: Props) {
  const values: Record<"q" | "d" | "c" | "r", number | null> = { q, d, c, r };
  const points = AXES.map((a) => pointFor(values[a.key], a.angle));
  const polygonPoints = points
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const ariaParts = AXES.map(
    (a) => `${a.label} ${values[a.key] === null ? "unavailable" : values[a.key]}`,
  ).join(", ");

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="block h-auto w-full max-w-[320px] mx-auto"
      role="img"
      aria-label={`Resilience category breakdown: ${ariaParts}`}
    >
      {/* concentric rings */}
      {RINGS.map((frac, i) => (
        <circle
          key={i}
          cx={CX}
          cy={CY}
          r={R_OUTER * frac}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.08}
          className="text-muted-foreground"
        />
      ))}
      {/* axes */}
      {AXES.map((a, i) => {
        const [ex, ey] = pointFor(100, a.angle);
        return (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={ex}
            y2={ey}
            stroke="currentColor"
            strokeOpacity={0.15}
            className="text-muted-foreground"
          />
        );
      })}
      {/* polygon */}
      <polygon
        points={polygonPoints}
        fill="var(--color-resilience-4)"
        fillOpacity={0.32}
        stroke="var(--color-resilience-5)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* points */}
      {points.map(([px, py, isNull], i) => (
        <circle
          key={i}
          cx={px}
          cy={py}
          r={3}
          fill={isNull ? "var(--color-resilience-3)" : "var(--color-resilience-5)"}
        />
      ))}
      {/* axis labels */}
      {AXES.map((a, i) => {
        const [lx, ly] = labelPos(a.angle);
        const value = values[a.key];
        return (
          <g key={i}>
            <text
              x={lx}
              y={ly - 4}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              className="fill-muted-foreground"
              fontWeight={500}
            >
              {a.label}
            </text>
            <text
              x={lx}
              y={ly + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              className="fill-foreground font-mono"
              fontWeight={600}
            >
              {value === null ? "—" : value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
