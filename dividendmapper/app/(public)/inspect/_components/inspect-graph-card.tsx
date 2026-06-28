"use client";

// Skeleton card for one Inspect dimension (Value, Safety, Growth, Profitability).
// The real chart lands Day 6. For now the chart slot is an empty placeholder
// and the three metric chips toggle local selection state so the interaction
// shape is in place.

import { useState } from "react";

export type Metric = {
  key: string;
  label: string;
  goodDirection: "high" | "low";
};

type Props = {
  title: string;
  subtitle: string;
  verdict: string;
  metrics: [Metric, Metric, Metric];
  windowYears: 3 | 5 | 10;
};

export function InspectGraphCard({ title, subtitle, verdict, metrics }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(metrics.map((m) => m.key)),
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <p className="mt-3 text-base font-medium text-foreground">{verdict}</p>

      {/* Chart placeholder. Day 6 replaces this with the real line/area chart. */}
      <div
        className="mt-6 h-64 rounded-lg bg-muted/30"
        aria-label={`${title} chart placeholder`}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {metrics.map((m) => {
          const isOn = selected.has(m.key);
          return (
            <button
              key={m.key}
              type="button"
              onClick={() =>
                setSelected((s) => {
                  const next = new Set(s);
                  if (next.has(m.key)) next.delete(m.key);
                  else next.add(m.key);
                  return next;
                })
              }
              className={`rounded-full border border-border px-3 py-1 text-sm transition ${
                isOn ? "bg-accent" : "opacity-50"
              }`}
              aria-pressed={isOn}
            >
              {m.goodDirection === "high" ? "higher is better" : "lower is better"} &middot;{" "}
              {m.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
