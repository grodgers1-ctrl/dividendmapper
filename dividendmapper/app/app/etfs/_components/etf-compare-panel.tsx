"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EtfSearch } from "./etf-search";
import type { ScreenerRow } from "./etf-screener";

interface Props {
  rows: ScreenerRow[];
}

export function EtfComparePanel({ rows }: Props) {
  const router = useRouter();
  const [tickerA, setTickerA] = useState<string | null>(null);
  const [tickerB, setTickerB] = useState<string | null>(null);

  const sameTicker = tickerA != null && tickerB != null && tickerA === tickerB;
  const ready = tickerA != null && tickerB != null && !sameTicker;

  function handleCompare() {
    if (!ready) return;
    const url = `/app/inspect/compare?a=${encodeURIComponent(tickerA)}&b=${encodeURIComponent(tickerB)}`;
    router.push(url);
  }

  return (
    <section
      aria-label="Compare two ETFs"
      className="rounded-lg border border-border bg-card p-4"
    >
      <header className="mb-3">
        <h2 className="text-base font-medium text-foreground">Compare two ETFs</h2>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        <EtfSearch
          rows={rows}
          label="ETF A"
          placeholder="Search ETFs by ticker or name"
          onSelect={(t) => setTickerA(t)}
        />
        <EtfSearch
          rows={rows}
          label="ETF B"
          placeholder="Search ETFs by ticker or name"
          onSelect={(t) => setTickerB(t)}
        />
      </div>
      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <button
          type="button"
          onClick={handleCompare}
          disabled={!ready}
          className="w-full rounded-md bg-emerald-500/20 px-3 py-2 text-sm text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
        >
          Compare
        </button>
        {sameTicker ? (
          <p className="text-xs text-amber-300">Pick two different ETFs.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Pick two ETFs to see their holdings overlap and side-by-side facts.
          </p>
        )}
      </div>
    </section>
  );
}
