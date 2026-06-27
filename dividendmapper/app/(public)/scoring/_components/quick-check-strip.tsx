import { InfoPopover } from "@/components/ui/info-popover";

export interface QuickCheckSignals {
  forwardYield: number | null;
  payoutRatio: number | null;
  fcfCoverage: number | null;
  dividendCagr5y: number | null;
}

interface CardConfig {
  label: string;
  value: string;
  hint: string;
}

function formatPercent(value: number | null, digits = 2): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatMultiple(value: number | null, digits = 2): string {
  if (value == null) return "—";
  return `${value.toFixed(digits)}x`;
}

export function QuickCheckStrip({ signals }: { signals: QuickCheckSignals }) {
  const cards: CardConfig[] = [
    {
      label: "Forward yield",
      value: formatPercent(signals.forwardYield),
      hint: "Next 12 months of dividends divided by today's price. The starting yield for the income you're buying.",
    },
    {
      label: "Payout ratio",
      value: formatPercent(signals.payoutRatio, 0),
      hint: "Share of earnings paid out as dividends. Above 80% leaves little room for growth or cushion.",
    },
    {
      label: "FCF coverage",
      value: formatMultiple(signals.fcfCoverage),
      hint: "Free cash flow divided by dividends paid. Above 1.5x is comfortable; below 1x means the dividend is funded by debt or balance sheet.",
    },
    {
      label: "5-year growth",
      value: formatPercent(signals.dividendCagr5y, 1),
      hint: "Compound annual growth rate of the dividend over the past five years. A proxy for the management's track record on raises.",
    },
  ];
  return (
    <section aria-label="Quick check" className="mt-8">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Quick check
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              <InfoPopover label={card.label}>
                <p className="text-sm leading-relaxed text-muted-foreground">{card.hint}</p>
              </InfoPopover>
            </div>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
