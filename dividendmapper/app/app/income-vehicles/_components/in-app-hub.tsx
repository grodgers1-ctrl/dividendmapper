"use client";

import { useState } from "react";
import { Screener } from "@/app/(public)/income-vehicles/_components/screener";
import { SavedScreensRail } from "./saved-screens-rail";
import type { ScreenerCriteria } from "@/lib/portfolio/income-vehicle-screener";
import type { VehicleUniverseRow } from "@/lib/scoring/load-vehicle-universe";

const INITIAL_CRITERIA: ScreenerCriteria = {
  family: "all",
  minResilience: 0,
  subSector: null,
  gatePassedOnly: false,
};

// Client wrapper that owns the criteria state shared by the SavedScreensRail
// and Screener. Lifting state here is what makes apply-from-rail work in V1
// (clicking a saved screen restores its filter combo). Save flow uses a
// callback prop on Screener instead of a window-event bus — no cross-island
// shenanigans.
export function InAppHub({
  universe,
  ownedTickers,
}: {
  universe: ReadonlyArray<VehicleUniverseRow>;
  ownedTickers: ReadonlyArray<string>;
}) {
  const [criteria, setCriteria] = useState<ScreenerCriteria>(INITIAL_CRITERIA);
  const [savedRefreshKey, setSavedRefreshKey] = useState(0);

  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr]">
      <SavedScreensRail
        refreshKey={savedRefreshKey}
        onApply={(filterState) => setCriteria(filterState)}
      />
      <Screener
        universe={universe}
        showSaveScreenAction
        showRowActions
        ownedTickers={ownedTickers}
        criteria={criteria}
        onCriteriaChange={setCriteria}
        onSaved={() => setSavedRefreshKey((k) => k + 1)}
        tickerHrefBuilder={(ticker) =>
          `/app/income-vehicles/${encodeURIComponent(ticker)}`
        }
      />
    </div>
  );
}
