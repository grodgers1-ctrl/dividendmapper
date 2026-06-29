"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  projectFuture,
  type ProjectionTickerInput,
} from "@/lib/portfolio/future-projection";

const HORIZONS = [5, 10, 15, 20];

export interface FutureProjectionCardProps {
  tickers: ProjectionTickerInput[];
  ratesToPrimary: Record<string, number>;
  primaryCurrency: "GBP" | "USD";
}

export function FutureProjectionCard({
  tickers,
  ratesToPrimary,
  primaryCurrency,
}: FutureProjectionCardProps) {
  const [horizon, setHorizon] = useState(10);
  const [drip, setDrip] = useState(false);
  const [cagrInput, setCagrInput] = useState<number | null>(null);
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [showAssumptions, setShowAssumptions] = useState(false);

  // 250ms input-side debounce on the slider; chips + DRIP toggle recompute
  // immediately. See [[feedback_debounce_heavy_calc]]. Initial state lands
  // without firing the timer because cagrInput is null and the effect bails
  // on identity.
  const [debouncedCagr, setDebouncedCagr] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCagr(cagrInput), 250);
    return () => clearTimeout(t);
  }, [cagrInput]);

  const projection = useMemo(
    () =>
      projectFuture({
        tickers,
        horizonYrs: horizon,
        drip,
        cagrOverride: debouncedCagr,
        ratesToPrimary,
        primaryCurrency,
      }),
    [tickers, horizon, drip, debouncedCagr, ratesToPrimary, primaryCurrency],
  );

  if (tickers.length === 0) {
    return (
      <section className="card-surface p-6">
        <p className="text-sm text-[var(--text-muted)]">
          Add holdings with dividend history to project forward income.
        </p>
      </section>
    );
  }

  const last = projection.years[projection.years.length - 1];
  const fmt = (n: number) =>
    new Intl.NumberFormat(primaryCurrency === "GBP" ? "en-GB" : "en-US", {
      style: "currency",
      currency: primaryCurrency,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <section className="card-surface p-6">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Project ahead · {horizon}yr</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Where your dividends could land by year {horizon}, on today's holdings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAssumptions(true)}
          className="shrink-0 text-xs underline text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          ⓘ How this is calculated
        </button>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Projection horizon"
          className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)]/95 p-1 shadow-sm backdrop-blur"
        >
          {HORIZONS.map((n) => {
            const selected = n === horizon;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setHorizon(n)}
                aria-pressed={selected}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  selected
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]",
                )}
              >
                {n}y
              </button>
            );
          })}
        </div>

        <button
          type="button"
          data-testid="fp-drip-toggle"
          onClick={() => setDrip((v) => !v)}
          aria-pressed={drip}
          className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium"
        >
          DRIP {drip ? "on" : "off"}
        </button>

        <div className="flex items-center gap-2">
          <label htmlFor="fp-cagr-slider" className="text-xs text-[var(--text-muted)]">
            Dividend growth
          </label>
          <input
            id="fp-cagr-slider"
            data-testid="fp-cagr-slider"
            type="range"
            min={-0.05}
            max={0.15}
            step={0.0025}
            value={cagrInput ?? 0}
            onChange={(e) => setCagrInput(parseFloat(e.target.value))}
          />
          <span className="text-xs">
            {cagrInput === null ? "Auto" : `${(cagrInput * 100).toFixed(2)}%`}
          </span>
          {cagrInput !== null && (
            <button
              type="button"
              data-testid="fp-reset"
              onClick={() => {
                setCagrInput(null);
                setDebouncedCagr(null);
              }}
              className="text-xs text-[var(--brand)] underline"
            >
              Reset to historical
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          testId="fp-kpi-annual"
          label={`Annual @ ${horizon}yr`}
          value={fmt(last.annualIncome)}
          brand
        />
        <KpiTile
          testId="fp-kpi-cumulative"
          label={`Cumulative · ${horizon}yr`}
          value={fmt(last.cumulative)}
        />
        <KpiTile
          testId="fp-kpi-yoc"
          label={`Forward YoC @ ${horizon}yr`}
          value={`${(last.yieldOnCost * 100).toFixed(2)}%`}
        />
        <KpiTile
          testId="fp-kpi-mult"
          label="Income multiple"
          value={`${last.mult.toFixed(2)}× today`}
        />
      </div>

      {(() => {
        const maxIncome = projection.years.reduce(
          (m, y) => (y.annualIncome > m ? y.annualIncome : m),
          0,
        );
        const hovered =
          hoverYear !== null ? projection.years.find((y) => y.year === hoverYear) ?? null : null;
        return (
          <div data-testid="fp-chart">
            <section
              role="figure"
              aria-label={`Projected annual income for ${horizon} years`}
              className="relative h-[180px] flex items-end gap-1.5 border-b border-[var(--border-subtle)]"
            >
              {projection.years.map((y) => {
                const heightPct = maxIncome > 0 ? Math.max(4, (y.annualIncome / maxIncome) * 100) : 4;
                return (
                  <button
                    key={y.year}
                    type="button"
                    data-testid={`fp-bar-${y.year}`}
                    onMouseEnter={() => setHoverYear(y.year)}
                    onMouseLeave={() =>
                      setHoverYear((cur) => (cur === y.year ? null : cur))
                    }
                    onFocus={() => setHoverYear(y.year)}
                    onBlur={() =>
                      setHoverYear((cur) => (cur === y.year ? null : cur))
                    }
                    aria-label={`Year ${y.year}: ${fmt(y.annualIncome)}`}
                    className="relative flex-1"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: "var(--brand)",
                      opacity: 0.85,
                    }}
                  />
                );
              })}
              {hovered && (
                <div
                  data-testid="fp-tooltip"
                  role="tooltip"
                  className="pointer-events-none absolute top-0 -translate-y-full whitespace-nowrap rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1.5 text-[10px] text-[var(--text)] shadow-md"
                  style={{
                    left: `${((hovered.year - 0.5) / projection.years.length) * 100}%`,
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <p className="font-medium">Year {hovered.year}</p>
                  <p className="font-mono tabular-nums">{fmt(hovered.annualIncome)}</p>
                  <ul className="mt-1 space-y-0.5 text-[var(--text-muted)]">
                    {[...hovered.byTicker]
                      .sort((a, b) => b.contribution - a.contribution)
                      .slice(0, 5)
                      .map((t) => (
                        <li key={t.ticker} className="flex gap-2">
                          <span className="flex-1">{t.ticker}</span>
                          <span className="tabular-nums">{fmt(t.contribution)}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </section>
            <div className="mt-1.5 flex gap-1.5 text-[9px] tabular-nums text-[var(--text-muted)]">
              {projection.years.map((y) => (
                <span key={y.year} className="flex-1 text-center">
                  {y.year}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {projection.fallbackCount > 0 && (
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          {projection.projectedCount} holdings projected, {projection.fallbackCount} via FMP estimate.
        </p>
      )}

      {showAssumptions && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="fp-assumptions-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowAssumptions(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card-surface max-w-md space-y-3 p-6 text-sm"
          >
            <h3 className="font-semibold">How this is calculated</h3>
            <p>
              <strong>CAGR:</strong> each holding's historical dividend growth, capped to
              [0%, +5%] and faded to the long-run 2.5% across years 3 to 12. The scoring
              engine's raw rate is treated as a noisy signal.
            </p>
            <p>
              <strong>DRIP:</strong> when on, shares compound at the dividend yield, capped
              at 4% per year. High-yield holdings do not sustain 8-13% reinvestment for
              decades.
            </p>
            <p>
              <strong>Error band:</strong> historical backtest 5yr MAPE around 32%, 10yr
              MAPE around 46%. The model predicts central tendency, not recessions.
            </p>
            <button
              type="button"
              onClick={() => setShowAssumptions(false)}
              className="text-xs underline text-[var(--text-muted)]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function KpiTile({
  testId,
  label,
  value,
  brand = false,
}: {
  testId: string;
  label: string;
  value: string;
  brand?: boolean;
}) {
  return (
    <div className="rounded-md border border-[var(--border)] p-3">
      <p className="text-[10px] uppercase text-[var(--text-muted)]">{label}</p>
      <p
        data-testid={testId}
        className={
          brand
            ? "mt-1 text-xl font-semibold text-[var(--brand)]"
            : "mt-1 text-xl font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}
