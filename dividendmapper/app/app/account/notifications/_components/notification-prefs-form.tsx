"use client";

import { useState } from "react";
import Link from "next/link";

export interface PrefState {
  enabled: boolean;
  threshold: number;
}
export interface ToggleState {
  enabled: boolean;
}
export interface PrefsShape {
  quality: PrefState;
  risk: PrefState;
  watchlist: ToggleState;
  weeklyDigest: ToggleState;
}

export function NotificationPrefsForm({
  initial,
  isPro,
}: {
  initial: PrefsShape;
  isPro: boolean;
}) {
  const [prefs, setPrefs] = useState<PrefsShape>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  type ThresholdKey = "quality" | "risk";
  function set(key: ThresholdKey, patch: Partial<PrefState>) {
    setPrefs((p) => ({ ...p, [key]: { ...p[key], ...patch } }));
    setStatus("idle");
  }
  function setWatchlist(enabled: boolean) {
    setPrefs((p) => ({ ...p, watchlist: { enabled } }));
    setStatus("idle");
  }
  function setWeeklyDigest(enabled: boolean) {
    setPrefs((p) => ({ ...p, weeklyDigest: { enabled } }));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(prefs),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  const row = (key: ThresholdKey, label: string, help: string) => (
    <div className="flex items-start justify-between gap-4 border-b border-border py-4 last:border-0">
      <div>
        <label htmlFor={`${key}-enabled`} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <p className="mt-1 text-sm text-muted-foreground">{help}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Threshold</span>
          <input
            type="number"
            min={0}
            max={100}
            aria-label={`${label} threshold`}
            disabled={!isPro || !prefs[key].enabled}
            value={prefs[key].threshold}
            onChange={(e) => set(key, { threshold: Number(e.target.value) })}
            className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50"
          />
        </div>
      </div>
      <input
        id={`${key}-enabled`}
        type="checkbox"
        aria-label={label}
        disabled={!isPro}
        checked={prefs[key].enabled}
        onChange={(e) => set(key, { enabled: e.target.checked })}
        className="mt-1 h-5 w-5 disabled:opacity-50"
      />
    </div>
  );

  return (
    <div>
      {!isPro && (
        <div className="mb-4 rounded-lg border border-border bg-secondary/50 p-4 text-sm">
          <p className="text-foreground">Alert emails are a Pro feature.</p>
          <Link
            href="/pricing"
            className="mt-2 inline-block font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
          >
            Upgrade to turn these on
          </Link>
        </div>
      )}

      {row("quality", "Quality alerts", "Email me when a holding's Quality score falls below this level.")}
      {row("risk", "Risk alerts", "Email me when a holding's Risk score rises to this level or above.")}

      <div className="flex items-start justify-between gap-4 border-b border-border py-4 last:border-0">
        <div>
          <label htmlFor="watchlist-enabled" className="text-sm font-medium text-foreground">
            Watchlist alerts
          </label>
          <p className="mt-1 text-sm text-muted-foreground">
            Email me when a ticker on my watchlist crosses the same levels.
          </p>
        </div>
        <input
          id="watchlist-enabled"
          type="checkbox"
          aria-label="Watchlist alerts"
          disabled={!isPro}
          checked={prefs.watchlist.enabled}
          onChange={(e) => setWatchlist(e.target.checked)}
          className="mt-1 h-5 w-5 disabled:opacity-50"
        />
      </div>

      <div className="flex items-start justify-between gap-4 border-b border-border py-4 last:border-0">
        <div>
          <label htmlFor="weekly-enabled" className="text-sm font-medium text-foreground">
            Weekly digest
          </label>
          <p className="mt-1 text-sm text-muted-foreground">
            Email me a weekly summary of how my holdings and watchlist moved, even on a quiet week.
          </p>
        </div>
        <input
          id="weekly-enabled"
          type="checkbox"
          aria-label="Weekly digest"
          disabled={!isPro}
          checked={prefs.weeklyDigest.enabled}
          onChange={(e) => setWeeklyDigest(e.target.checked)}
          className="mt-1 h-5 w-5 disabled:opacity-50"
        />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        At most one summary email per day, plus an optional weekly recap. These scores are a resilience
        check, not financial advice.
      </p>

      {isPro && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={status === "saving"}
            className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {status === "saving" ? "Saving" : "Save"}
          </button>
          {status === "saved" && <span className="text-sm text-muted-foreground">Saved.</span>}
          {status === "error" && <span className="text-sm text-red-600">Could not save. Try again.</span>}
        </div>
      )}
    </div>
  );
}
