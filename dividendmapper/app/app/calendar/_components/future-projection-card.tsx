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
      <header className="mb-4">
        <h2 className="text-lg font-semibold">Project ahead · {horizon}yr</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Where your dividends could land by year {horizon}, on today's holdings.
        </p>
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

      <div data-testid="fp-chart" className="h-48" aria-hidden="true" />

      {projection.fallbackCount > 0 && (
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          {projection.projectedCount} holdings projected, {projection.fallbackCount} via FMP estimate.
        </p>
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
