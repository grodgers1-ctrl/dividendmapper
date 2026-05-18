"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

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

export function HoldingsTable({ rows }: { rows: HoldingRow[] }) {
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
          // pendingIds clears naturally — the row unmounts on refresh.
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
    <div className="overflow-hidden rounded-xl border border-border bg-card">
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
  );
}
