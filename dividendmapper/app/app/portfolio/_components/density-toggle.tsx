"use client";

import { useSyncExternalStore } from "react";
import { Rows3, Rows4 } from "lucide-react";

export type Density = "comfortable" | "compact";

export const DENSITY_STORAGE_KEY = "dm.holdings-density";
export const DENSITY_CHANGE_EVENT = "dm:holdings-density-change";
const VALID = new Set<string>(["comfortable", "compact"]);

export function readStoredDensity(): Density {
  if (typeof window === "undefined") return "comfortable";
  const v = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  return v && VALID.has(v) ? (v as Density) : "comfortable";
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === DENSITY_STORAGE_KEY) cb();
  };
  const onCustom = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(DENSITY_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DENSITY_CHANGE_EVENT, onCustom);
  };
}

const getServerDensity = (): Density => "comfortable";

export function DensityToggle() {
  const density = useSyncExternalStore(subscribe, readStoredDensity, getServerDensity);

  const toggle = () => {
    const next: Density = density === "comfortable" ? "compact" : "comfortable";
    try {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, next);
      window.dispatchEvent(new Event(DENSITY_CHANGE_EVENT));
    } catch {
      // Private mode / storage disabled — runtime falls back to default.
    }
  };

  const Icon = density === "compact" ? Rows4 : Rows3;
  return (
    <button
      type="button"
      aria-pressed={density === "compact"}
      aria-label={`Density: ${density} (click to toggle)`}
      title={`Density: ${density}`}
      onClick={toggle}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
