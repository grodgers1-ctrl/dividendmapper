// Shared concentric donut + side legend. Pure SVG via stroke-dasharray so a
// single 100% segment still renders as a full ring (the alternative arc-path
// approach collapses when start ≈ end). Used by the ETF inspect sector and
// country cards; the dashboard SectorExposureCard predates this and has its
// own portfolio-specific variant.
//
// `value` is whatever scale the caller passes in (the ETF bundle uses 0-100
// percentage points). Values are normalised against the sum, so any scale
// works.

interface Segment {
  label: string;
  /** Any positive scale — segments are normalised against the total. */
  value: number;
  color: string;
}

interface Props {
  segments: ReadonlyArray<Segment>;
  centreLabel: string;
  centreSubLabel?: string;
  size?: number;
  thickness?: number;
}

const RADIUS = 50;
const STROKE = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ConcentricDonut({
  segments,
  centreLabel,
  centreSubLabel,
  size = 140,
  thickness = STROKE,
}: Props) {
  const total = segments.reduce((acc, s) => acc + s.value, 0) || 1;

  // Cumulative offsets walked clockwise from 12 o'clock (group rotated -90).
  let cumulative = 0;
  const meta = segments.map((s) => {
    const arc = (s.value / total) * CIRCUMFERENCE;
    const offset = -cumulative;
    cumulative += arc;
    return { ...s, arc, offset };
  });

  const ariaLabel = meta
    .map((s) => `${s.label} ${((s.value / total) * 100).toFixed(1)}%`)
    .join(", ");

  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-4">
      <svg
        viewBox="0 0 140 140"
        width={size}
        height={size}
        aria-label={ariaLabel}
        role="img"
        className="h-[120px] w-[120px]"
      >
        <g transform="translate(70 70) rotate(-90)">
          {meta.map((s) => (
            <circle
              key={s.label}
              r={RADIUS}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${s.arc.toFixed(2)} ${(CIRCUMFERENCE - s.arc).toFixed(2)}`}
              strokeDashoffset={s.offset.toFixed(2)}
            />
          ))}
        </g>
        <g transform="translate(70 78)" textAnchor="middle">
          <text fontSize="26" fontWeight="500" fill="var(--text)">
            {centreLabel}
          </text>
          {centreSubLabel && (
            <text
              y="14"
              fontSize="10"
              letterSpacing="0.06em"
              fill="var(--text-muted)"
              style={{ textTransform: "uppercase" }}
            >
              {centreSubLabel}
            </text>
          )}
        </g>
      </svg>
      <ul className="min-w-0 space-y-1 text-sm">
        {meta.map((s) => (
          <li
            key={s.label}
            className="flex items-center gap-2 text-[var(--text)]"
          >
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="flex-shrink-0 font-mono tabular-nums text-[var(--text-muted)]">
              {((s.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
