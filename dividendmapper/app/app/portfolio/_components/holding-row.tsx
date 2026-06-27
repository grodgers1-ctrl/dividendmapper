"use client";

import Link from "next/link";
import { Trash2, Clock } from "lucide-react";
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
  onOpenScore,
  onOpenVehicleScore,
  onDelete,
}: HoldingRowProps) {
  const incomeStatus = resolveRowIncome(row, quotes, actualsByKey);
  const valueStatus = resolveRowValue(row, priceByTicker ?? {});
  const received = actualsByKey?.[actualKey(row.ticker, row.wrapper)];

  return (
    <tr
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
      <td className="w-[140px] px-2 py-3">
        {/* Sparkline lands in Task 17 */}
      </td>
      {showScoresColumn && (
        <td className="whitespace-nowrap px-4 py-3 text-left">
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
          onClick={() => onDelete(row)}
          disabled={pending}
          aria-label={`Delete ${row.ticker}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}
