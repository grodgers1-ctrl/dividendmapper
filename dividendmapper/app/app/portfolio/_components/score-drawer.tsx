"use client";

import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { chipColor, type ScoreType } from "@/lib/scoring/chip-display";
import { primaryGateReason } from "@/lib/scoring/gate-reasons";
import type { GateCode } from "@/lib/scoring/quality-gates";

type SignalRow = {
  signalCode: string;
  humanLabel: string;
  contribution: number | null;
  rawPoints: number | null;
  weight: number | null;
};

type ScoringResponse = {
  ticker: string;
  buyScore: number | null;
  trimScore: number | null;
  riskScore: number | null;
  buyQualityGatePassed: boolean;
  buyFailedGates: string[];
  dataQuality: string;
  computedAt: string;
  signals: Record<ScoreType, SignalRow[]>;
};

const TYPE_LABEL: Record<ScoreType, string> = { buy: "Quality", trim: "Trim", risk: "Risk" };

// Score history started 2026-05-29; the sparkline needs ~30 days. Until then
// the drawer shows a dimmed placeholder that counts down.
const HISTORY_START = new Date("2026-05-29T00:00:00Z");
function daysUntilSparkline(now: Date): number {
  const elapsed = Math.floor((now.getTime() - HISTORY_START.getTime()) / 86_400_000);
  return Math.max(0, 30 - elapsed);
}

export interface ScoreDrawerProps {
  ticker: string;
  scoreType: ScoreType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isBeta?: boolean;
}

export function ScoreDrawer({
  ticker,
  scoreType,
  open,
  onOpenChange,
  isBeta,
}: ScoreDrawerProps) {
  // Result is keyed by ticker so loading/hidden derive from props instead of
  // synchronous setState in the effect (which the React lint rules forbid).
  const [result, setResult] = useState<{
    ticker: string;
    payload: ScoringResponse | null;
  } | null>(null);
  const [hiddenTicker, setHiddenTicker] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/scoring/${ticker}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setResult({ ticker, payload: json });
      })
      .catch(() => {
        if (!cancelled) setResult({ ticker, payload: null });
      });
    return () => {
      cancelled = true;
    };
  }, [open, ticker]);

  const isCurrent = result?.ticker === ticker;
  const data = isCurrent ? result!.payload : null;
  const loading = open && !isCurrent;
  const hidden = hiddenTicker === ticker;

  const score = data
    ? scoreType === "buy"
      ? data.buyScore
      : scoreType === "trim"
        ? data.trimScore
        : data.riskScore
    : null;
  const signals = data?.signals?.[scoreType] ?? [];
  const gateFailed = scoreType === "buy" && data !== null && data.buyScore === null;
  const gateReason = gateFailed
    ? primaryGateReason((data!.buyFailedGates ?? []) as GateCode[])
    : null;
  const sparklineDays = daysUntilSparkline(new Date());
  const maxContribution = Math.max(1, ...signals.map((s) => s.contribution ?? 0));
  const accent = score === null ? "#27272a" : chipColor(scoreType, score).hex;

  function handleHide() {
    startTransition(async () => {
      try {
        await fetch("/api/scoring/overrides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker, scoreType }),
        });
        setHiddenTicker(ticker);
      } catch {
        // Non-fatal — the chip just stays visible; user can retry.
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed right-0 top-0 z-50 flex h-full w-[min(28rem,calc(100vw-2rem))] flex-col overflow-y-auto border-l border-border bg-background p-6 shadow-2xl transition-transform duration-200 data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-mono text-lg font-semibold tracking-tight text-foreground">
                {ticker}
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                {TYPE_LABEL[scoreType]} score breakdown
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary"
            >
              ✕
            </Dialog.Close>
          </div>

          {loading && (
            <p className="mt-6 text-sm text-muted-foreground">Loading scores…</p>
          )}

          {!loading && data && (
            <>
              <div className="mt-6 flex items-baseline gap-3">
                {gateFailed ? (
                  <span className="text-sm font-medium text-foreground">
                    {gateReason ?? "Quality concern"}
                  </span>
                ) : (
                  <span
                    data-testid="drawer-active-score"
                    className="font-mono text-5xl font-bold tabular-nums"
                    style={{ color: accent }}
                  >
                    {score}
                  </span>
                )}
              </div>

              {/* Signal contribution bars */}
              {signals.length > 0 && (
                <ul className="mt-6 space-y-3">
                  {signals.slice(0, 5).map((s) => {
                    const value = s.contribution ?? s.rawPoints ?? 0;
                    const pct = Math.round((value / maxContribution) * 100);
                    return (
                      <li key={s.signalCode}>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span data-testid="signal-bar-label" className="text-foreground">
                            {s.humanLabel}
                          </span>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {Math.round(value)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: accent }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Sparkline placeholder (history not yet 30 days deep) */}
              <div className="mt-6 rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-4 text-center">
                <p className="text-xs text-muted-foreground/70">
                  Trend chart available {sparklineDays} day{sparklineDays === 1 ? "" : "s"} from now
                </p>
              </div>

              {/* Override */}
              <div className="mt-6">
                {hidden ? (
                  <p className="text-xs text-muted-foreground">
                    Hidden for 90 days. Un-hide from your account preferences.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleHide}
                    disabled={isPending}
                    className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Hide this score for 90 days
                  </button>
                )}
              </div>

              <div className="mt-auto pt-8">
                {isBeta && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Scores are in beta: methodology evolving, weights tuned monthly.
                  </p>
                )}
                <p className="text-[0.7rem] leading-relaxed text-muted-foreground/70">
                  Scores are informational, not financial advice.{" "}
                  <Link
                    href="/scoring-methodology"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    How scores are calculated (methodology)
                  </Link>
                </p>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
