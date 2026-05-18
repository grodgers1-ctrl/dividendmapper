import type {
  IncomeRow,
  IncomeCurrencyTotal,
  PortfolioIncome,
  WrapperKey,
} from "@/lib/portfolio/income";

// Annual income breakdown for the portfolio view. Source-currency only — no
// FX conversion at launch. If the portfolio spans >1 currency the card shows
// per-currency totals stacked vertically; otherwise a single total.
//
// Built fresh rather than sharing the Phase 1 retirement-calc chart: the two
// will diverge as portfolio gains hover tooltips, broker-sync labels, and
// (eventually) FX conversion. Decoupling now avoids retirement-calc
// regression risk on this Day 5 ship.

const WRAPPER_LABEL: Record<WrapperKey, string> = {
  isa: "ISA",
  sipp: "SIPP",
  gia: "GIA",
  "401k": "401(k)",
  ira: "IRA",
  roth_ira: "Roth IRA",
  brokerage: "Brokerage",
};

const WRAPPER_SWATCH: Record<WrapperKey, string> = {
  isa: "var(--color-brand-500)",
  sipp: "var(--color-chart-2)",
  gia: "var(--color-chart-4)",
  "401k": "var(--color-chart-3)",
  ira: "var(--color-chart-1)",
  roth_ira: "var(--color-chart-5)",
  brokerage: "var(--color-income-500)",
};

// Tax notes mirror the retirement calculator's locale labels — same wording
// keeps cognitive load down for users hopping between tools. The GIA row
// switches to "warn" tone when annual income breaches the UK dividend
// allowance (£500 in 2026/27).
const UK_DIVIDEND_ALLOWANCE = 500;
const TAX_NOTE: Record<WrapperKey, string> = {
  isa: "Tax-free — no income tax on dividends or growth.",
  sipp: "Drawdown counts as income. 25% tax-free lump sum available.",
  gia: `First £${UK_DIVIDEND_ALLOWANCE}/yr covered by the dividend allowance.`,
  "401k": "Tax-deferred. Withdrawals taxed as ordinary income.",
  ira: "Traditional IRA — taxable on withdrawal.",
  roth_ira: "Roth — tax-free withdrawals after age 59½.",
  brokerage: "Qualified dividends taxed at 0% / 15% / 20%.",
};

const POSITIVE_TONE: ReadonlySet<WrapperKey> = new Set(["isa", "roth_ira"]);

function currencyPrefix(currency: string): string {
  switch (currency) {
    case "GBP":
      return "£";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    default:
      return "";
  }
}

function formatAmount(amount: number, currency: string): string {
  const prefix = currencyPrefix(currency);
  const formatter = new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return prefix
    ? `${prefix}${formatter.format(Math.round(amount))}`
    : `${formatter.format(Math.round(amount))} ${currency}`;
}

interface RowProps {
  row: IncomeRow;
  isOverAllowance: boolean;
}

function RowLine({ row, isOverAllowance }: RowProps) {
  const swatch = WRAPPER_SWATCH[row.wrapper];
  const note =
    isOverAllowance && row.wrapper === "gia"
      ? `${formatAmount(row.annualIncome - UK_DIVIDEND_ALLOWANCE, row.currency)}/yr above the ${formatAmount(UK_DIVIDEND_ALLOWANCE, row.currency)} dividend allowance — taxable.`
      : TAX_NOTE[row.wrapper];
  const isWarn = isOverAllowance && row.wrapper === "gia";
  const isPositive = POSITIVE_TONE.has(row.wrapper) && !isWarn;
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline gap-2.5">
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 shrink-0 translate-y-px rounded-full"
          style={{ backgroundColor: swatch }}
        />
        <div>
          <p className="text-sm font-medium text-foreground">
            {WRAPPER_LABEL[row.wrapper]} · {row.currency}
            {row.holdingsCount > 1 ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {row.holdingsCount} holdings
              </span>
            ) : null}
          </p>
          <p
            className={
              isWarn
                ? "mt-0.5 text-xs text-negative"
                : isPositive
                  ? "mt-0.5 text-xs text-positive"
                  : "mt-0.5 text-xs text-muted-foreground"
            }
          >
            {note}
          </p>
        </div>
      </div>
      <span className="font-mono text-sm font-medium tabular-nums text-foreground">
        {formatAmount(row.annualIncome, row.currency)}
      </span>
    </li>
  );
}

interface CurrencyBlockProps {
  total: IncomeCurrencyTotal;
  rows: IncomeRow[];
  showHeader: boolean;
  giaOverAllowance: boolean;
}

function CurrencyBlock({
  total,
  rows,
  showHeader,
  giaOverAllowance,
}: CurrencyBlockProps) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      {showHeader && (
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {total.currency} total
        </p>
      )}
      <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-foreground md:text-4xl">
        {formatAmount(total.total, total.currency)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        annual dividend income
      </p>

      <StackedBar rows={rows} total={total.total} />

      <ul className="mt-4 divide-y divide-border">
        {rows.map((r) => (
          <RowLine
            key={r.key}
            row={r}
            isOverAllowance={
              giaOverAllowance &&
              r.wrapper === "gia" &&
              r.currency === total.currency
            }
          />
        ))}
      </ul>
    </div>
  );
}

function StackedBar({ rows, total }: { rows: IncomeRow[]; total: number }) {
  if (total <= 0) return null;
  return (
    <div className="mt-4">
      <div
        role="img"
        aria-label="Stacked annual income bar"
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
      >
        {rows.map((r) => {
          const pct = (r.annualIncome / total) * 100;
          if (pct <= 0) return null;
          return (
            <span
              key={r.key}
              title={`${WRAPPER_LABEL[r.wrapper]}: ${formatAmount(r.annualIncome, r.currency)}/yr`}
              className="h-full"
              style={{
                width: `${pct}%`,
                backgroundColor: WRAPPER_SWATCH[r.wrapper],
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function PortfolioIncomeChart({ income }: { income: PortfolioIncome }) {
  if (income.rows.length === 0 && income.missingDividendCount === 0) {
    return null;
  }

  const multiCurrency = income.totalsByCurrency.length > 1;

  // Group rows by currency, preserving the order set in `totalsByCurrency`
  // (descending by total).
  const rowsByCurrency = new Map<string, IncomeRow[]>();
  for (const row of income.rows) {
    const existing = rowsByCurrency.get(row.currency);
    if (existing) existing.push(row);
    else rowsByCurrency.set(row.currency, [row]);
  }

  // UK dividend allowance breach detection — sum across all GIA-GBP rows.
  // Currently only a single GIA-GBP row can exist (one bucket per pair) but
  // computing this defensively means future row splits won't break the check.
  const giaGbpTotal = income.rows
    .filter((r) => r.wrapper === "gia" && r.currency === "GBP")
    .reduce((s, r) => s + r.annualIncome, 0);
  const giaOverAllowance = giaGbpTotal > UK_DIVIDEND_ALLOWANCE;

  return (
    <section
      aria-label="Annual portfolio income breakdown"
      className="rounded-xl border border-border bg-card p-4 md:p-6"
    >
      <header className="mb-4">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Annual income
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Projected over the next 12 months based on each holding&apos;s most
          recent annual dividend per share.
        </p>
      </header>

      {income.rows.length > 0 ? (
        <div className="space-y-3">
          {income.totalsByCurrency.map((total) => (
            <CurrencyBlock
              key={total.currency}
              total={total}
              rows={rowsByCurrency.get(total.currency) ?? []}
              showHeader={multiCurrency}
              giaOverAllowance={giaOverAllowance}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">
            No dividend data available yet for any of your holdings. LSE
            auto-lookup ships post-launch — for now, US holdings populate
            automatically.
          </p>
        </div>
      )}

      {income.missingDividendCount > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {income.missingDividendCount} holding
          {income.missingDividendCount === 1 ? "" : "s"} not counted — dividend
          data unavailable. LSE auto-lookup ships post-launch.
        </p>
      )}

      {multiCurrency && (
        <p className="mt-2 text-xs text-muted-foreground">
          FX conversion ships post-launch — totals stay in each holding&apos;s
          source currency for now.
        </p>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Tax notes are informational, not financial or tax advice.
      </p>
    </section>
  );
}
