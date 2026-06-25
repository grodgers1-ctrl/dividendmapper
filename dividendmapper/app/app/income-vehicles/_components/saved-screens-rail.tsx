"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { ScreenerCriteria } from "@/lib/portfolio/income-vehicle-screener";

type SavedScreen = {
  id: string;
  name: string;
  filter_state: ScreenerCriteria;
  created_at: string;
};

export function SavedScreensRail({
  refreshKey,
  onApply,
}: {
  /** Increment to trigger a re-fetch (driven by save events from the hub wrapper). */
  refreshKey: number;
  onApply: (filterState: ScreenerCriteria) => void;
}) {
  const [screens, setScreens] = useState<SavedScreen[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/screens");
        const json = res.ok ? await res.json() : { screens: [] };
        if (!cancelled) setScreens((json.screens ?? []) as SavedScreen[]);
      } catch {
        if (!cancelled) setScreens([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function handleDelete(id: string) {
    await fetch(`/api/screens?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    // Optimistic remove; parent's next save will trigger a refetch anyway.
    setScreens((prev) => (prev ?? []).filter((s) => s.id !== id));
  }

  if (screens === null) {
    return (
      <aside className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Loading saved screens…
      </aside>
    );
  }
  if (screens.length === 0) {
    return (
      <aside className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
        Save a screen to recall the filter combination here.
      </aside>
    );
  }
  return (
    <aside className="rounded-xl border border-border bg-card p-3">
      <h3 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Saved screens
      </h3>
      <ul className="space-y-1">
        {screens.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-secondary"
          >
            <button
              type="button"
              onClick={() => onApply(s.filter_state)}
              className="flex-1 truncate text-left text-sm text-foreground hover:underline"
              title={`Apply ${s.name}`}
            >
              {s.name}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(s.id)}
              aria-label={`Delete ${s.name}`}
              className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
