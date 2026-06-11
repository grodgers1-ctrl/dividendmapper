"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RotateCcw, Trash2 } from "lucide-react";

// Collapsed "Archived holdings" disclosure. Lists rows the provenance reconcile
// superseded (a manual holding replaced by a synced one) or that were closed —
// retained via archived_at, never deleted, but hidden from the main table. Each
// row can be Restored (PATCH clears archived_at) or permanently Deleted.

export type ArchivedRow = {
  id: string;
  ticker: string;
  wrapper: string;
  source?: "manual" | "trading212" | "csv";
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

export function ArchivedHoldings({ rows }: { rows: ArchivedRow[] }) {
  const router = useRouter();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  if (rows.length === 0) return null;

  const mark = (id: string, on: boolean) =>
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const restore = (row: ArchivedRow) => {
    mark(row.id, true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/portfolio/holdings/${row.id}`, { method: "PATCH" });
        if (res.status === 204) {
          router.refresh();
          return;
        }
        mark(row.id, false);
        window.alert("Couldn't restore that holding. Try again.");
      } catch {
        mark(row.id, false);
        window.alert("Network error. Check your connection and try again.");
      }
    });
  };

  const remove = (row: ArchivedRow) => {
    const ok = window.confirm(
      `Permanently delete ${row.ticker} (${WRAPPER_LABEL[row.wrapper] ?? row.wrapper})? This can't be undone.`,
    );
    if (!ok) return;
    mark(row.id, true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/portfolio/holdings/${row.id}`, { method: "DELETE" });
        if (res.status === 204 || res.status === 404) {
          router.refresh();
          return;
        }
        mark(row.id, false);
        window.alert("Couldn't delete that holding. Try again.");
      } catch {
        mark(row.id, false);
        window.alert("Network error. Check your connection and try again.");
      }
    });
  };

  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
        Archived holdings ({rows.length})
      </summary>
      <div className="border-t border-border px-4 py-3">
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          These were superseded by a synced position or closed. They&apos;re kept,
          not deleted. Restore one to show it in your table again, or delete it for
          good.
        </p>
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const pending = pendingIds.has(row.id);
            return (
              <li
                key={row.id}
                className={`flex items-center justify-between gap-3 py-2 ${
                  pending ? "opacity-50" : ""
                }`}
              >
                <div className="min-w-0">
                  <span className="font-mono text-sm font-medium text-foreground">
                    {row.ticker}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {WRAPPER_LABEL[row.wrapper] ?? row.wrapper}
                    {row.source === "trading212" ? " · was Trading 212" : ""}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => restore(row)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    disabled={pending}
                    aria-label={`Delete ${row.ticker}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
