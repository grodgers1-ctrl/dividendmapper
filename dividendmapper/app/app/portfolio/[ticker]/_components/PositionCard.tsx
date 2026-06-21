// Day 7 holding detail. PositionCard renders the punchy "what is this worth
// right now" surface: large mono £/$ value, signed unrealised P/L,
// quantity × avg cost × wrapper. The page does the value calculation
// (quantity × current price); the card just renders.
//
// Wrappers render their canonical short labels (ISA / SIPP / GIA / 401(k) /
// IRA / Roth IRA / Brokerage), mirroring how the Portfolio Ledger formats
// them. No FX conversion at this level — cost and value are shown in their
// own currencies, same as the Ledger.

const WRAPPER_LABEL: Record<string, string> = {
  isa: "ISA",
  sipp: "SIPP",
  gia: "GIA",
  "401k": "401(k)",
  ira: "IRA",
  roth_ira: "Roth IRA",
  brokerage: "Brokerage",
};

const FORMATTERS = new Map<string, Intl.NumberFormat>();
function moneyFormatter(currency: string, maxFractionDigits = 0): Intl.NumberFormat {
  const key = `${currency}::${maxFractionDigits}`;
  let f = FORMATTERS.get(key);
  if (!f) {
    // en-US for USD (matches the existing portfolio income chart's
    // convention), en-GB for everything else. Avoids the en-GB "US$1,000"
    // dual-symbol output for non-local currencies.
    const locale = currency === "USD" ? "en-US" : "en-GB";
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: maxFractionDigits,
    });
    FORMATTERS.set(key, f);
  }
  return f;
}

function formatMoney(amount: number, currency: string, fraction = 0): string {
  return moneyFormatter(currency, fraction).format(amount);
}

export interface PositionCardProps {
  quantity: number;
  avgCost: number;
  costCurrency: string;
  valueAmount: number | null;
  valueCurrency: string | null;
  wrapper: string;
}

export function PositionCard({
  quantity,
  avgCost,
  costCurrency,
  valueAmount,
  valueCurrency,
  wrapper,
}: PositionCardProps) {
  const wrapperLabel = WRAPPER_LABEL[wrapper] ?? wrapper;
  const totalCost = quantity * avgCost;

  return (
    <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Position
      </p>
      {valueAmount !== null && valueCurrency !== null ? (
        <>
          <p className="mt-2 font-display text-4xl font-semibold tracking-tight text-[var(--text)] tabular-nums">
            {formatMoney(valueAmount, valueCurrency)}
          </p>
          <PositionPnl
            costAmount={totalCost}
            costCurrency={costCurrency}
            valueAmount={valueAmount}
            valueCurrency={valueCurrency}
          />
        </>
      ) : (
        <p className="mt-2 text-sm text-[var(--text-muted)]">No recent price available.</p>
      )}
      <dl className="mt-6 grid grid-cols-3 gap-4 text-sm">
        <Stat label="Quantity" value={String(quantity)} />
        <Stat
          label="Avg cost"
          value={formatMoney(avgCost, costCurrency, 2)}
        />
        <Stat label="Wrapper" value={wrapperLabel} />
      </dl>
      <p className="mt-4 text-xs text-[var(--text-muted)]">
        Total cost: {formatMoney(totalCost, costCurrency)}
      </p>
    </div>
  );
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

// P/L only when the cost basis and current value share a currency. Mixing
// USD-cost with GBP-value would need an FX conversion we don't do at this
// layer — render a neutral hint instead of a bogus number.
function PositionPnl({
  costAmount,
  costCurrency,
  valueAmount,
  valueCurrency,
}: {
  costAmount: number;
  costCurrency: string;
  valueAmount: number;
  valueCurrency: string;
}) {
  if (costCurrency !== valueCurrency) {
    return (
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        P/L unavailable. Cost and price are in different currencies.
      </p>
    );
  }
  const delta = valueAmount - costAmount;
  const pct = costAmount > 0 ? (delta / costAmount) * 100 : 0;
  const positive = delta >= 0;
  const arrow = positive ? "↑" : "↓";
  const sign = positive ? "+" : "−";
  const formatted = formatMoney(Math.abs(delta), valueCurrency);
  const tone = positive ? "text-positive" : "text-negative";
  return (
    <p className={`mt-1 text-sm font-medium ${tone}`}>
      {sign}
      {formatted} ({pct.toFixed(1)}%) <span aria-hidden>{arrow}</span>
    </p>
  );
}
