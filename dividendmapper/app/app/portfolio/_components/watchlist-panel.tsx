"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TickerSearch, type TickerSearchResult } from "@/components/ui/ticker-search";
import type { ScoreType } from "@/lib/scoring/chip-display";
import { ScoreChip } from "./score-chip";
import { ScoreDrawer } from "./score-drawer";

export interface WatchRow {
  id: string;
  ticker: string;
  buyScore: number | null;
  trimScore: number | null;
  riskScore: number | null;
  buyGateReason: string | null;
  scored: boolean;
}

const ADD_ERROR_COPY: Record<string, string> = {
  watchlist_limit: "Your watchlist is full (50 tickers). Remove one to add another.",
  duplicate: "That ticker is already on your watchlist.",
  pro_only: "The watchlist is a Pro feature.",
  invalid_ticker: "Pick a ticker from the dropdown first.",
};

export function WatchlistPanel({
  rows,
  isBeta,
}: {
  rows: WatchRow[];
  isBeta: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<TickerSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openScore, setOpenScore] = useState<{ ticker: string; type: ScoreType } | null>(null);
  const [isPending, startTransition] = useTransition();

  function add() {
    if (!selected) {
      setError(ADD_ERROR_COPY.invalid_ticker);
      return;
    }
    setError(null);
    const ticker = selected.symbol;
    startTransition(async () => {
      try {
        const res = await fetch("/api/portfolio/tracked-tickers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker }),
        });
        if (res.status === 201) {
          setSelected(null);
          router.refresh();
          return;
        }
        const json = (await res.json().catch(() => ({}))) as { code?: string };
        setError(
          (json.code && ADD_ERROR_COPY[json.code]) ??
            "Couldn't add that ticker. Try again.",
        );
      } catch {
        setError("Network error. Check your connection and try again.");
      }
    });
  }

  function remove(ticker: string) {
    startTransition(async () => {
      try {
        await fetch(`/api/portfolio/tracked-tickers?ticker=${encodeURIComponent(ticker)}`, {
          method: "DELETE",
        });
        router.refresh();
      } catch {
        // Non-fatal — the row stays; the user can retry.
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Add row */}
      <div className="rounded-xl border border-border bg-card p-4">
        <label htmlFor="watchlist-ticker" className="block text-sm font-medium text-foreground">
          Track a ticker
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Watched tickers are scored in the nightly update, the same as your holdings.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            <TickerSearch
              id="watchlist-ticker"
              placeholder="Search by symbol or company name"
              disabled={isPending}
              onSelect={(r) => {
                setSelected(r);
                setError(null);
              }}
            />
            {selected && (
              <p className="mt-1 text-xs text-muted-foreground">
                Selected: <span className="font-mono text-foreground">{selected.symbol}</span>
                {" · "}
                {selected.name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={add}
            disabled={isPending || !selected}
            className="inline-flex h-[42px] items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Adding…" : "Add to watchlist"}
          </button>
        </div>
        {error && (
          <p role="alert" aria-live="assertive" className="mt-2 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-display text-base font-semibold text-foreground">
            Your watchlist is empty
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Add a ticker above to track its Quality, Trim and Risk scores without owning it.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              {row.scored ? (
                <button
                  type="button"
                  onClick={() => setOpenScore({ ticker: row.ticker, type: "buy" })}
                  className="font-mono text-sm font-semibold text-foreground hover:underline"
                >
                  {row.ticker}
                </button>
              ) : (
                <span className="font-mono text-sm font-semibold text-foreground">
                  {row.ticker}
                </span>
              )}
              <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
                {row.scored ? (
                  (["buy", "trim", "risk"] as ScoreType[]).map((type) => (
                    <ScoreChip
                      key={type}
                      type={type}
                      score={
                        type === "buy" ? row.buyScore : type === "trim" ? row.trimScore : row.riskScore
                      }
                      gateReason={type === "buy" ? row.buyGateReason : null}
                      isBeta={isBeta}
                      onOpen={() => setOpenScore({ ticker: row.ticker, type })}
                    />
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Collecting…</span>
                )}
                <button
                  type="button"
                  onClick={() => remove(row.ticker)}
                  disabled={isPending}
                  aria-label={`Remove ${row.ticker} from watchlist`}
                  className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {openScore && (
        <ScoreDrawer
          ticker={openScore.ticker}
          scoreType={openScore.type}
          open={true}
          onOpenChange={(o) => {
            if (!o) setOpenScore(null);
          }}
          isBeta={isBeta}
        />
      )}
    </div>
  );
}
