"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { Trash2, Clock } from "lucide-react";
import type { QuoteResult } from "@/lib/market/quote";
import type { HoldingScore } from "@/lib/scoring/portfolio-scores";
import type { ScoreType } from "@/lib/scoring/chip-display";
import { resolveRowIncome, type RowIncomeStatus } from "@/lib/portfolio/row-income";
import { resolveRowValue, type RowValueStatus, type TickerPrice } from "@/lib/portfolio/row-value";
import { actualKey, type ActualIncome } from "@/lib/portfolio/income";
import { formatMoney } from "@/lib/portfolio/format-money";
import {
  sortHoldings,
  SORT_LABELS,
  DEFAULT_SORT,
  type SortKey,
} from "@/lib/portfolio/sort-holdings";
import { ScoreChip } from "./score-chip";
import { ScoreDrawer } from "./score-drawer";
import { UpgradePill } from "./upgrade-pill";
import { VehicleChip } from "./vehicle-chip";
import type { VehicleType } from "@/lib/scoring/load-vehicle-score";
import { SortSelect } from "@/app/app/_components/SortSelect";

type HoldingRow = {
  id: string;
  ticker: string;
  quantity: number;
  avg_cost: number;
  cost_currency: string;
  wrapper: string;
  broker_label: string | null;
  notes: string | null;
  created_at: string;
  source?: "manual" | "trading212" | "csv";
};

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

// Provenance shown in the Broker column: a synced row gets a "Trading 212"
// badge; a manual row falls back to its free-text broker label (or a dash).
function BrokerCell({ row }: { row: HoldingRow }) {
  if (row.source === "trading212") {
    return (
      <span className="inline-flex items-center rounded-full border border-brand-500/30 bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:border-brand-400/20 dark:bg-brand-900/20 dark:text-brand-300">
        Trading 212
      </span>
    );
  }
  return row.broker_label ? (
    <span className="text-muted-foreground">{row.broker_label}</span>
  ) : (
    <span className="text-muted-foreground/60">—</span>
  );
}

const WRAPPER_LABEL: Record<string, string> = {
  isa: "ISA",
  sipp: "SIPP",
  gia: "GIA",
  "401k": "401(k)",
  ira: "IRA",
  roth_ira: "Roth IRA",
  brokerage: "Brokerage",
};

const CURRENCY_PREFIX: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
};

function formatQuantity(n: number): string {
  const fixed = n.toFixed(6).replace(/\.?0+$/, "");
  return fixed === "" ? "0" : fixed;
}

function formatCost(value: number, currency: string): string {
  const prefix = CURRENCY_PREFIX[currency] ?? "";
  return `${prefix}${value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

function formatIncome(amount: number, currency: string): string {
  const prefix = CURRENCY_PREFIX[currency] ?? "";
  const formatted = Math.round(amount).toLocaleString("en-GB");
  return prefix ? `${prefix}${formatted}/yr` : `${formatted} ${currency}/yr`;
}

interface IncomeCellProps {
  status: RowIncomeStatus;
  className?: string;
}

function IncomeCell({ status, className }: IncomeCellProps) {
  if (status.kind === "ok") {
    return (
      <span
        title={
          status.source === "actual"
            ? "Your real dividends from the last 12 months, synced from your broker."
            : "Estimated from the latest annual dividend per share."
        }
        className={`font-mono tabular-nums text-foreground ${className ?? ""}`}
      >
        {formatIncome(status.amount, status.currency)}
      </span>
    );
  }
  if (status.kind === "no_data") {
    return (
      <span
        title="No dividend data yet. New holdings get figures after the next nightly update."
        className={`cursor-help text-muted-foreground/70 ${className ?? ""}`}
      >
        —
      </span>
    );
  }
  return (
    <span
      title="Try refreshing the page."
      className={`cursor-help italic text-muted-foreground ${className ?? ""}`}
    >
      couldn&apos;t fetch
    </span>
  );
}

// Position value: quantity × latest FMP price. "—" until the nightly cron prices it.
function ValueCell({ status, className }: { status: RowValueStatus; className?: string }) {
  if (status.kind === "ok") {
    return (
      <span
        title="Estimated position value: quantity × latest price."
        className={`font-mono tabular-nums text-foreground ${className ?? ""}`}
      >
        {formatMoney(status.amount, status.currency)}
      </span>
    );
  }
  return (
    <span
      title="Value appears after the next nightly price update."
      className={`cursor-help text-muted-foreground/70 ${className ?? ""}`}
    >
      —
    </span>
  );
}

// Real dividends received in the trailing 12 months, from broker sync. "—" if none.
function ReceivedCell({ actual, className }: { actual?: ActualIncome; className?: string }) {
  if (actual && actual.amount > 0 && actual.currency) {
    return (
      <span
        title="Dividends actually received in the last 12 months, synced from your broker."
        className={`font-mono tabular-nums text-foreground ${className ?? ""}`}
      >
        {formatMoney(actual.amount, actual.currency)}
      </span>
    );
  }
  return (
    <span
      title="No broker-synced dividends in the last 12 months. Connect a broker to track what you actually received."
      className={`cursor-help text-muted-foreground/70 ${className ?? ""}`}
    >
      —
    </span>
  );
}

type OpenScore = (ticker: string, type: ScoreType) => void;

// Shown for a holding the nightly cron hasn't scored yet (e.g. just added).
// The scoring job refreshes every ticker overnight, so this resolves on its own.
function PendingScorePill() {
  return (
    <span
      data-testid="pending-score-pill"
      title="New holding. Scores refresh overnight and appear after the next nightly update."
      className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground"
    >
      <Clock className="h-3 w-3" aria-hidden="true" />
      Collecting…
    </span>
  );
}

// The three-chip stack + action hint shown in the desktop score column.
function ScoreChipStack({
  score,
  isBeta,
  onOpen,
}: {
  score: HoldingScore;
  isBeta: boolean;
  onOpen: OpenScore;
}) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex items-center gap-1">
        <ScoreChip
          type="buy"
          score={score.buy}
          gateReason={score.buyGateReason}
          delta={score.deltas.buy}
          hidden={score.hidden.buy}
          isBeta={isBeta}
          onOpen={() => onOpen(score.ticker, "buy")}
        />
        <ScoreChip
          type="trim"
          score={score.trim}
          delta={score.deltas.trim}
          hidden={score.hidden.trim}
          isBeta={isBeta}
          onOpen={() => onOpen(score.ticker, "trim")}
        />
        <ScoreChip
          type="risk"
          score={score.risk}
          delta={score.deltas.risk}
          hidden={score.hidden.risk}
          isBeta={isBeta}
          onOpen={() => onOpen(score.ticker, "risk")}
        />
      </div>
      <span className="text-xs text-muted-foreground">{score.actionHint}</span>
    </div>
  );
}

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
  rows: HoldingRow[];
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

  const isFree = tier === "free";
  const handleOpenScore: OpenScore = (ticker, type) =>
    setOpenScore({ ticker, type });

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

  const handleDelete = (row: HoldingRow) => {
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
      {/* Sort control — applies to both the desktop table and mobile cards. */}
      <div className="mb-3 flex items-center justify-end gap-2">
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

      {/* Desktop / tablet — full table */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40">
              <tr className="text-left text-[12px] font-medium leading-[16px] text-muted-foreground">
                <th scope="col" className="px-4 py-3">
                  Ticker
                </th>
                <th scope="col" className="w-px whitespace-nowrap px-3 py-3">
                  Wrapper
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
                  Value
                </th>
                <th scope="col" className="w-px whitespace-nowrap px-3 py-3 text-right">
                  Income
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
              {sortedRows.map((row) => {
                const pending = pendingIds.has(row.id);
                const incomeStatus = resolveRowIncome(row, quotes, actualsByKey);
                const valueStatus = resolveRowValue(row, priceByTicker ?? {});
                const received = actualsByKey?.[actualKey(row.ticker, row.wrapper)];
                const score = scoresByTicker[row.ticker];
                const vehicle = vehicleScoresByTicker?.[row.ticker];
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-border last:border-b-0 transition-opacity ${
                      pending ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/portfolio/${row.ticker}`}
                        className="font-mono text-sm font-medium text-foreground hover:underline"
                      >
                        {row.ticker}
                      </Link>
                      {nameByTicker?.[row.ticker] && (
                        <span className="mt-0.5 block max-w-[11rem] truncate text-xs text-muted-foreground">
                          {nameByTicker[row.ticker]}
                        </span>
                      )}
                    </td>
                    <td className="w-px whitespace-nowrap px-3 py-3">
                      <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                        {WRAPPER_LABEL[row.wrapper] ?? row.wrapper}
                      </span>
                    </td>
                    {showScoresColumn && (
                      <td className="whitespace-nowrap px-4 py-3 text-left">
                        {vehicle ? (
                          <VehicleChip
                            vehicleType={vehicle.vehicleType}
                            resilienceScore={vehicle.resilienceScore}
                            qualityGatePassed={vehicle.qualityGatePassed}
                          />
                        ) : isFree ? (
                          <UpgradePill pricingPublic={pricingPublic} />
                        ) : score ? (
                          <ScoreChipStack
                            score={score}
                            isBeta={isBeta}
                            onOpen={handleOpenScore}
                          />
                        ) : showScores ? (
                          <PendingScorePill />
                        ) : null}
                      </td>
                    )}
                    <td className="w-px whitespace-nowrap px-3 py-3 text-right font-mono text-foreground">
                      {formatQuantity(Number(row.quantity))}
                    </td>
                    <td className="w-px whitespace-nowrap px-3 py-3 text-right font-mono text-foreground">
                      {formatCost(Number(row.avg_cost), row.cost_currency)}
                    </td>
                    <td className="w-px whitespace-nowrap px-3 py-3 text-right text-sm">
                      <ValueCell status={valueStatus} />
                    </td>
                    <td className="w-px whitespace-nowrap px-3 py-3 text-right text-sm">
                      <IncomeCell status={incomeStatus} />
                    </td>
                    <td className="w-px whitespace-nowrap px-3 py-3 text-right text-sm">
                      <ReceivedCell actual={received} />
                    </td>
                    <td className="w-px whitespace-nowrap px-3 py-3 text-muted-foreground">
                      <BrokerCell row={row} />
                    </td>
                    <td className="w-px whitespace-nowrap px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={pending}
                        aria-label={`Delete ${row.ticker}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
          return (
            <li
              key={row.id}
              className={`rounded-xl border border-border bg-card p-4 transition-opacity ${
                pending ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/app/portfolio/${row.ticker}`}
                    className="block font-mono text-base font-semibold text-foreground hover:underline"
                  >
                    {row.ticker}
                  </Link>
                  {nameByTicker?.[row.ticker] && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {nameByTicker[row.ticker]}
                    </p>
                  )}
                  <span className="mt-1 inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                    {WRAPPER_LABEL[row.wrapper] ?? row.wrapper}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {vehicle ? (
                    <VehicleChip
                      vehicleType={vehicle.vehicleType}
                      resilienceScore={vehicle.resilienceScore}
                      qualityGatePassed={vehicle.qualityGatePassed}
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
                    onClick={() => handleDelete(row)}
                    disabled={pending}
                    aria-label={`Delete ${row.ticker}`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Quantity
                  </dt>
                  <dd className="mt-0.5 font-mono text-foreground">
                    {formatQuantity(Number(row.quantity))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Avg cost
                  </dt>
                  <dd className="mt-0.5 font-mono text-foreground">
                    {formatCost(Number(row.avg_cost), row.cost_currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Value
                  </dt>
                  <dd className="mt-0.5 text-sm">
                    <ValueCell status={valueStatus} />
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

      {showScores && openScore && (
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
    </>
  );
}
