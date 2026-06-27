// Inline % of portfolio bar rendered absolutely under the Value cell figure.

export function percentOfPortfolio(value: number, total: number): number {
  if (total <= 0 || !Number.isFinite(total) || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value / total));
}

interface Props {
  value: number;
  totalValue: number;
}

export function PortfolioBar({ value, totalValue }: Props) {
  if (totalValue <= 0) return null;
  const pct = percentOfPortfolio(value, totalValue);
  const widthPct = Math.round(pct * 1000) / 10;
  const display = `${Math.round(pct * 100)}% of visible portfolio value`;
  return (
    <span
      aria-hidden="true"
      title={display}
      className="pointer-events-none absolute inset-x-0 bottom-1 mx-3 h-[2px] rounded-full bg-gradient-to-r from-brand-500/30 to-brand-500/0"
      style={{ width: `${widthPct}%` }}
    />
  );
}
