"use client";

import type { Wrapper } from "@/lib/portfolio/income-calendar";

const SHELTERED = new Set<Wrapper>(["isa", "sipp", "401k", "ira", "roth_ira"]);

const WRAPPER_LABEL: Record<Wrapper, string> = {
  isa: "ISA",
  sipp: "SIPP",
  gia: "GIA",
  "401k": "401(k)",
  ira: "IRA",
  roth_ira: "Roth IRA",
  brokerage: "Brokerage",
};

export type ProjectedConfidence =
  | "confirmed"
  | "projected-cadence"
  | "projected-growth"
  | "growth-clipped";

export interface DrilldownPayment {
  ticker: string;
  exDate: string;
  payDate: string | null;
  /** Per-share figure in its native currency (e.g. 1.98 for 1.98p). */
  nativeAmount: number;
  /** e.g. "GBp", "USD". */
  nativeCurrency: string;
  /** Holding quantity; rendered as "× N" between per-share and total. */
  quantity?: number;
  /** Total payment in the user's primary currency. */
  primaryAmount: number;
  wrapper: Wrapper;
  confidence: ProjectedConfidence;
}

export interface DrilldownPanelProps {
  primaryCurrency: "GBP" | "USD";
  payments: ReadonlyArray<DrilldownPayment>;
  emptyReason?: "no-announcement" | "non-paying" | "no-holdings";
}

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return SHORT_DATE.format(new Date(`${iso}T00:00:00Z`));
}

function formatPrimary(n: number, currency: "GBP" | "USD"): string {
  const fmt = new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  return fmt.format(n);
}

function formatNativePerShare(amount: number, currency: string): string {
  // GBp (pence) reads better with 2-3 dp (1.98p, 0.265 USD). USD uses 2 dp
  // for forecast amounts; everything else gets 2 dp as a sensible default.
  const dp = currency === "GBp" || currency === "GBX" ? 2 : currency === "USD" ? 3 : 2;
  return `${amount.toFixed(dp)} ${currency}`;
}

function emptyMessage(reason: DrilldownPanelProps["emptyReason"]): string {
  switch (reason) {
    case "no-announcement":
      return "No announcement yet — we'll fill this in when the next ex-dividend is published.";
    case "non-paying":
      return "This stock doesn't pay a dividend.";
    case "no-holdings":
    default:
      return "No upcoming payments in this period.";
  }
}

export function DrilldownPanel({ primaryCurrency, payments, emptyReason }: DrilldownPanelProps) {
  if (payments.length === 0) {
    return (
      <p className="card-surface p-4 text-sm text-[var(--text-muted)]">
        {emptyMessage(emptyReason)}
      </p>
    );
  }

  return (
    <div className="card-surface p-4">
      <ul className="divide-y divide-[var(--border-subtle)]">
        {payments.map((p, i) => {
          const wrapperClass = SHELTERED.has(p.wrapper) ? "sheltered" : "taxable";
          return (
            <li
              key={`${p.ticker}-${p.exDate}-${i}`}
              className="grid grid-cols-[80px_1fr_auto_auto_auto] items-baseline gap-3 py-2 text-xs"
            >
              <span className="font-mono text-[var(--text)]">{p.ticker}</span>
              <span className="text-[var(--text-muted)]">
                ex {formatDate(p.exDate)} · pay {formatDate(p.payDate)}
              </span>
              <span className="text-[var(--text-muted)] tabular-nums">
                {formatNativePerShare(p.nativeAmount, p.nativeCurrency)}
                {p.quantity !== undefined && (
                  <span className="text-[var(--text-muted)]"> × {p.quantity}</span>
                )}
              </span>
              <span className="font-mono tabular-nums text-[var(--text)]">
                {formatPrimary(p.primaryAmount, primaryCurrency)}
              </span>
              <span
                data-wrapper-class={wrapperClass}
                className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] ${
                  wrapperClass === "sheltered"
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--border-subtle)] text-[var(--text-muted)]"
                }`}
              >
                {WRAPPER_LABEL[p.wrapper]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
