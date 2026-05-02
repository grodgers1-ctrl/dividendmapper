"use client";

import * as React from "react";
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
import { formatCurrency } from "@/lib/locale/format";
import type { ProjectionPoint } from "@/lib/calculators/retirement";

interface ProjectionChartProps {
  data: ProjectionPoint[];
  retirementAge: number;
}

export function ProjectionChart({ data, retirementAge }: ProjectionChartProps) {
  const { config } = useLocale();

  return (
    <section
      aria-label="Portfolio projection across three scenarios"
      className="rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            Portfolio projection
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Bear / Base / Bull paths from now until age {retirementAge}.
          </p>
        </div>
        <Legend />
      </header>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id="fillBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillBull" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillBear" x1="0" y1="0" x2="0" y2="1">
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
              dataKey="age"
              stroke="var(--color-muted-foreground)"
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `Age ${v}`}
              minTickGap={32}
            />
            <YAxis
              stroke="var(--color-muted-foreground)"
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatCurrency(v, config, true)}
              width={64}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
              content={<ChartTooltip />}
            />

            {/* Order matters — bear/bull behind base */}
            <Area
              type="monotone"
              dataKey="bear"
              name="Bear"
              stroke="var(--color-chart-4)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="url(#fillBear)"
              activeDot={{ r: 3 }}
            />
            <Area
              type="monotone"
              dataKey="bull"
              name="Bull"
              stroke="var(--color-chart-2)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="url(#fillBull)"
              activeDot={{ r: 3 }}
            />
            <Area
              type="monotone"
              dataKey="base"
              name="Base"
              stroke="var(--color-brand-500)"
              strokeWidth={2.25}
              fill="url(#fillBase)"
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Bear = base return − 2pp / yield − 1pp. Bull = base return + 2pp / yield
        + 1pp. Probability weights 25 / 50 / 25%.
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
}: {
  active?: boolean;
  payload?: RechartsTooltipPayload[];
  label?: number;
}) {
  const { config } = useLocale();
  if (!active || !payload?.length) return null;

  const ordered = ["base", "bull", "bear"]
    .map((key) => payload.find((p) => p.dataKey === key))
    .filter((p): p is RechartsTooltipPayload => Boolean(p));

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">Age {label}</p>
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
              {formatCurrency(p.value ?? 0, config, true)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
