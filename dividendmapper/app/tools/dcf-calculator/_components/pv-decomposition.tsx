"use client";

import { useLocale } from "@/lib/locale/context";
import {
  formatShareCurrency,
  resolveCurrency,
} from "@/lib/calculators/dcf-currency";
import { InfoPopover } from "@/components/ui/info-popover";
import type { DcfInputs, DcfResult } from "@/lib/calculators/dcf";

interface PvDecompositionProps {
  inputs: DcfInputs;
  result: DcfResult;
}

/**
 * Where does the intrinsic value come from?
 *
 * In a 2-stage DDM, the answer breaks into two pieces: the present value of
 * the explicit Phase 1 dividends (the "foreseeable future") and the present
 * value of the Gordon-Growth terminal tail (everything beyond).
 *
 * The terminal piece typically dominates — often 60–80% of the answer. That
 * matters because it means the model is *mostly* a bet on the terminal
 * growth assumption, not the high-growth phase. Surfacing this teaches a
 * critical lesson about DCF/DDM analysis without a tutorial.
 *
 * Only renders in Advanced (2-stage) mode. Returns null otherwise.
 */
export function PvDecomposition({ inputs, result }: PvDecompositionProps) {
  const { config } = useLocale();
  const currency = resolveCurrency(inputs.currency, config);

  if (inputs.mode !== "advanced" || result.decomposition === null) {
    return null;
  }

  const { phase1PV, terminalPV, total } = result.decomposition;
  if (!(total > 0)) return null;

  const phase1Pct = (phase1PV / total) * 100;
  const terminalPct = 100 - phase1Pct;
  const phase1Years = Math.round(inputs.phase1Years);

  return (
    <section
      aria-label="Where the intrinsic value comes from"
      className="rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <header className="mb-5">
        <h3 className="flex items-center gap-1.5 font-display text-lg font-semibold text-foreground">
          Where the value comes from
          <InfoPopover label="What does this chart show?">
            <p>
              <strong>PV decomposition.</strong> Splits your Base intrinsic
              value into two pieces: the present value of dividends paid
              during the Phase 1 high-growth period, and the present value of
              the Gordon-Growth terminal tail (everything beyond).
            </p>
            <p className="mt-2 text-muted-foreground">
              The terminal piece usually dominates. That&rsquo;s a critical
              lesson. It means most of your &ldquo;intrinsic value&rdquo; is a
              bet on the long-run terminal assumption, not the high-growth
              phase. If you can&rsquo;t defend the terminal rate, the answer
              is fragile.
            </p>
          </InfoPopover>
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Most of the answer typically lives in the long tail. Surface it so
          you know what you&rsquo;re really betting on.
        </p>
      </header>

      <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
        <DonutSvg phase1Pct={phase1Pct} terminalPct={terminalPct} />

        <dl className="space-y-3">
          <Row
            color="brand"
            label={`Phase 1: next ${phase1Years} years`}
            value={formatShareCurrency(phase1PV, currency)}
            pct={phase1Pct}
            help="Sum of present values of each year's dividend across the high-growth window."
          />
          <Row
            color="income"
            label="Terminal tail: beyond Phase 1"
            value={formatShareCurrency(terminalPV, currency)}
            pct={terminalPct}
            help="Gordon-Growth terminal value at end of Phase 1, discounted back to today."
          />
          <div className="border-t border-border pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-foreground">
                Base intrinsic value
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {formatShareCurrency(total, currency)}
              </span>
            </div>
          </div>
        </dl>
      </div>
    </section>
  );
}

function Row({
  color,
  label,
  value,
  pct,
  help,
}: {
  color: "brand" | "income";
  label: string;
  value: string;
  pct: number;
  help: string;
}) {
  const dotClass =
    color === "brand"
      ? "bg-brand-500"
      : "bg-income-500";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span aria-hidden className={`h-2 w-2 rounded-full ${dotClass}`} />
          {label}
        </span>
        <span className="font-mono text-sm tabular-nums text-foreground">
          {value}
          <span className="ml-2 text-xs text-muted-foreground">
            {pct.toFixed(0)}%
          </span>
        </span>
      </div>
      <p className="mt-1 pl-4 text-xs text-muted-foreground">{help}</p>
    </div>
  );
}

/**
 * Two-segment donut. SVG is more accurate than a CSS conic-gradient at small
 * sizes and works the same in dark mode without extra plumbing.
 */
function DonutSvg({
  phase1Pct,
  terminalPct,
}: {
  phase1Pct: number;
  terminalPct: number;
}) {
  const size = 160;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // First segment starts at 12 o'clock and runs clockwise.
  const phase1Length = (phase1Pct / 100) * c;
  const terminalLength = (terminalPct / 100) * c;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Phase 1 ${phase1Pct.toFixed(0)}%, Terminal ${terminalPct.toFixed(0)}%`}
      className="-rotate-90"
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth={stroke}
      />
      {/* Phase 1 (brand green) */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-brand-500)"
        strokeWidth={stroke}
        strokeDasharray={`${phase1Length} ${c}`}
        strokeLinecap="butt"
      />
      {/* Terminal (income amber) — drawn after Phase 1, offset to start where Phase 1 ends */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-income-500)"
        strokeWidth={stroke}
        strokeDasharray={`${terminalLength} ${c}`}
        strokeDashoffset={-phase1Length}
        strokeLinecap="butt"
      />
      {/* Centre label — undo the rotation so text stays upright */}
      <g transform={`rotate(90 ${size / 2} ${size / 2})`}>
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px] uppercase tracking-wider"
        >
          Terminal
        </text>
        <text
          x={size / 2}
          y={size / 2 + 14}
          textAnchor="middle"
          className="fill-foreground font-mono text-xl font-semibold tabular-nums"
        >
          {terminalPct.toFixed(0)}%
        </text>
      </g>
    </svg>
  );
}
