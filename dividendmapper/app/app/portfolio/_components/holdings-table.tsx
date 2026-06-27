"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { Trash2, ArrowDown, Pencil } from "lucide-react";
import type { QuoteResult } from "@/lib/market/quote";
import type { HoldingScore } from "@/lib/scoring/portfolio-scores";
import type { ScoreType } from "@/lib/scoring/chip-display";
import { resolveRowIncome } from "@/lib/portfolio/row-income";
import { resolveRowValue, type TickerPrice } from "@/lib/portfolio/row-value";
import { actualKey, type ActualIncome } from "@/lib/portfolio/income";
import {
  sortHoldings,
  SORT_LABELS,
  DEFAULT_SORT,
  type SortKey,
} from "@/lib/portfolio/sort-holdings";
import { ScoreDrawer } from "./score-drawer";
import { UpgradePill } from "./upgrade-pill";
import { VehicleChip } from "./vehicle-chip";
import type { VehicleType } from "@/lib/scoring/load-vehicle-score";
import { captureClientEvent } from "@/lib/analytics/posthog-capture";
import { SortSelect } from "@/app/app/_components/SortSelect";
import type {
  SparklineRange,
  SparklineSeries,
} from "@/lib/portfolio/load-sparkline-series";
import {
  RANGE_STORAGE_KEY,
  RANGE_CHANGE_EVENT,
  readStoredRange,
  RangeToggle,
} from "./range-toggle";
import {
  DENSITY_STORAGE_KEY,
  DENSITY_CHANGE_EVENT,
  readStoredDensity,
  DensityToggle,
  type Density,
} from "./density-toggle";
import { WrapperFilterChips } from "./wrapper-filter-chips";
import { HoldingLogo } from "./holding-logo";
import { RowSparkline } from "./row-sparkline";
import { PortfolioBar } from "./portfolio-bar";
import { formatMoney } from "@/lib/portfolio/format-money";
import {
  HoldingRow,
  BrokerCell,
  IncomeCell,
  ValueCell,
  ReceivedCell,
  PendingScorePill,
  ScoreChipStack,
  WRAPPER_LABEL,
  formatQuantity,
  formatCost,
  type HoldingRowData,
  type OpenScore,
} from "./holding-row";

const SORT_STORAGE_KEY = "dm.holdings-sort";
const SORT_CHANGE_EVENT = "dm:holdings-sort-change";

function readStoredSortKey(): SortKey {
  if (typeof window === "undefined") return DEFAULT_SORT;
  const saved = window.localStorage.getItem(SORT_STORAGE_KEY);
  return saved && saved in SORT_LABELS ? (saved as SortKey) : DEFAULT_SORT;
}

function subscribeSortKey(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === SORT_STORAGE_KEY) callback();
  };
  const onCustom = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(SORT_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SORT_CHANGE_EVENT, onCustom);
  };
}

const getServerSortKey = (): SortKey => DEFAULT_SORT;

function subscribeRange(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === RANGE_STORAGE_KEY) callback();
  };
  const onCustom = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(RANGE_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(RANGE_CHANGE_EVENT, onCustom);
  };
}

const getServerRange = (): SparklineRange => "30D";

function subscribeDensity(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === DENSITY_STORAGE_KEY) callback();
  };
  const onCustom = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(DENSITY_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DENSITY_CHANGE_EVENT, onCustom);
  };
}

const getServerDensity = (): Density => "comfortable";

// Mobile collapses the three chips into one pill that taps to expand.
function MobileScorePill({
  score,
  isBeta,
  onOpen,
}: {
  score: HoldingScore;
  isBeta: boolean;
  onOpen: OpenScore;
}) {
  const [expanded, setExpanded] = useState(false);
  if (expanded) {
    return <ScoreChipStack score={score} isBeta={isBeta} onOpen={onOpen} />;
  }
  return (
    <button
      type="button"
      data-testid="mobile-score-pill"
      onClick={() => setExpanded(true)}
      aria-label="Show Buy, Trim and Risk scores"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 font-mono text-xs font-medium tabular-nums text-foreground shadow-sm shadow-brand-500/20"
    >
      <span>{score.buy ?? "—"}</span>
      <span className="text-muted-foreground">/</span>
      <span>{score.trim ?? "—"}</span>
      <span className="text-muted-foreground">/</span>
      <span>{score.risk ?? "—"}</span>
    </button>
  );
}

export type VehicleChipData = {
  vehicleType: VehicleType;
  resilienceScore: number | null;
  qualityGatePassed: boolean;
};

interface HoldingsTableProps {
  rows: HoldingRowData[];
  quotes: Record<string, QuoteResult>;
  /** Per-holding real synced dividends (TTM), keyed `ticker::wrapper`. */
  actualsByKey?: Record<string, ActualIncome>;
  /** Latest FMP price per ticker (display units), for the Value column. */
  priceByTicker?: Record<string, TickerPrice>;
  /** Company name per ticker; the ticker is shown alone when absent. */
  nameByTicker?: Record<string, string>;
  tier: "free" | "pro" | "premium";
  pricingPublic: boolean;
  isBeta: boolean;
  scoresByTicker: Record<string, HoldingScore>;
  /** Render the Scores column + drawer. False = clean ledger. */
  showScores: boolean;
  /**
   * Vehicle (REIT/BDC/UK REIT) chip data, keyed by ticker. When a row's ticker
   * is here, the row renders a <VehicleChip> in the Scores column even when
   * showScores is false (resilience scores are public, so Pro members see them
   * on /app/portfolio without the equity score column being open).
   */
  vehicleScoresByTicker?: Record<string, VehicleChipData>;
  /** Per-ticker price series for the row sparkline. Plain Record (not Map)
   *  so it survives the RSC boundary — see
   *  reference_rsc_map_serialization. */
  sparklineByTicker?: Record<string, SparklineSeries>;
  /** Distinct wrappers present in the user's visible portfolio (for chip filter).
   *  When omitted, derived from rows. */
  presentWrappers?: string[];
  /** Currently active wrapper filter (URL-driven, null = All). */
  activeWrapper?: string | null;
}

export function HoldingsTable({
  rows,
  quotes,
  actualsByKey,
  priceByTicker,
  nameByTicker,
  tier,
  pricingPublic,
  isBeta,
  scoresByTicker,
  showScores,
  vehicleScoresByTicker,
  sparklineByTicker,
  presentWrappers,
  activeWrapper = null,
}: HoldingsTableProps) {
  const router = useRouter();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const [openScore, setOpenScore] = useState<{ ticker: string; type: ScoreType } | null>(
    null,
  );

  // Sort defaults to value-desc on the server, then hydrates from
  // localStorage on the client without a setState-in-effect lint violation.
  const sortKey = useSyncExternalStore(
    subscribeSortKey,
    readStoredSortKey,
    getServerSortKey,
  );
  const sparklineRange = useSyncExternalStore(
    subscribeRange,
    readStoredRange,
    getServerRange,
  );
  const density = useSyncExternalStore(
    subscribeDensity,
    readStoredDensity,
    getServerDensity,
  );
  const changeSort = (key: SortKey) => {
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, key);
      window.dispatchEvent(new Event(SORT_CHANGE_EVENT));
    } catch {
      // private mode / storage disabled — sorting still works for the session.
    }
  };

  const sortedRows = useMemo(() => {
    const buyScoreByTicker: Record<string, number | null> = {};
    for (const [t, s] of Object.entries(scoresByTicker)) buyScoreByTicker[t] = s.buy;
    return sortHoldings(rows, sortKey, {
      priceByTicker,
      quotes,
      actualsByKey,
      buyScoreByTicker,
    });
  }, [rows, sortKey, priceByTicker, quotes, actualsByKey, scoresByTicker]);

  const totalVisibleValue = useMemo(() => {
    let sum = 0;
    for (const r of sortedRows) {
      const v = resolveRowValue(r, priceByTicker ?? {});
      if (v.kind === "ok") sum += v.amount;
    }
    return sum;
  }, [sortedRows, priceByTicker]);

  const derivedPresentWrappers = useMemo(
    () =>
      presentWrappers ??
      Array.from(new Set(sortedRows.map((r) => r.wrapper))),
    [presentWrappers, sortedRows],
  );

  const isFree = tier === "free";
  const handleOpenScore: OpenScore = (ticker, type) =>
    setOpenScore({ ticker, type });
  const handleOpenVehicleScore = (ticker: string) => {
    const v = vehicleScoresByTicker?.[ticker];
    if (v) {
      captureClientEvent("vehicle_drawer_open", {
        ticker,
        vehicleType: v.vehicleType,
        resilienceScore: v.resilienceScore,
      });
    }
    setOpenScore({ ticker, type: "buy" });
  };

  // The Scores column also surfaces vehicle resilience chips. Show the column
  // header when either equity scores are configured (showScores) OR at least
  // one visible row has a vehicle entry — so /app/portfolio surfaces vehicle
  // chips for Pro even when equity scores are suppressed there.
  const hasAnyVehicleChip =
    vehicleScoresByTicker !== undefined &&
    rows.some((r) => vehicleScoresByTicker[r.ticker] !== undefined);
  const showScoresColumn = showScores || hasAnyVehicleChip;

  const markPending = (id: string, on: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleDelete = (row: HoldingRowData) => {
    const ok = window.confirm(
      `Delete ${row.ticker} (${WRAPPER_LABEL[row.wrapper] ?? row.wrapper})? This can't be undone.`,
    );
    if (!ok) return;

    markPending(row.id, true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/portfolio/holdings/${row.id}`, {
          method: "DELETE",
        });
        if (res.status === 204) {
          router.refresh();
          return;
        }
        markPending(row.id, false);
        if (res.status === 404) {
          window.alert(
            "That holding was already gone, refreshing the table.",
          );
          router.refresh();
          return;
        }
        if (res.status === 401) {
          window.alert(
            "Your session expired. Refresh the page and sign in again.",
          );
          return;
        }
        window.alert("Couldn't delete that holding. Try again.");
      } catch {
        markPending(row.id, false);
        window.alert("Network error. Check your connection and try again.");
      }
    });
  };

  return (
    <>
      {/* Controls row — wrapper filter chips + range + density */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <WrapperFilterChips
          present={derivedPresentWrappers}
          active={activeWrapper}
        />
        <div className="flex items-center gap-2">
          <RangeToggle />
          <DensityToggle />
        </div>
      </div>

      {/* Desktop / tablet — full table */}
      <div className="hidden overflow-clip rounded-xl border border-border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-[56px] z-[5] border-b border-border bg-secondary/95 backdrop-blur supports-[backdrop-filter]:bg-secondary/80 [box-shadow:inset_0_-1px_0_rgb(255_255_255/0.04),inset_0_1px_0_rgb(0_0_0/0.20)]">
              <tr className="text-left text-[12px] font-medium leading-[16px] text-muted-foreground">
                <th scope="col" className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => changeSort("ticker")}
                    aria-label="Sort by Ticker"
                    className="inline-flex items-center gap-1 text-[12px] font-medium leading-[16px] text-muted-foreground hover:text-foreground"
                  >
                    Ticker
                    {sortKey === "ticker" && (
                      <ArrowDown className="h-3 w-3" aria-hidden="true" />
                    )}
                  </button>
                </th>
                <th scope="col" className="w-[140px] px-2 py-3">
                  <span className="sr-only">Sparkline</span>
                </th>
                {showScoresColumn && (
                  <th scope="col" className="px-4 py-3">
                    Scores
                  </th>
                )}
                <th scope="col" className="w-px whitespace-nowrap px-3 py-3 text-right">
                  Quantity
                </th>
                <th scope="col" className="w-px whitespace-nowrap px-3 py-3 text-right">
                  Avg cost
                </th>
                <th scope="col" className="w-px whitespace-nowrap px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => changeSort("value")}
                    aria-label="Sort by Value"
                    className="inline-flex items-center gap-1 text-[12px] font-medium leading-[16px] text-muted-foreground hover:text-foreground"
                  >
                    Value
                    {sortKey === "value" && (
                      <ArrowDown className="h-3 w-3" aria-hidden="true" />
                    )}
                  </button>
                </th>
                <th scope="col" className="w-px whitespace-nowrap px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => changeSort("income")}
                    aria-label="Sort by Income"
                    className="inline-flex items-center gap-1 text-[12px] font-medium leading-[16px] text-muted-foreground hover:text-foreground"
                  >
                    Income
                    {sortKey === "income" && (
                      <ArrowDown className="h-3 w-3" aria-hidden="true" />
                    )}
                  </button>
                </th>
                <th scope="col" className="w-px whitespace-nowrap px-3 py-3 text-right">
                  Received (12m)
                </th>
                <th scope="col" className="w-px whitespace-nowrap px-3 py-3">
                  Broker
                </th>
                <th scope="col" className="w-px whitespace-nowrap px-3 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <HoldingRow
                  key={row.id}
                  row={row}
                  pending={pendingIds.has(row.id)}
                  nameByTicker={nameByTicker}
                  quotes={quotes}
                  actualsByKey={actualsByKey}
                  priceByTicker={priceByTicker}
                  score={scoresByTicker[row.ticker]}
                  vehicle={vehicleScoresByTicker?.[row.ticker]}
                  showScoresColumn={showScoresColumn}
                  showScores={showScores}
                  isFree={isFree}
                  pricingPublic={pricingPublic}
                  isBeta={isBeta}
                  sparklineRange={sparklineRange}
                  sparklineSeries={sparklineByTicker?.[row.ticker] ?? null}
                  totalVisibleValue={totalVisibleValue}
                  density={density}
                  onOpenScore={handleOpenScore}
                  onOpenVehicleScore={handleOpenVehicleScore}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile sort dropdown — desktop uses sortable column headers instead. */}
      <div className="mb-3 flex items-center justify-end gap-2 md:hidden">
        <label
          htmlFor="holdings-sort"
          className="text-[12px] font-medium leading-[16px] text-muted-foreground"
        >
          Sort
        </label>
        <SortSelect
          id="holdings-sort"
          value={sortKey}
          onChange={(v) => changeSort(v as SortKey)}
          options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
            value: k,
            label: SORT_LABELS[k],
          }))}
        />
      </div>

      {/* Mobile — stacked cards */}
      <ul className="space-y-3 md:hidden" aria-label="Your holdings">
        {sortedRows.map((row) => {
          const pending = pendingIds.has(row.id);
          const incomeStatus = resolveRowIncome(row, quotes, actualsByKey);
          const valueStatus = resolveRowValue(row, priceByTicker ?? {});
          const received = actualsByKey?.[actualKey(row.ticker, row.wrapper)];
          const score = scoresByTicker[row.ticker];
          const vehicle = vehicleScoresByTicker?.[row.ticker];
          const series = sparklineByTicker?.[row.ticker] ?? null;
          const openDetail = () =>
            router.push(`/app/portfolio/${row.ticker}`);
          return (
            <li
              key={row.id}
              role="link"
              tabIndex={0}
              aria-label={`Open ${row.ticker} details`}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest("button, a, input")) return;
                const sel =
                  typeof window !== "undefined"
                    ? window.getSelection()
                    : null;
                if (
                  sel &&
                  sel.toString().length > 0 &&
                  e.currentTarget.contains(sel.anchorNode as Node)
                ) {
                  return;
                }
                openDetail();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDetail();
                }
              }}
              className={`cursor-pointer rounded-xl border border-border bg-card p-4 transition-all hover:bg-secondary/40 focus:outline-none focus:ring-2 focus:ring-ring [box-shadow:inset_0_1px_0_rgb(255_255_255/0.04),inset_0_-1px_0_rgb(0_0_0/0.15)] ${
                pending ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <HoldingLogo
                    ticker={row.ticker}
                    name={nameByTicker?.[row.ticker]}
                    size={40}
                  />
                  <div className="min-w-0">
                    <span className="block font-mono text-base font-semibold text-foreground">
                      {row.ticker}
                    </span>
                    {nameByTicker?.[row.ticker] && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {nameByTicker[row.ticker]}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground/80">
                      {WRAPPER_LABEL[row.wrapper] ?? row.wrapper} ·{" "}
                      {row.cost_currency}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {vehicle ? (
                    <VehicleChip
                      vehicleType={vehicle.vehicleType}
                      resilienceScore={vehicle.resilienceScore}
                      qualityGatePassed={vehicle.qualityGatePassed}
                      onOpen={() => handleOpenVehicleScore(row.ticker)}
                    />
                  ) : (
                    showScores &&
                    (isFree ? (
                      <UpgradePill pricingPublic={pricingPublic} />
                    ) : score ? (
                      <MobileScorePill
                        score={score}
                        isBeta={isBeta}
                        onOpen={handleOpenScore}
                      />
                    ) : (
                      <PendingScorePill />
                    ))
                  )}
                  <button
                    type="button"
                    aria-disabled="true"
                    aria-label={`Edit ${row.ticker}`}
                    title="Edit coming soon"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground opacity-50"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(row);
                    }}
                    disabled={pending}
                    aria-label={`Delete ${row.ticker}`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <RowSparkline
                  ticker={row.ticker}
                  name={nameByTicker?.[row.ticker]}
                  range={sparklineRange}
                  series={series}
                />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Quantity
                  </dt>
                  <dd
                    className="mt-0.5 font-mono text-foreground"
                    title={String(row.quantity)}
                  >
                    {Number(row.quantity).toLocaleString("en-GB", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Avg cost
                  </dt>
                  <dd
                    className="mt-0.5 font-mono text-foreground"
                    title={String(row.avg_cost)}
                  >
                    {formatMoney(Number(row.avg_cost), row.cost_currency, {
                      dp: 2,
                    })}
                  </dd>
                </div>
                <div className="relative">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Value
                  </dt>
                  <dd className="mt-0.5 text-sm">
                    <ValueCell status={valueStatus} />
                    {valueStatus.kind === "ok" && (
                      <PortfolioBar
                        value={valueStatus.amount}
                        totalValue={totalVisibleValue}
                      />
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Income
                  </dt>
                  <dd className="mt-0.5 text-sm">
                    <IncomeCell status={incomeStatus} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Received (12m)
                  </dt>
                  <dd className="mt-0.5 text-sm">
                    <ReceivedCell actual={received} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Broker
                  </dt>
                  <dd className="mt-0.5 text-foreground">
                    <BrokerCell row={row} />
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>

      {openScore && (showScores || vehicleScoresByTicker?.[openScore.ticker]) && (
        <ScoreDrawer
          ticker={openScore.ticker}
          scoreType={openScore.type}
          open={true}
          onOpenChange={(o) => {
            if (!o) setOpenScore(null);
          }}
          isBeta={isBeta}
          vehicleType={vehicleScoresByTicker?.[openScore.ticker]?.vehicleType}
        />
      )}
    </>
  );
}
