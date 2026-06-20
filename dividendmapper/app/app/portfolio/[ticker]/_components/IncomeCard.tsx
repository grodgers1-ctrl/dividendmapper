// Day 7 holding detail. IncomeCard renders the dividend story for a single
// holding: forward £/$ annual run-rate (the FMP-sourced estimate the
// Portfolio Ledger also prefers — see [[project_income_yr_estimate_not_actuals]]),
// real TTM received from broker sync (a secondary stat — confirms the
// estimate is landing close), yield on cost (rare-but-useful long-hold
// signal), frequency, next ex-div, and a wrapper-aware tax note.
//
// No FX conversion at this layer — all amounts render in their source
// currency, matching the Portfolio Income Chart's behaviour.

const WRAPPER_TAX_NOTE: Record<string, string> = {
  isa: "ISA: dividends tax-free, no UK income tax.",
  sipp: "SIPP: dividends roll up tax-free; income tax on drawdown.",
  gia: "GIA: first £500/yr covered by the UK dividend allowance.",
  "401k": "401(k): tax-deferred; ordinary income on withdrawal.",
  ira: "Traditional IRA: taxable on withdrawal.",
  roth_ira: "Roth IRA: tax-free withdrawals after age 59½.",
  brokerage: "Brokerage: qualified dividends taxed 0% / 15% / 20%.",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatExDivDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

const FORMATTERS = new Map<string, Intl.NumberFormat>();
function money(amount: number, currency: string, fraction = 0): string {
  const key = `${currency}::${fraction}`;
  let f = FORMATTERS.get(key);
  if (!f) {
    const locale = currency === "USD" ? "en-US" : "en-GB";
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: fraction,
    });
    FORMATTERS.set(key, f);
  }
  return f.format(amount);
}

export interface IncomeCardProps {
  /** FMP-sourced forward estimate (quantity × dps). null when unscored. */
  forwardAnnual: number | null;
  forwardCurrency: string | null;
  /** TTM broker-synced income for this (ticker × wrapper). null when unsynced. */
  receivedTtm: number | null;
  receivedCurrency: string | null;
  /** Pre-computed forwardAnnual ÷ (quantity × avgCost) × 100. null when noisy. */
  yieldOnCostPct: number | null;
  avgCost: number;
  quantity: number;
  costCurrency: string;
  wrapper: string;
  nextExDivDate: string | null;
  nextExDivAmount: number | null;
  frequency: "monthly" | "quarterly" | "semi-annual" | "annual" | null;
}

export function IncomeCard({
  forwardAnnual,
  forwardCurrency,
  receivedTtm,
  receivedCurrency,
  yieldOnCostPct,
  wrapper,
  nextExDivDate,
  nextExDivAmount,
  frequency,
}: IncomeCardProps) {
  const taxNote = WRAPPER_TAX_NOTE[wrapper] ?? null;

  return (
    <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Income
      </p>
      {forwardAnnual !== null && forwardCurrency !== null ? (
        <>
          <p className="mt-2 font-display text-4xl font-semibold tracking-tight text-[var(--text)] tabular-nums">
            {money(forwardAnnual, forwardCurrency)}
            <span className="ml-2 text-base font-medium text-[var(--text-muted)]">
              /yr
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Forward estimate, per year
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          No dividend data available for this ticker.
        </p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        {receivedTtm !== null && receivedCurrency !== null && (
          <Stat
            label="Received (12m)"
            value={money(receivedTtm, receivedCurrency)}
          />
        )}
        {yieldOnCostPct !== null && (
          <Stat label="Yield on cost" value={`${yieldOnCostPct.toFixed(1)}%`} />
        )}
        {frequency && (
          <Stat label="Frequency" value={titleCase(frequency)} />
        )}
        {nextExDivDate && (
          <Stat
            label="Next ex-div"
            value={
              nextExDivAmount !== null && forwardCurrency
                ? `${formatExDivDate(nextExDivDate)} · ${money(nextExDivAmount, forwardCurrency, 2)}`
                : formatExDivDate(nextExDivDate)
            }
          />
        )}
      </dl>

      {taxNote && (
        <p className="mt-4 text-xs text-[var(--text-muted)]">{taxNote}</p>
      )}
    </div>
  );
}

function titleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 font-mono tabular-nums text-[var(--text)]">{value}</dd>
    </div>
  );
}
