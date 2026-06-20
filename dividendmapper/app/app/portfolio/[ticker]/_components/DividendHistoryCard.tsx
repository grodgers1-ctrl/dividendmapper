// Day 8 holding detail. Per-payment dividend history list, newest first.
// "Actual" = synced from broker via user_dividends; "Est" = FMP forward
// calendar entry (a future expected payment). Optional amount bar gives a
// quick visual of relative size — handy for spotting cuts or specials.

export interface DividendPayment {
  date: string; // ISO yyyy-mm-dd
  amount: number;
  currency: string;
  kind: "actual" | "estimate";
}

export interface DividendHistoryCardProps {
  payments: ReadonlyArray<DividendPayment>;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const FORMATTERS = new Map<string, Intl.NumberFormat>();
function money(amount: number, currency: string): string {
  let f = FORMATTERS.get(currency);
  if (!f) {
    const locale = currency === "USD" ? "en-US" : "en-GB";
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    FORMATTERS.set(currency, f);
  }
  return f.format(amount);
}

export function DividendHistoryCard({ payments }: DividendHistoryCardProps) {
  const maxAmount = payments.reduce(
    (acc, p) => (p.amount > acc ? p.amount : acc),
    0,
  );

  return (
    <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Dividend history
      </p>
      {payments.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          No dividend history synced yet for this holding.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
          {payments.map((p, idx) => {
            const fraction = maxAmount > 0 ? p.amount / maxAmount : 0;
            return (
              <li
                key={`${p.date}-${idx}`}
                className="grid grid-cols-[6.5rem_1fr_5.5rem_3.5rem] items-center gap-3 py-2 text-sm"
              >
                <span className="text-[var(--text-muted)]">
                  {formatDate(p.date)}
                </span>
                <div className="relative h-1 rounded-full bg-[var(--surface-2)]">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 rounded-full bg-[var(--brand)]"
                    style={{ width: `${Math.max(2, fraction * 100)}%` }}
                  />
                </div>
                <span className="text-right font-mono tabular-nums text-[var(--text)]">
                  {money(p.amount, p.currency)}
                </span>
                <span
                  className={`inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    p.kind === "actual"
                      ? "border-positive/30 bg-positive/10 text-positive"
                      : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-muted)]"
                  }`}
                >
                  {p.kind === "actual" ? "Actual" : "Est"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
