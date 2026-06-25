"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, Lock, ArrowUp, ArrowDown, Star, Plus, Check, AlertCircle } from "lucide-react";
import { SaveScreenModal } from "@/app/app/income-vehicles/_components/save-screen-modal";
import { captureClientEvent } from "@/lib/analytics/posthog-capture";
import type { VehicleUniverseRow } from "@/lib/scoring/load-vehicle-universe";
import type { VehicleType } from "@/lib/scoring/load-vehicle-score";
import { VEHICLE_FAMILIES } from "@/lib/scoring/data/vehicle-families";
import {
  filterVehicles,
  searchVehicles,
  sortVehicles,
  type FamilyChoice,
  type ScreenerCriteria,
  type SortKey,
  type SortDir,
} from "@/lib/portfolio/income-vehicle-screener";

const FAMILY_LABELS: Record<FamilyChoice, string> = {
  all: "All families",
  us_reit: "REITs",
  us_bdc: "BDCs",
  uk_reit: "UK REITs",
};

const FAMILY_ORDER: FamilyChoice[] = ["all", "us_reit", "us_bdc", "uk_reit"];

function rampColor(score: number): string {
  if (score < 25) return "var(--color-resilience-1)";
  if (score < 50) return "var(--color-resilience-2)";
  if (score < 75) return "var(--color-resilience-3)";
  if (score < 90) return "var(--color-resilience-4)";
  return "var(--color-resilience-5)";
}

function formatYield(decimal: number | null): string {
  if (decimal === null || !Number.isFinite(decimal)) return "—";
  return `${(decimal * 100).toFixed(1)}%`;
}

function familySlug(type: VehicleType): string {
  return VEHICLE_FAMILIES[type].slug;
}

// Sub-sector keys come from FMP/EDGAR as snake_case (e.g. retail_net_lease).
// Display them as Title Case ("Retail Net Lease") in the UI.
function humanizeSubSector(slug: string): string {
  return slug
    .split("_")
    .map((w) => (w === "uk" ? "UK" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export interface ScreenerProps {
  universe: ReadonlyArray<VehicleUniverseRow>;
  /** If true, "Save screen" renders as an active button instead of a lock pill. */
  showSaveScreenAction?: boolean;
  /**
   * Controlled criteria mode (used by the in-app hub so the SavedScreensRail
   * can drive the filter). When both criteria and onCriteriaChange are
   * passed, internal state is bypassed. Pass neither for uncontrolled mode
   * (the default — used by the public hub).
   */
  criteria?: ScreenerCriteria;
  onCriteriaChange?: (next: ScreenerCriteria) => void;
  /** Fires after a successful POST /api/screens — the rail uses it to refetch. */
  onSaved?: () => void;
  /**
   * When provided, the "Only my holdings" toggle is rendered in the filter
   * strip. When the toggle is on, the universe is narrowed to these tickers
   * before filter + search + sort run. Pro-only surface (passed by /app/...).
   */
  ownedTickers?: ReadonlyArray<string>;
  /**
   * Pro-only: per-row "add to watchlist" + "add to portfolio" icons appear
   * when this is true. Wired through to the existing tracked-tickers POST
   * endpoint (star — instant) and the Ledger add-holding modal (plus —
   * needs quantity + cost, not solvable from one click). No-op on the
   * public surface.
   */
  showRowActions?: boolean;
  /**
   * Customise the per-row ticker click target. Defaults to the public
   * family route `/{slug}/{ticker}` (used by the public hub). The in-app
   * hub overrides this to `/app/income-vehicles/{ticker}` so Pro users
   * stay inside the /app drawer shell.
   */
  tickerHrefBuilder?: (ticker: string, vehicleType: VehicleType) => string;
}

const INITIAL_CRITERIA: ScreenerCriteria = {
  family: "all",
  minResilience: 0,
  subSector: null,
  gatePassedOnly: false,
};

export function Screener({
  universe,
  showSaveScreenAction = false,
  criteria: controlledCriteria,
  onCriteriaChange,
  ownedTickers,
  showRowActions = false,
  onSaved,
  tickerHrefBuilder,
}: ScreenerProps) {
  const buildTickerHref = tickerHrefBuilder ??
    ((ticker: string, vt: VehicleType) => `/${familySlug(vt)}/${ticker}`);
  const [query, setQuery] = useState("");
  const [restrictToOwned, setRestrictToOwned] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  // Per-ticker action status — undefined = idle, then "saving" | "saved" | "error".
  const [rowState, setRowState] = useState<Record<string, "saving" | "saved" | "error">>({});

  async function addToWatchlist(ticker: string) {
    setRowState((s) => ({ ...s, [ticker]: "saving" }));
    const res = await fetch("/api/portfolio/tracked-tickers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    });
    // 201 = added, 409 = already watching (still a success from the user's POV).
    setRowState((s) => ({
      ...s,
      [ticker]: res.ok || res.status === 409 ? "saved" : "error",
    }));
    // Auto-clear after 2.5s so the row returns to its resting state.
    setTimeout(() => {
      setRowState((s) => {
        const next = { ...s };
        delete next[ticker];
        return next;
      });
    }, 2500);
  }
  const [internalCriteria, setInternalCriteria] = useState<ScreenerCriteria>(INITIAL_CRITERIA);
  const isControlled = controlledCriteria !== undefined && onCriteriaChange !== undefined;
  const criteria = isControlled ? controlledCriteria! : internalCriteria;
  const setCriteria = (
    updater: ScreenerCriteria | ((prev: ScreenerCriteria) => ScreenerCriteria),
  ) => {
    const next =
      typeof updater === "function"
        ? (updater as (prev: ScreenerCriteria) => ScreenerCriteria)(criteria)
        : updater;
    if (isControlled) onCriteriaChange!(next);
    else setInternalCriteria(next);
  };
  const [sortKey, setSortKey] = useState<SortKey>("resilience");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Sub-sector dropdown is derived from the family-filtered universe — picking
  // family=BDCs and then switching to UK REITs would otherwise leave a stale
  // BDC-only sub-sector selected, hiding all rows with no UI hint why.
  const subSectors = useMemo(() => {
    const familyView =
      criteria.family === "all"
        ? universe
        : universe.filter((r) => r.vehicleType === criteria.family);
    const set = new Set<string>();
    for (const r of familyView) if (r.subSector) set.add(r.subSector);
    return [...set].sort();
  }, [universe, criteria.family]);

  const filtered = useMemo(() => {
    // Owned-only narrowing runs BEFORE the criteria/search/sort chain so the
    // count and downstream filters reflect the restricted set.
    const ownedSet =
      ownedTickers && restrictToOwned ? new Set(ownedTickers) : null;
    const visible = ownedSet
      ? universe.filter((r) => ownedSet.has(r.ticker))
      : universe;
    const byCriteria = filterVehicles(visible, criteria);
    const hasQuery = query.trim().length > 0;
    if (hasQuery) {
      // Search owns the row order — exact ticker first, then prefix, then
      // substring. Re-sorting would destroy that ranking.
      return searchVehicles(byCriteria, query);
    }
    return sortVehicles(byCriteria, sortKey, sortDir);
  }, [universe, criteria, query, sortKey, sortDir, ownedTickers, restrictToOwned]);

  // Debounced search-event — fire once the user has stopped typing for 500ms.
  // captureClientEvent no-ops in tests (jsdom + no PostHog init).
  useEffect(() => {
    if (query.trim().length === 0) return;
    const id = setTimeout(() => {
      captureClientEvent("income_vehicle_hub_search", {
        query: query.trim(),
        resultCount: filtered.length,
      });
    }, 500);
    return () => clearTimeout(id);
  }, [query, filtered.length]);

  // Reset sub-sector when switching family if the current value is no longer
  // a valid option in the new family's set.
  function setFamily(next: FamilyChoice) {
    setCriteria((c) => {
      const familyRows =
        next === "all" ? universe : universe.filter((r) => r.vehicleType === next);
      const stillValid =
        c.subSector !== null && familyRows.some((r) => r.subSector === c.subSector);
      return { ...c, family: next, subSector: stillValid ? c.subSector : null };
    });
    captureClientEvent("income_vehicle_hub_filter", {
      family: next,
      minResilience: criteria.minResilience,
      subSector: criteria.subSector,
      gatePassed: criteria.gatePassedOnly,
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "ticker" ? "asc" : "desc");
    }
  }

  const count = filtered.length;
  const countLabel = count === 1 ? "1 vehicle" : `${count} vehicles`;

  return (
    <div className="space-y-4">
      {/* Hero search */}
      <div className="rounded-xl border border-border bg-card p-4">
        <label htmlFor="vehicle-search" className="sr-only">
          Search by ticker or name
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3">
          <Search aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          <input
            id="vehicle-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ticker or name — e.g. O, MAIN, British Land"
            className="h-10 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Filter strip */}
      <div className="sticky top-16 z-10 rounded-xl border border-border bg-background/95 backdrop-blur-sm p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {FAMILY_ORDER.map((f) => {
            const active = criteria.family === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFamily(f)}
                className={`rounded-full px-3 py-1 transition-colors ${
                  active
                    ? "bg-foreground text-background"
                    : "border border-border text-foreground hover:bg-secondary"
                }`}
              >
                {FAMILY_LABELS[f]}
              </button>
            );
          })}
          <span className="ml-2 flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
            <span className="text-muted-foreground">Resilience ≥</span>
            <input
              type="number"
              min={0}
              max={100}
              value={criteria.minResilience}
              onChange={(e) =>
                setCriteria((c) => ({
                  ...c,
                  minResilience: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                }))
              }
              className="w-12 bg-transparent text-right font-mono tabular-nums text-foreground outline-none"
            />
          </span>
          <select
            value={criteria.subSector ?? ""}
            onChange={(e) =>
              setCriteria((c) => ({
                ...c,
                subSector: e.target.value === "" ? null : e.target.value,
              }))
            }
            className="rounded-full border border-border bg-transparent px-3 py-1 text-foreground"
          >
            <option value="">All sub-sectors</option>
            {subSectors.map((s) => (
              <option key={s} value={s}>
                {humanizeSubSector(s)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
            <input
              type="checkbox"
              checked={criteria.gatePassedOnly}
              onChange={(e) =>
                setCriteria((c) => ({ ...c, gatePassedOnly: e.target.checked }))
              }
            />
            <span>Gate passed</span>
          </label>
          {ownedTickers && (
            <label className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
              <input
                type="checkbox"
                checked={restrictToOwned}
                onChange={(e) => setRestrictToOwned(e.target.checked)}
                aria-label="Only my holdings"
              />
              <span>Only my holdings</span>
            </label>
          )}
        </div>
      </div>

      {/* Results table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-baseline justify-between gap-3 border-b border-border p-3">
          <p className="text-sm font-medium text-foreground">
            Filtered results — {countLabel}
          </p>
          {showSaveScreenAction ? (
            <button
              type="button"
              onClick={() => setSaveOpen(true)}
              className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary"
            >
              Save this screen
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock aria-hidden="true" className="h-3 w-3" /> Save screen (Pro)
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">
                  <SortHeader
                    label="Ticker"
                    sortKey="ticker"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onToggle={toggleSort}
                  />
                </th>
                <th scope="col" className="px-3 py-2">Name</th>
                <th scope="col" className="px-3 py-2">Sub-sector</th>
                <th scope="col" className="px-3 py-2 text-right">
                  <SortHeader
                    label="Resilience"
                    sortKey="resilience"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onToggle={toggleSort}
                    align="right"
                  />
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  <SortHeader
                    label="Yield"
                    sortKey="yield"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onToggle={toggleSort}
                    align="right"
                  />
                </th>
                {showRowActions && (
                  <th scope="col" className="w-px px-3 py-2 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && restrictToOwned && ownedTickers && (
                <tr>
                  <td
                    colSpan={showRowActions ? 6 : 5}
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                  >
                    {ownedTickers.length === 0
                      ? "You haven't added any income vehicles to your holdings or watchlist yet."
                      : "None of your holdings or watchlist tickers are in the scored universe yet."}
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.ticker} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 font-mono font-medium">
                    <Link
                      href={buildTickerHref(r.ticker, r.vehicleType)}
                      onClick={() => {
                        captureClientEvent("income_vehicle_hub_row_click", {
                          ticker: r.ticker,
                          vehicleType: r.vehicleType,
                        });
                      }}
                      className="hover:underline"
                    >
                      {r.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-foreground">{r.displayName}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.subSector ? humanizeSubSector(r.subSector) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {r.resilienceScore === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className="font-bold"
                        style={{ color: rampColor(r.resilienceScore) }}
                      >
                        {r.resilienceScore}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatYield(r.dividendYield)}
                  </td>
                  {showRowActions && (
                    <td className="w-px whitespace-nowrap px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(() => {
                          const state = rowState[r.ticker];
                          const Icon =
                            state === "saved"
                              ? Check
                              : state === "error"
                                ? AlertCircle
                                : Star;
                          const label =
                            state === "saved"
                              ? `${r.ticker} added to watchlist`
                              : state === "error"
                                ? `Could not add ${r.ticker} — try again`
                                : `Add ${r.ticker} to watchlist`;
                          const tone =
                            state === "saved"
                              ? "text-[color:var(--color-resilience-5)]"
                              : state === "error"
                                ? "text-destructive"
                                : "text-muted-foreground hover:text-foreground";
                          return (
                            <button
                              type="button"
                              aria-label={label}
                              title={label}
                              disabled={state === "saving"}
                              onClick={(e) => {
                                e.stopPropagation();
                                void addToWatchlist(r.ticker);
                              }}
                              className={`rounded-md p-1 hover:bg-secondary disabled:opacity-50 ${tone}`}
                            >
                              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          );
                        })()}
                        <button
                          type="button"
                          aria-label={`Add ${r.ticker} to portfolio`}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/app/portfolio?addTicker=${encodeURIComponent(r.ticker)}`;
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showSaveScreenAction && (
        <SaveScreenModal
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          onSave={async (name) => {
            const res = await fetch("/api/screens", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, filterState: criteria }),
            });
            if (!res.ok) throw new Error("save_failed");
            captureClientEvent("income_vehicle_hub_save_screen", {
              filterState: criteria,
              name,
            });
            onSaved?.();
          }}
        />
      )}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  activeDir,
  onToggle,
  align,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  activeDir: SortDir;
  onToggle: (key: SortKey) => void;
  align?: "right";
}) {
  const active = activeKey === sortKey;
  const Icon = active ? (activeDir === "asc" ? ArrowUp : ArrowDown) : null;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className={`inline-flex items-center gap-1 hover:text-foreground ${
        align === "right" ? "ml-auto" : ""
      } ${active ? "text-foreground" : ""}`}
    >
      <span>{label}</span>
      {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
    </button>
  );
}
