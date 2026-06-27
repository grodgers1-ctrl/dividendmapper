"use client";

import { useSyncExternalStore } from "react";
import type { SparklineRange } from "@/lib/portfolio/load-sparkline-series";

export const RANGE_STORAGE_KEY = "dm.holdings-sparkline-range";
export const RANGE_CHANGE_EVENT = "dm:holdings-range-change";
const RANGES: SparklineRange[] = ["30D", "1Y", "5Y"];
const VALID = new Set<string>(RANGES);

export function readStoredRange(): SparklineRange {
  if (typeof window === "undefined") return "30D";
  const v = window.localStorage.getItem(RANGE_STORAGE_KEY);
  return v && VALID.has(v) ? (v as SparklineRange) : "30D";
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === RANGE_STORAGE_KEY) cb();
  };
  const onCustom = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(RANGE_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(RANGE_CHANGE_EVENT, onCustom);
  };
}

const getServerRange = (): SparklineRange => "30D";

export function RangeToggle() {
  const range = useSyncExternalStore(subscribe, readStoredRange, getServerRange);

  const setRange = (next: SparklineRange) => {
    try {
      window.localStorage.setItem(RANGE_STORAGE_KEY, next);
      window.dispatchEvent(new Event(RANGE_CHANGE_EVENT));
    } catch {
      // Private mode / storage disabled — runtime falls back to default 30D.
    }
  };

  return (
    <div
      role="group"
      aria-label="Sparkline range"
      className="inline-flex items-center rounded-md border border-border bg-card p-0.5"
    >
      {RANGES.map((r) => {
        const active = r === range;
        return (
          <button
            key={r}
            type="button"
            aria-pressed={active}
            onClick={() => setRange(r)}
            className={`rounded-sm px-2 py-1 text-xs font-medium transition-colors ${
              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}
