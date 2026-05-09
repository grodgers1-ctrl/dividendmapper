"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale } from "@/lib/locale/context";
import {
  formatShareCurrency,
  resolveCurrency,
} from "@/lib/calculators/dcf-currency";
import { InfoPopover } from "@/components/ui/info-popover";
import type { DcfInputs, DcfResult } from "@/lib/calculators/dcf";

interface DividendProjectionChartProps {
  inputs: DcfInputs;
  result: DcfResult;
}

/**
 * 15-year fan chart of dividend per share across Bear / Base / Bull. All three
 * lines start at today's reported dividend and fan apart as the scenario
 * growth rates compound. Makes the leverage of small assumption differences
 * visible — a 2pp gap in growth is a small slider tweak, but compounded over
 * 15 years it's a different stock.
 */
export function DividendProjectionChart({
  inputs,
  result,
}: DividendProjectionChartProps) {
  const { config } = useLocale();
  const currency = resolveCurrency(inputs.currency, config);
  const data = result.dividendProjection;

  if (data.length === 0 || !(inputs.currentDividend > 0)) {
    return null;
  }

  return (
    <section
      aria-label="Dividend per share projection across three scenarios"
      className="rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 font-display text-lg font-semibold text-foreground">
            Dividend per share — 15-year fan
            <InfoPopover label="What does this chart show?">
              <p>
                <strong>Dividend projection.</strong> Each line shows the
                dividend per share growing at one scenario&rsquo;s rate for 15
                years.
              </p>
              <p className="mt-2 text-muted-foreground">
                Today they&rsquo;re identical; by year 15 the spread shows how
                much your growth assumption matters. A 2pp difference in
                annual growth is a small slider move now and a very different
                income stream in a decade.
              </p>
            </InfoPopover>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            What one share might pay you each year, under each scenario.
          </p>
        </div>
        <Legend />
      </header>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="dpsBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dpsBull" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dpsBear" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-4)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--color-chart-4)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              vertical={false}
            />
            <XAxis
              dataKey="year"
              stroke="var(--color-muted-foreground)"
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => (v === 0 ? "Today" : `Yr ${v}`)}
              minTickGap={24}
            />
            <YAxis
              stroke="var(--color-muted-foreground)"
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatShareCurrency(v, currency)}
              width={72}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
              content={<ChartTooltip currency={currency} />}
            />

            {/* Order: bear/bull behind base so the central case stays visually dominant. */}
            <Area
              type="monotone"
              dataKey="bear"
              name="Bear"
              stroke="var(--color-chart-4)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="url(#dpsBear)"
              activeDot={{ r: 3 }}
            />
            <Area
              type="monotone"
              dataKey="bull"
              name="Bull"
              stroke="var(--color-chart-2)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="url(#dpsBull)"
              activeDot={{ r: 3 }}
            />
            <Area
              type="monotone"
              dataKey="base"
              name="Base"
              stroke="var(--color-brand-500)"
              strokeWidth={2.25}
              fill="url(#dpsBase)"
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Year 0 is today&rsquo;s reported dividend (
        <span className="font-mono font-medium text-foreground">
          {formatShareCurrency(inputs.currentDividend, currency)}
        </span>
        ). Lines compound at each scenario&rsquo;s growth rate.
      </p>
    </section>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <LegendDot color="var(--color-chart-4)" dashed /> Bear
      <LegendDot color="var(--color-brand-500)" /> Base
      <LegendDot color="var(--color-chart-2)" dashed /> Bull
    </ul>
  );
}

function LegendDot({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-2.5 w-5 items-center"
      style={{ marginRight: 2 }}
    >
      <span
        className="block h-[2px] w-full rounded"
        style={{
          backgroundColor: dashed ? "transparent" : color,
          backgroundImage: dashed
            ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)`
            : undefined,
        }}
      />
    </span>
  );
}

interface RechartsTooltipPayload {
  name?: string;
  value?: number;
  dataKey?: string;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: RechartsTooltipPayload[];
  label?: number;
  currency: ReturnType<typeof resolveCurrency>;
}) {
  if (!active || !payload?.length) return null;

  const ordered = ["base", "bull", "bear"]
    .map((key) => payload.find((p) => p.dataKey === key))
    .filter((p): p is RechartsTooltipPayload => Boolean(p));

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">
        {label === 0 ? "Today" : `Year ${label}`}
      </p>
      <ul className="mt-1.5 space-y-1">
        {ordered.map((p) => (
          <li
            key={p.dataKey}
            className="flex items-center gap-2 font-mono tabular-nums"
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="capitalize text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-medium text-popover-foreground">
              {formatShareCurrency(p.value ?? 0, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
