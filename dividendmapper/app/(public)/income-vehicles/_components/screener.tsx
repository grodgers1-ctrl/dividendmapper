"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Lock, ArrowUp, ArrowDown } from "lucide-react";
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
}: ScreenerProps) {
  const [query, setQuery] = useState("");
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
    const byCriteria = filterVehicles(universe, criteria);
    const hasQuery = query.trim().length > 0;
    if (hasQuery) {
      // Search owns the row order — exact ticker first, then prefix, then
      // substring. Re-sorting would destroy that ranking.
      return searchVehicles(byCriteria, query);
    }
    return sortVehicles(byCriteria, sortKey, sortDir);
  }, [universe, criteria, query, sortKey, sortDir]);

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
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.ticker} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 font-mono font-medium">
                    <Link
                      href={`/${familySlug(r.vehicleType)}/${r.ticker}`}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
