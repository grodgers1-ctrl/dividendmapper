"use client";

// Per-payment list for the selected month. Reads from
// IncomeCalendarResult.paymentsByMonth so the table includes ALL holdings'
// activity in the month, not just the global next-3 ex-divs.

import type {
  IncomeCalendarPayment,
  Wrapper,
} from "@/lib/portfolio/income-calendar";

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

const FREQUENCY_LABEL: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi: "Semi-annual",
  annual: "Annual",
  irregular: "Irregular",
  unknown: "",
};

const STATUS_LABEL: Record<IncomeCalendarPayment["status"], string> = {
  received: "Received",
  declared: "Declared",
  estimated: "Estimated",
};

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
  const dp = currency === "GBp" || currency === "GBX" ? 2 : currency === "USD" ? 3 : 2;
  return `${amount.toFixed(dp)} ${currency}`;
}

export interface DrilldownPanelProps {
  primaryCurrency: "GBP" | "USD";
  payments: ReadonlyArray<IncomeCalendarPayment>;
  emptyReason?: "no-announcement" | "non-paying" | "no-holdings";
}

function emptyMessage(reason: DrilldownPanelProps["emptyReason"]): string {
  switch (reason) {
    case "no-announcement":
      return "No payments in this month yet. We'll fill it in when the next ex-dividend is announced.";
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
    <div className="card-surface overflow-hidden">
      <div
        role="row"
        className="hidden grid-cols-[2fr_1.4fr_1.6fr_0.8fr_0.9fr_0.7fr] gap-3 border-b border-[var(--border-subtle)] px-4 py-2 text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)] md:grid"
      >
        <span>Ticker</span>
        <span>Ex · Pay</span>
        <span>Per share × Qty</span>
        <span>Total</span>
        <span>Frequency · Status</span>
        <span>Wrapper</span>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {payments.map((p, i) => {
          const wrapperClass = SHELTERED.has(p.wrapper) ? "sheltered" : "taxable";
          const showMath = typeof p.quantity === "number" && p.quantity > 0;
          const freqLabel = p.frequency ? FREQUENCY_LABEL[p.frequency] ?? "" : "";
          return (
            <li
              key={`${p.ticker}-${p.exDate}-${i}`}
              // Mobile: 2-col grid that puts the headline £ next to the ticker
              // and groups the per-share math + chips below. The `order-*` /
              // `md:order-none` pairs reorder the same DOM into this 3-row
              // shape on mobile while leaving the desktop 6-col layout intact.
              className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 px-4 py-3 text-xs md:grid-cols-[2fr_1.4fr_1.6fr_0.8fr_0.9fr_0.7fr] md:items-baseline md:gap-3"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-mono text-sm font-medium text-[var(--text)]">{p.ticker || "—"}</span>
                {p.name && (
                  <span className="truncate text-[10px] text-[var(--text-muted)]">{p.name}</span>
                )}
              </span>
              <span className="hidden text-[var(--text-muted)] md:block">
                {formatDate(p.exDate)} · {formatDate(p.payDate)}
              </span>
              <span className="order-3 tabular-nums text-[var(--text-muted)] md:order-none">
                {showMath ? (
                  <>
                    {formatNativePerShare(p.perShareNative, p.nativeCurrency)}
                    <span> × {p.quantity}</span>
                  </>
                ) : (
                  formatNativePerShare(p.perShareNative, p.nativeCurrency)
                )}
              </span>
              <span className="order-2 justify-self-end whitespace-nowrap font-mono font-semibold tabular-nums text-[var(--text)] md:order-none md:justify-self-auto md:font-normal">
                {formatPrimary(p.primaryAmount, primaryCurrency)}
              </span>
              <span className="order-4 flex flex-wrap items-center justify-end gap-1 md:order-none md:justify-start">
                {freqLabel && (
                  <span
                    data-testid="drilldown-frequency"
                    className="rounded-sm border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.06em] text-[var(--text-muted)]"
                  >
                    {freqLabel}
                  </span>
                )}
                <span
                  data-status={p.status}
                  data-testid="drilldown-status"
                  className={`rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-[0.06em] ${
                    p.status === "received"
                      ? "bg-[var(--brand)] text-white"
                      : p.status === "declared"
                        ? "border border-[var(--brand)] text-[var(--brand)]"
                        : "border border-dashed border-[var(--border-subtle)] text-[var(--text-muted)]"
                  }`}
                >
                  {STATUS_LABEL[p.status]}
                </span>
              </span>
              <span
                data-wrapper-class={wrapperClass}
                className={`order-5 justify-self-start rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-[0.06em] md:order-none md:justify-self-auto ${
                  wrapperClass === "sheltered"
                    ? "bg-[var(--surface-elevated)] text-[var(--text)]"
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
