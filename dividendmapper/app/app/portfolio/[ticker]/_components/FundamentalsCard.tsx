// Day 8 holding detail. 2-col K/V list of fundamentals — P/E, forward P/E,
// payout ratio, net debt / EBITDA, FCF coverage, current yield, 5y dividend
// CAGR, sector. Page derives these from equity_score_history (P/E from
// price/eps_avg, debt/EBITDA, etc.) and equity_scores. Missing values
// render as a — placeholder rather than being hidden, so the row layout
// stays stable and the user can tell what's not yet collected.

import { formatSector } from "@/lib/scoring/sector-display";

export interface FundamentalsCardProps {
  pe: number | null;
  forwardPe: number | null;
  payoutRatio: number | null;
  netDebtToEbitda: number | null;
  fcfCoverage: number | null;
  currentYield: number | null;
  dividendCagr5y: number | null;
  sector: string | null;
}

const PLACEHOLDER = "—";

function multiple(value: number | null, fraction = 1): string {
  if (value === null || !Number.isFinite(value)) return PLACEHOLDER;
  return `${value.toFixed(fraction)}x`;
}

function ratio(value: number | null, fraction = 2): string {
  if (value === null || !Number.isFinite(value)) return PLACEHOLDER;
  return value.toFixed(fraction);
}

function pct(value: number | null, fraction = 1): string {
  if (value === null || !Number.isFinite(value)) return PLACEHOLDER;
  return `${(value * 100).toFixed(fraction)}%`;
}

export function FundamentalsCard({
  pe,
  forwardPe,
  payoutRatio,
  netDebtToEbitda,
  fcfCoverage,
  currentYield,
  dividendCagr5y,
  sector,
}: FundamentalsCardProps) {
  return (
    <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Fundamentals
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Row label="P/E" value={multiple(pe)} />
        <Row label="Forward P/E" value={multiple(forwardPe)} />
        <Row label="Payout ratio" value={pct(payoutRatio)} />
        <Row label="Net debt / EBITDA" value={ratio(netDebtToEbitda)} />
        <Row label="FCF coverage" value={multiple(fcfCoverage)} />
        <Row label="Yield" value={pct(currentYield)} />
        <Row label="5y dividend CAGR" value={pct(dividendCagr5y)} />
        <Row label="Sector" value={sector ? formatSector(sector) : PLACEHOLDER} />
      </dl>
      <p className="mt-4 text-xs text-[var(--text-muted)]">
        From FMP, refreshed nightly.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="font-mono tabular-nums text-[var(--text)]">{value}</dd>
    </div>
  );
}
