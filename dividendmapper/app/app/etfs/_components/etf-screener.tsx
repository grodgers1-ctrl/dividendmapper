"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

// Inlined per project convention; see income-vehicles screener for the canonical body.
function rampColor(score: number): string {
  if (score < 25) return "var(--color-resilience-1)";
  if (score < 50) return "var(--color-resilience-2)";
  if (score < 75) return "var(--color-resilience-3)";
  if (score < 90) return "var(--color-resilience-4)";
  return "var(--color-resilience-5)";
}

function fmtTer(ter: number | null): string {
  if (ter == null) return "—";
  return `${(ter * 100).toFixed(2)}%`;
}

function fmtAum(aum: number | null): string {
  if (aum == null) return "—";
  if (aum >= 1e9) return `${(aum / 1e9).toFixed(1)}B`;
  if (aum >= 1e6) return `${Math.round(aum / 1e6)}M`;
  return aum.toLocaleString();
}

// UCITS domicile = IE or LU (full names from seed CSV: "Ireland" / "Luxembourg").
function isUcits(domicile: string | null): boolean {
  if (!domicile) return false;
  const d = domicile.toLowerCase();
  return d === "ie" || d === "lu" || d === "ireland" || d === "luxembourg";
}

function isUs(domicile: string | null): boolean {
  if (!domicile) return false;
  const d = domicile.toLowerCase();
  return d === "us" || d === "united states";
}

export interface ScreenerRow {
  ticker: string;
  name: string;
  family: string | null;
  distribution_policy: string | null;
  domicile: string | null;
  ter: number | null;
  aum: number | null;
  quality_headline: number | null;
}

type Policy = "all" | "Distributing" | "Accumulating";
type Domicile = "all" | "UCITS" | "US";
type SortKey = "ticker" | "ter" | "aum" | "quality_headline";
type SortDir = "asc" | "desc";

function chipCls(active: boolean): string {
  return active
    ? "rounded px-2.5 py-1 text-xs bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
    : "rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground";
}

export function EtfScreener({
  rows,
  defaultLimit = 20,
}: {
  rows: ScreenerRow[];
  defaultLimit?: number;
}) {
  const [policy, setPolicy] = useState<Policy>("all");
  const [domicile, setDomicile] = useState<Domicile>("all");
  const [sortKey, setSortKey] = useState<SortKey>("quality_headline");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const subset = rows.filter((r) => {
      if (policy !== "all" && r.distribution_policy !== policy) return false;
      if (domicile === "UCITS" && !isUcits(r.domicile)) return false;
      if (domicile === "US" && !isUs(r.domicile)) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...subset].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Nulls always sort last regardless of direction.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, policy, domicile, sortKey, sortDir]);

  function setSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "ticker" ? "asc" : "desc");
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const showCount = expanded ? filtered.length : Math.min(defaultLimit, filtered.length);
  const shown = filtered.slice(0, showCount);
  const canToggle = filtered.length > defaultLimit;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-4 border-b border-border p-3">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Policy:</span>
          {(["all", "Distributing", "Accumulating"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPolicy(p)}
              className={chipCls(policy === p)}
              type="button"
            >
              {p === "all" ? "All" : p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Domicile:</span>
          {(["all", "UCITS", "US"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDomicile(d)}
              className={chipCls(domicile === d)}
              type="button"
            >
              {d === "all" ? "All" : d}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {rows.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="text-left">
              <th className="px-3 py-2 cursor-pointer select-none" onClick={() => setSort("ticker")}>
                Ticker{sortIndicator("ticker")}
              </th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Policy</th>
              <th
                className="px-3 py-2 text-right cursor-pointer select-none"
                onClick={() => setSort("ter")}
              >
                TER{sortIndicator("ter")}
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer select-none"
                onClick={() => setSort("aum")}
              >
                AUM{sortIndicator("aum")}
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer select-none"
                onClick={() => setSort("quality_headline")}
              >
                Quality{sortIndicator("quality_headline")}
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.ticker} className="border-t border-border hover:bg-secondary/40">
                <td className="px-3 py-2 font-mono">
                  <Link
                    href={`/app/inspect/${encodeURIComponent(r.ticker)}`}
                    className="hover:text-foreground"
                  >
                    {r.ticker}
                  </Link>
                </td>
                <td className="px-3 py-2 truncate max-w-[280px]">{r.name}</td>
                <td className="px-3 py-2">{r.distribution_policy ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtTer(r.ter)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtAum(r.aum)}</td>
                <td
                  className="px-3 py-2 text-right font-mono tabular-nums"
                  style={{
                    color:
                      r.quality_headline != null
                        ? rampColor(r.quality_headline)
                        : "inherit",
                  }}
                >
                  {r.quality_headline ?? "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No ETFs match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {canToggle && (
        <div className="border-t border-border p-3 text-center">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? "Show less" : `Show all (${filtered.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
