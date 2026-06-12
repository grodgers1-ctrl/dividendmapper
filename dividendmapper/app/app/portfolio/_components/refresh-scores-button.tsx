"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Pro button on Portfolio Manager + Watchlist. POSTs to the on-demand refresh
// endpoint, which scores up to 20 of the user's missing/stale tickers, then
// router.refresh() repaints the score chips. Disabled in-flight; surfaces the
// 429 cooldown and a "next 20" prompt when more than a batch is eligible.

type Result =
  | { kind: "idle" }
  | { kind: "done"; scored: number; failed: number; remaining: number }
  | { kind: "cooldown"; minutes: number }
  | { kind: "error" };

export function RefreshScoresButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>({ kind: "idle" });

  async function run() {
    setBusy(true);
    setResult({ kind: "idle" });
    try {
      const res = await fetch("/api/portfolio/refresh-scores", { method: "POST" });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setResult({ kind: "cooldown", minutes: Math.ceil((body.retryAfterSeconds ?? 900) / 60) });
        return;
      }
      if (!res.ok) {
        setResult({ kind: "error" });
        return;
      }
      const body = (await res.json()) as { scored: number; failed: number; remaining: number };
      setResult({ kind: "done", scored: body.scored, failed: body.failed, remaining: body.remaining });
      startTransition(() => router.refresh());
    } catch {
      setResult({ kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  const inFlight = busy || pending;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={inFlight}
        className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {inFlight
          ? "Scoring…"
          : result.kind === "done" && result.remaining > 0
            ? "Score the next 20"
            : "Refresh scores"}
      </button>
      {result.kind === "done" && result.remaining === 0 && (
        <span className="text-xs text-muted-foreground">Scores up to date</span>
      )}
      {result.kind === "done" && result.remaining > 0 && (
        <span className="text-xs text-muted-foreground">
          Scored {result.scored}. {result.remaining} more to go.
        </span>
      )}
      {result.kind === "cooldown" && (
        <span className="text-xs text-muted-foreground">Try again in ~{result.minutes} min</span>
      )}
      {result.kind === "error" && (
        <span className="text-xs text-rose-600 dark:text-rose-400">Couldn&apos;t refresh. Try again.</span>
      )}
    </div>
  );
}
