"use client";

import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  FREE_TIER_CAP_MESSAGE,
  FREE_TIER_CAP_TITLE,
} from "./free-tier-copy";

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

const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;

type TickerCheck =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; ticker: string; name: string | null }
  | { kind: "warn"; reason: string };

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "field-error"; message: string }
  | { kind: "limit"; message: string }
  | { kind: "server-error"; message: string };

const ERROR_COPY: Record<string, string> = {
  invalid_ticker: "That ticker doesn't look right. Use letters, digits, dots, or dashes only.",
  invalid_quantity: "Quantity must be greater than zero.",
  invalid_avg_cost: "Average cost can't be negative.",
  invalid_currency: "Pick a currency.",
  invalid_wrapper: "Pick a wrapper.",
  broker_label_too_long: "Broker label is too long (80 char max).",
  notes_too_long: "Notes are too long (500 char max).",
};

export function AddHoldingModal({
  open,
  onOpenChange,
  pricingPublic,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pricingPublic: boolean;
}) {
  const router = useRouter();

  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [costCurrency, setCostCurrency] = useState<"GBP" | "USD">("GBP");
  const [wrapper, setWrapper] = useState<string>("");
  const [brokerLabel, setBrokerLabel] = useState("");
  const [notes, setNotes] = useState("");

  const [tickerCheck, setTickerCheck] = useState<TickerCheck>({ kind: "idle" });
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const resetForm = () => {
    setTicker("");
    setQuantity("");
    setAvgCost("");
    setCostCurrency("GBP");
    setWrapper("");
    setBrokerLabel("");
    setNotes("");
    setTickerCheck({ kind: "idle" });
    setStatus({ kind: "idle" });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleTickerBlur = async () => {
    const normalised = ticker.trim().toUpperCase();
    if (!normalised) {
      setTickerCheck({ kind: "idle" });
      return;
    }
    if (!TICKER_RE.test(normalised)) {
      setTickerCheck({
        kind: "warn",
        reason: "Letters, digits, . or - only.",
      });
      return;
    }
    setTickerCheck({ kind: "checking" });
    try {
      const res = await fetch(
        `/api/market/quote?ticker=${encodeURIComponent(normalised)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as
        | { ok: true; data: { name: string | null } }
        | { ok: false; error: string };
      if (res.ok && json.ok) {
        setTickerCheck({
          kind: "ok",
          ticker: normalised,
          name: json.data.name,
        });
      } else {
        setTickerCheck({
          kind: "warn",
          reason: "Couldn't verify this ticker. Saving anyway.",
        });
      }
    } catch {
      setTickerCheck({
        kind: "warn",
        reason: "Couldn't verify this ticker. Saving anyway.",
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const trimmedTicker = ticker.trim().toUpperCase();
    if (!trimmedTicker || !TICKER_RE.test(trimmedTicker)) {
      setStatus({ kind: "field-error", message: ERROR_COPY.invalid_ticker });
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setStatus({ kind: "field-error", message: ERROR_COPY.invalid_quantity });
      return;
    }
    const cost = Number(avgCost);
    if (!Number.isFinite(cost) || cost < 0) {
      setStatus({ kind: "field-error", message: ERROR_COPY.invalid_avg_cost });
      return;
    }
    if (!wrapper) {
      setStatus({ kind: "field-error", message: ERROR_COPY.invalid_wrapper });
      return;
    }

    setStatus({ kind: "submitting" });

    try {
      const res = await fetch("/api/portfolio/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: trimmedTicker,
          quantity: qty,
          avg_cost: cost,
          cost_currency: costCurrency,
          wrapper,
          broker_label: brokerLabel.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      if (res.status === 201) {
        resetForm();
        onOpenChange(false);
        // Server component re-fetches holdings on refresh; page is
        // force-dynamic so this hits Supabase, not a cached render.
        router.refresh();
        return;
      }

      if (res.status === 402) {
        // Ignore the server message. Single source of truth lives in
        // free-tier-copy so the modal alert, launcher, and hidden-rows
        // banner all read the same string.
        await res.json().catch(() => ({}));
        setStatus({
          kind: "limit",
          message: FREE_TIER_CAP_MESSAGE,
        });
        return;
      }

      if (res.status === 400) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        const message =
          (json.error && ERROR_COPY[json.error]) ??
          "Please check the fields and try again.";
        setStatus({ kind: "field-error", message });
        return;
      }

      if (res.status === 401) {
        setStatus({
          kind: "server-error",
          message: "Your session expired. Refresh the page and sign in again.",
        });
        return;
      }

      setStatus({
        kind: "server-error",
        message: "Something went wrong saving that holding. Try again.",
      });
    } catch {
      setStatus({
        kind: "server-error",
        message: "Network error. Check your connection and try again.",
      });
    }
  };

  const submitting = status.kind === "submitting";
  const costPrefix = costCurrency === "GBP" ? "£" : "$";

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <Dialog.Title className="font-display text-xl font-semibold tracking-tight text-foreground">
            Add a holding
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">
            One row per ticker-and-wrapper combination. Same ticker in two
            wrappers? Add it twice.
          </Dialog.Description>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            {/* Ticker */}
            <div className="space-y-2">
              <label
                htmlFor="add-holding-ticker"
                className="block text-sm font-medium text-foreground"
              >
                Ticker
              </label>
              <input
                id="add-holding-ticker"
                type="text"
                required
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="e.g. ULVR.L or SCHD"
                value={ticker}
                onChange={(e) => {
                  setTicker(e.target.value);
                  setTickerCheck({ kind: "idle" });
                }}
                onBlur={handleTickerBlur}
                disabled={submitting}
                className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-base uppercase text-foreground placeholder:font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
              />
              {tickerCheck.kind === "checking" && (
                <p className="text-xs text-muted-foreground">Checking…</p>
              )}
              {tickerCheck.kind === "ok" && (
                <p className="text-xs text-muted-foreground">
                  Looks like{" "}
                  <span className="font-mono text-foreground">
                    {tickerCheck.ticker}
                  </span>
                  {tickerCheck.name ? ` · ${tickerCheck.name}` : ""}
                </p>
              )}
              {tickerCheck.kind === "warn" && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {tickerCheck.reason}
                </p>
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <label
                htmlFor="add-holding-quantity"
                className="block text-sm font-medium text-foreground"
              >
                Quantity
              </label>
              <input
                id="add-holding-quantity"
                type="number"
                required
                inputMode="decimal"
                step="any"
                min="0"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={submitting}
                className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
              />
              <p className="text-xs text-muted-foreground">
                Fractional shares OK. Up to 6 decimal places.
              </p>
            </div>

            {/* Currency + avg cost */}
            <div className="grid grid-cols-[auto_1fr] gap-3">
              <div className="space-y-2">
                <label
                  htmlFor="add-holding-currency"
                  className="block text-sm font-medium text-foreground"
                >
                  Currency
                </label>
                <select
                  id="add-holding-currency"
                  value={costCurrency}
                  onChange={(e) =>
                    setCostCurrency(e.target.value as "GBP" | "USD")
                  }
                  disabled={submitting}
                  className="block h-[42px] rounded-lg border border-input bg-background px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
                >
                  <option value="GBP">GBP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="add-holding-avg-cost"
                  className="block text-sm font-medium text-foreground"
                >
                  Average cost (per share)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-base text-muted-foreground">
                    {costPrefix}
                  </span>
                  <input
                    id="add-holding-avg-cost"
                    type="number"
                    required
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={avgCost}
                    onChange={(e) => setAvgCost(e.target.value)}
                    disabled={submitting}
                    className="block w-full rounded-lg border border-input bg-background py-2.5 pl-7 pr-3 font-mono text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* Wrapper */}
            <div className="space-y-2">
              <label
                htmlFor="add-holding-wrapper"
                className="block text-sm font-medium text-foreground"
              >
                Wrapper
              </label>
              <select
                id="add-holding-wrapper"
                required
                value={wrapper}
                onChange={(e) => setWrapper(e.target.value)}
                disabled={submitting}
                className="block h-[42px] w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
              >
                <option value="" disabled>
                  Pick a wrapper
                </option>
                <optgroup label="UK">
                  {WRAPPERS_UK.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="US">
                  {WRAPPERS_US.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Broker label */}
            <div className="space-y-2">
              <label
                htmlFor="add-holding-broker"
                className="block text-sm font-medium text-foreground"
              >
                Broker{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <input
                id="add-holding-broker"
                type="text"
                maxLength={80}
                placeholder="e.g. T212 ISA"
                value={brokerLabel}
                onChange={(e) => setBrokerLabel(e.target.value)}
                disabled={submitting}
                className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label
                htmlFor="add-holding-notes"
                className="block text-sm font-medium text-foreground"
              >
                Notes{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <textarea
                id="add-holding-notes"
                maxLength={500}
                rows={2}
                placeholder="Anything you want to remember about this position."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                className="block w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
              />
            </div>

            {/* Inline error / limit prompt */}
            {status.kind === "field-error" && (
              <p
                role="alert"
                aria-live="assertive"
                className="text-sm font-medium text-destructive"
              >
                {status.message}
              </p>
            )}
            {status.kind === "server-error" && (
              <p
                role="alert"
                aria-live="assertive"
                className="text-sm font-medium text-destructive"
              >
                {status.message}
              </p>
            )}
            {status.kind === "limit" && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-lg border border-brand-500/30 bg-brand-50 p-3 text-sm leading-relaxed text-foreground dark:border-brand-400/20 dark:bg-brand-900/20"
              >
                <p className="font-display text-sm font-semibold">
                  {FREE_TIER_CAP_TITLE}
                </p>
                <p className="mt-0.5 text-muted-foreground">{status.message}</p>
                {pricingPublic && (
                  <Link
                    href="/pricing"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
                  >
                    Upgrade to Pro
                    <span aria-hidden>→</span>
                  </Link>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Dialog.Close className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={submitting || status.kind === "limit"}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Saving…" : "Add holding"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
