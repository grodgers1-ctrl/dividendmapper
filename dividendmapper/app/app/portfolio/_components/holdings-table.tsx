"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import type { QuoteResult } from "@/lib/market/quote";

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
};

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

type RowIncomeStatus =
  | { kind: "ok"; amount: number; currency: string }
  | { kind: "no_data" }
  | { kind: "failed" };

function resolveRowIncome(
  row: HoldingRow,
  quotes: Record<string, QuoteResult>,
): RowIncomeStatus {
  const quote = quotes[row.ticker];
  if (!quote || !quote.ok) return { kind: "failed" };
  const { dividend, currency } = quote.data;
  if (!dividend || dividend <= 0 || !currency) return { kind: "no_data" };
  const annual = Number(row.quantity) * dividend;
  if (!Number.isFinite(annual) || annual <= 0) return { kind: "no_data" };
  return { kind: "ok", amount: annual, currency };
}

interface IncomeCellProps {
  status: RowIncomeStatus;
  className?: string;
}

function IncomeCell({ status, className }: IncomeCellProps) {
  if (status.kind === "ok") {
    return (
      <span
        className={`font-mono tabular-nums text-foreground ${className ?? ""}`}
      >
        {formatIncome(status.amount, status.currency)}
      </span>
    );
  }
  if (status.kind === "no_data") {
    return (
      <span
        title="No dividend data — LSE auto-lookup ships post-launch."
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

interface HoldingsTableProps {
  rows: HoldingRow[];
  quotes: Record<string, QuoteResult>;
}

export function HoldingsTable({ rows, quotes }: HoldingsTableProps) {
  const router = useRouter();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

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
            "That holding was already gone — refreshing the table.",
          );
          router.refresh();
          return;
        }
        if (res.status === 401) {
          window.alert(
            "Your session expired — refresh the page and sign in again.",
          );
          return;
        }
        window.alert("Couldn't delete that holding. Try again.");
      } catch {
        markPending(row.id, false);
        window.alert("Network error — check your connection and try again.");
      }
    });
  };

  return (
    <>
      {/* Desktop / tablet — full table */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40">
              <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-4 py-3">
                  Ticker
                </th>
                <th scope="col" className="px-4 py-3">
                  Wrapper
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Quantity
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Avg cost
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Income
                </th>
                <th scope="col" className="px-4 py-3">
                  Broker
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pending = pendingIds.has(row.id);
                const incomeStatus = resolveRowIncome(row, quotes);
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-border last:border-b-0 transition-opacity ${
                      pending ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-sm font-medium text-foreground">
                      {row.ticker}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                        {WRAPPER_LABEL[row.wrapper] ?? row.wrapper}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {formatQuantity(Number(row.quantity))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {formatCost(Number(row.avg_cost), row.cost_currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <IncomeCell status={incomeStatus} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.broker_label ?? (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
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
        {rows.map((row) => {
          const pending = pendingIds.has(row.id);
          const incomeStatus = resolveRowIncome(row, quotes);
          return (
            <li
              key={row.id}
              className={`rounded-xl border border-border bg-card p-4 transition-opacity ${
                pending ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-base font-semibold text-foreground">
                    {row.ticker}
                  </p>
                  <span className="mt-1 inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                    {WRAPPER_LABEL[row.wrapper] ?? row.wrapper}
                  </span>
                </div>
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
                    Income
                  </dt>
                  <dd className="mt-0.5 text-sm">
                    <IncomeCell status={incomeStatus} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Broker
                  </dt>
                  <dd className="mt-0.5 text-foreground">
                    {row.broker_label ?? (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}
