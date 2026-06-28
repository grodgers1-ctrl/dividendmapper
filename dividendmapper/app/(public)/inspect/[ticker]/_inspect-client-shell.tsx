"use client";

// Hoists the shared `windowYears` state for the Inspect ticker page. The page
// itself stays a Server Component (so per-ticker HTML can be ISR-cached); this
// shell wraps the selector + 4 graph cards so they re-render in lockstep when
// the user toggles 3y / 5y / 10y.

import { useState } from "react";
import { InspectWindowSelector } from "../_components/inspect-window-selector";
import { InspectGraphCard } from "../_components/inspect-graph-card";
import type { InspectMetricSeries } from "@/lib/inspect/types";

export type InspectCard = {
  title: string;
  subtitle: string;
  verdict: string;
  metrics: [InspectMetricSeries, InspectMetricSeries, InspectMetricSeries];
};

type Props = {
  cards: [InspectCard, InspectCard, InspectCard, InspectCard];
  available10y: boolean;
};

export function InspectClientShell({ cards, available10y }: Props) {
  const [windowYears, setWindowYears] = useState<3 | 5 | 10>(5);
  return (
    <div className="mt-8 space-y-6">
      <div className="flex justify-end">
        <InspectWindowSelector
          value={windowYears}
          onChange={setWindowYears}
          available10y={available10y}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {cards.map((c) => (
          <InspectGraphCard
            key={c.title}
            title={c.title}
            subtitle={c.subtitle}
            verdict={c.verdict}
            metrics={c.metrics}
            windowYears={windowYears}
          />
        ))}
      </div>
    </div>
  );
}
