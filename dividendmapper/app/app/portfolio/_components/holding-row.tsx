"use client";

import { useRouter } from "next/navigation";
import { Trash2, Clock, Pencil } from "lucide-react";
import type { QuoteResult } from "@/lib/market/quote";
import type { HoldingScore } from "@/lib/scoring/portfolio-scores";
import type { ScoreType } from "@/lib/scoring/chip-display";
import {
  resolveRowIncome,
  type RowIncomeStatus,
} from "@/lib/portfolio/row-income";
import {
  resolveRowValue,
  type RowValueStatus,
  type TickerPrice,
} from "@/lib/portfolio/row-value";
import { actualKey, type ActualIncome } from "@/lib/portfolio/income";
import { formatMoney } from "@/lib/portfolio/format-money";
import { ScoreChip } from "./score-chip";
import { UpgradePill } from "./upgrade-pill";
import { VehicleChip } from "./vehicle-chip";
import { HoldingLogo } from "./holding-logo";
import { RowSparkline } from "./row-sparkline";
import { PortfolioBar } from "./portfolio-bar";
import type {
  SparklineRange,
  SparklineSeries,
} from "@/lib/portfolio/load-sparkline-series";
import type { Density } from "./density-toggle";
import type { VehicleChipData } from "./holdings-table";

export type HoldingRowData = {
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

export type OpenScore = (ticker: string, type: ScoreType) => void;

export const WRAPPER_LABEL: Record<string, string> = {
  isa: "ISA",
  sipp: "SIPP",
  gia: "GIA",
  "401k": "401(k)",
  ira: "IRA",
  roth_ira: "Roth IRA",
  brokerage: "Brokerage",
};

export const CURRENCY_PREFIX: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
};

export function formatQuantity(n: number): string {
  const fixed = n.toFixed(6).replace(/\.?0+$/, "");
  return fixed === "" ? "0" : fixed;
}

export function formatCost(value: number, currency: string): string {
  const prefix = CURRENCY_PREFIX[currency] ?? "";
  return `${prefix}${value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

export function formatIncome(amount: number, currency: string): string {
  const prefix = CURRENCY_PREFIX[currency] ?? "";
  const formatted = Math.round(amount).toLocaleString("en-GB");
  return prefix ? `${prefix}${formatted}/yr` : `${formatted} ${currency}/yr`;
}

// Provenance shown in the Broker column: a synced row gets a "Trading 212"
// badge; a manual row falls back to its free-text broker label (or a dash).
export function BrokerCell({ row }: { row: HoldingRowData }) {
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

interface IncomeCellProps {
  status: RowIncomeStatus;
  className?: string;
}

export function IncomeCell({ status, className }: IncomeCellProps) {
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
export function ValueCell({
  status,
  className,
}: {
  status: RowValueStatus;
  className?: string;
}) {
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
export function ReceivedCell({
  actual,
  className,
}: {
  actual?: ActualIncome;
  className?: string;
}) {
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

// Shown for a holding the nightly cron hasn't scored yet (e.g. just added).
// The scoring job refreshes every ticker overnight, so this resolves on its own.
export function PendingScorePill() {
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
export function ScoreChipStack({
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

interface HoldingRowProps {
  row: HoldingRowData;
  pending: boolean;
  nameByTicker?: Record<string, string>;
  quotes: Record<string, QuoteResult>;
  actualsByKey?: Record<string, ActualIncome>;
  priceByTicker?: Record<string, TickerPrice>;
  score?: HoldingScore;
  vehicle?: VehicleChipData;
  showScoresColumn: boolean;
  showScores: boolean;
  isFree: boolean;
  pricingPublic: boolean;
  isBeta: boolean;
  sparklineRange: SparklineRange;
  sparklineSeries: SparklineSeries | null;
  totalVisibleValue: number;
  density: Density;
  /** Accumulating swaps the income figure for a pill. */
  distributionPolicy?: "Distributing" | "Accumulating" | "Unknown";
  /** "etf" surfaces a small badge next to the ticker. */
  assetType?: string;
  onOpenScore: OpenScore;
  onOpenVehicleScore: (ticker: string) => void;
  onDelete: (row: HoldingRowData) => void;
}

export function HoldingRow({
  row,
  pending,
  nameByTicker,
  quotes,
  actualsByKey,
  priceByTicker,
  score,
  vehicle,
  showScoresColumn,
  showScores,
  isFree,
  pricingPublic,
  isBeta,
  sparklineRange,
  sparklineSeries,
  totalVisibleValue,
  density,
  distributionPolicy,
  assetType,
  onOpenScore,
  onOpenVehicleScore,
  onDelete,
}: HoldingRowProps) {
  const router = useRouter();
  const incomeStatus = resolveRowIncome(row, quotes, actualsByKey);
  const valueStatus = resolveRowValue(row, priceByTicker ?? {});
  const received = actualsByKey?.[actualKey(row.ticker, row.wrapper)];
  const cellPad = density === "compact" ? "py-2" : "py-3";

  function handleRowClick(e: React.MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input")) return;
    const sel =
      typeof window !== "undefined" ? window.getSelection() : null;
    if (
      sel &&
      sel.toString().length > 0 &&
      e.currentTarget.contains(sel.anchorNode as Node)
    ) {
      return;
    }
    router.push(`/app/portfolio/${row.ticker}`);
  }

  function handleRowKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/app/portfolio/${row.ticker}`);
    }
  }

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      aria-label={`Open ${row.ticker} details`}
      className={`group cursor-pointer border-b border-border last:border-b-0 transition-all hover:bg-secondary/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset [box-shadow:inset_0_1px_0_rgb(255_255_255/0.04),inset_0_-1px_0_rgb(0_0_0/0.15)] hover:[box-shadow:inset_0_1px_0_rgb(255_255_255/0.07),inset_0_-1px_0_rgb(0_0_0/0.25)] ${
        pending ? "opacity-50" : ""
      }`}
    >
      <td
        data-testid={`row-ticker-cell-${row.ticker}`}
        className={`px-4 ${cellPad}`}
      >
        <div className="flex items-center gap-3">
          <HoldingLogo
            ticker={row.ticker}
            name={nameByTicker?.[row.ticker]}
          />
          <div className="min-w-0">
            <span className="flex items-center font-mono text-sm font-medium text-foreground">
              {row.ticker}
              {assetType === "etf" && (
                <span className="ml-2 inline-flex items-center rounded-full bg-secondary/40 px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border">
                  ETF
                </span>
              )}
            </span>
            {nameByTicker?.[row.ticker] && (
              <span className="mt-0.5 block max-w-[14rem] truncate text-xs text-muted-foreground">
                {nameByTicker[row.ticker]}
              </span>
            )}
            <span className="mt-0.5 block text-[11px] uppercase tracking-wider text-muted-foreground/80">
              {WRAPPER_LABEL[row.wrapper] ?? row.wrapper} ·{" "}
              {row.cost_currency}
            </span>
          </div>
        </div>
      </td>
      <td className={`w-[140px] px-2 ${cellPad}`}>
        <RowSparkline
          ticker={row.ticker}
          name={nameByTicker?.[row.ticker]}
          range={sparklineRange}
          series={sparklineSeries}
        />
      </td>
      {showScoresColumn && (
        <td className={`whitespace-nowrap px-4 ${cellPad} text-left`}>
          {vehicle ? (
            <VehicleChip
              vehicleType={vehicle.vehicleType}
              resilienceScore={vehicle.resilienceScore}
              qualityGatePassed={vehicle.qualityGatePassed}
              onOpen={() => onOpenVehicleScore(row.ticker)}
            />
          ) : isFree ? (
            <UpgradePill pricingPublic={pricingPublic} />
          ) : score ? (
            <ScoreChipStack
              score={score}
              isBeta={isBeta}
              onOpen={onOpenScore}
            />
          ) : showScores ? (
            <PendingScorePill />
          ) : null}
        </td>
      )}
      <td
        data-testid={`row-quantity-${row.id}`}
        title={String(row.quantity)}
        className={`w-px whitespace-nowrap px-3 ${cellPad} text-right font-mono text-foreground`}
      >
        {Number(row.quantity).toLocaleString("en-GB", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </td>
      <td
        data-testid={`row-cost-${row.id}`}
        title={String(row.avg_cost)}
        className={`w-px whitespace-nowrap px-3 ${cellPad} text-right font-mono text-foreground`}
      >
        {formatMoney(Number(row.avg_cost), row.cost_currency, { dp: 2 })}
      </td>
      <td
        data-testid={`row-value-${row.id}`}
        className={`relative w-px whitespace-nowrap px-3 ${cellPad} text-right text-sm`}
      >
        <ValueCell status={valueStatus} />
        {valueStatus.kind === "ok" && (
          <PortfolioBar
            value={valueStatus.amount}
            totalValue={totalVisibleValue}
          />
        )}
      </td>
      <td className={`w-px whitespace-nowrap px-3 ${cellPad} text-right text-sm`}>
        {distributionPolicy === "Accumulating" ? (
          <span className="inline-flex items-center rounded-full bg-secondary/40 px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border">
            Accumulating
          </span>
        ) : (
          <IncomeCell status={incomeStatus} />
        )}
      </td>
      <td className={`w-px whitespace-nowrap px-3 ${cellPad} text-right text-sm`}>
        <ReceivedCell actual={received} />
      </td>
      <td className={`w-px whitespace-nowrap px-3 ${cellPad} text-muted-foreground`}>
        <BrokerCell row={row} />
      </td>
      <td className={`w-px whitespace-nowrap px-3 ${cellPad} text-right`}>
        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <button
            type="button"
            aria-disabled="true"
            aria-label={`Edit ${row.ticker}`}
            title="Edit coming soon"
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground opacity-50"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(row);
            }}
            disabled={pending}
            aria-label={`Delete ${row.ticker}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}
