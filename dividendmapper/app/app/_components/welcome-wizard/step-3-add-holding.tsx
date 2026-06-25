"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale/context";
import { TickerSearch, type TickerSearchResult } from "@/components/ui/ticker-search";
import { captureClientEvent } from "@/lib/analytics/posthog-capture";

const WRAPPERS_UK = [
  { value: "isa", label: "ISA" },
  { value: "sipp", label: "SIPP" },
  { value: "gia", label: "GIA" },
] as const;

const WRAPPERS_US = [
  { value: "401k", label: "401(k)" },
  { value: "ira", label: "IRA" },
  { value: "roth_ira", label: "Roth IRA" },
  { value: "brokerage", label: "Brokerage" },
] as const;

const ERROR_COPY: Record<string, string> = {
  invalid_ticker: "Select a ticker from the dropdown before saving.",
  invalid_quantity: "Quantity must be greater than zero.",
  invalid_avg_cost: "Average cost can't be negative.",
  invalid_currency: "Pick a currency.",
  invalid_wrapper: "Pick a wrapper.",
};

export interface Step3AddHoldingProps {
  existingHoldingsCount: number;
  onAdvance: () => void;
  onBack: () => void;
}

export function Step3AddHolding({ existingHoldingsCount, onAdvance, onBack }: Step3AddHoldingProps) {
  const router = useRouter();
  const { config } = useLocale();
  const wrappers = config.locale === "us" ? WRAPPERS_US : WRAPPERS_UK;

  const [selectedTicker, setSelectedTicker] = useState<TickerSearchResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [costCurrency, setCostCurrency] = useState<"GBP" | "USD">(config.locale === "us" ? "USD" : "GBP");
  const [wrapper, setWrapper] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPrefix = costCurrency === "GBP" ? "£" : "$";

  // Compute canSubmit before any early return so the hooks order stays
  // consistent across renders.
  const canSubmit = useMemo(
    () =>
      !submitting &&
      !!selectedTicker &&
      Number(quantity) > 0 &&
      Number(avgCost) >= 0 &&
      avgCost !== "" &&
      !!wrapper,
    [submitting, selectedTicker, quantity, avgCost, wrapper],
  );

  if (existingHoldingsCount > 0) {
    const word = existingHoldingsCount === 1 ? "holding" : "holdings";
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2
            id="welcome-wizard-step-3-headline"
            className="font-display text-xl font-semibold text-[var(--text)]"
          >
            You&apos;ve already got {existingHoldingsCount} {word}. Nice.
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Skipping ahead.
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-[var(--text-muted)] hover:underline"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onAdvance}
            className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!canSubmit || !selectedTicker) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/holdings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticker: selectedTicker.symbol,
          quantity: Number(quantity),
          avg_cost: Number(avgCost),
          cost_currency: costCurrency,
          wrapper,
          broker_label: null,
          notes: null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const code = typeof body?.error === "string" ? body.error : "server_error";
        setError(ERROR_COPY[code] ?? "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }
      captureClientEvent("welcome_wizard_holding_added", {
        wrapper,
        currency: costCurrency,
      });
      router.refresh();
      onAdvance();
    } catch {
      setError("Couldn't reach the server. Try again.");
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    captureClientEvent("welcome_wizard_holding_skipped", {});
    onAdvance();
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2
          id="welcome-wizard-step-3-headline"
          className="font-display text-xl font-semibold text-[var(--text)]"
        >
          Add a holding so the app has something to work with.
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Takes about a minute. You can add more later.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-xs text-[var(--text-muted)]" htmlFor="ww-ticker">Ticker</label>
          <TickerSearch
            onSelect={(r) => {
              setSelectedTicker(r);
              if (r.currency === "GBP" || r.currency === "USD") setCostCurrency(r.currency);
            }}
          />
          {selectedTicker && (
            <p className="mt-1 text-xs text-[var(--text-muted)]">Selected: {selectedTicker.symbol}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ww-quantity" className="block text-xs text-[var(--text-muted)]">Quantity</label>
            <input
              id="ww-quantity"
              type="number"
              min="0"
              step="0.0001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label htmlFor="ww-avg-cost" className="block text-xs text-[var(--text-muted)]">Avg cost</label>
            <div className="relative">
              <span
                data-testid="avg-cost-prefix"
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]"
              >
                {costPrefix}
              </span>
              <input
                id="ww-avg-cost"
                type="number"
                min="0"
                step="0.0001"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                className="w-full rounded-md border border-[var(--border-subtle)] bg-transparent py-1 pl-6 pr-2 text-sm"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ww-currency" className="block text-xs text-[var(--text-muted)]">Currency</label>
            <select
              id="ww-currency"
              value={costCurrency}
              onChange={(e) => setCostCurrency(e.target.value as "GBP" | "USD")}
              style={{ colorScheme: "dark light" }}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)]"
            >
              <option value="GBP">GBP</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label htmlFor="ww-wrapper" className="block text-xs text-[var(--text-muted)]">Wrapper</label>
            <select
              id="ww-wrapper"
              value={wrapper}
              onChange={(e) => setWrapper(e.target.value)}
              style={{ colorScheme: "dark light" }}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)]"
            >
              <option value="">Pick one</option>
              {wrappers.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-600">{error}</p>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="text-xs text-[var(--text-muted)] hover:underline">
            Back
          </button>
          <button type="button" onClick={handleSkip} className="text-xs text-[var(--text-muted)] hover:underline">
            I&apos;ll add later
          </button>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving" : "Add holding"}
        </button>
      </div>
    </div>
  );
}
