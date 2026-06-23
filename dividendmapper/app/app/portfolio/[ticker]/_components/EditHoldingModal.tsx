"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

// Mirrors AddHoldingModal's wrapper + currency options but pre-populates from
// the current holding. Ticker is intentionally NOT editable — the PATCH route
// rejects ticker changes because they would orphan a holding from its scoring
// history. To "rename" a holding the user deletes and re-adds.

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

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "field-error"; message: string }
  | { kind: "server-error"; message: string };

const ERROR_COPY: Record<string, string> = {
  invalid_quantity: "Quantity must be greater than zero.",
  invalid_avg_cost: "Average cost can't be negative.",
  invalid_currency: "Pick a currency.",
  invalid_wrapper: "Pick a wrapper.",
  broker_label_too_long: "Broker label is too long (80 char max).",
  notes_too_long: "Notes are too long (500 char max).",
  ticker_not_editable:
    "Ticker can't be edited — delete this row and add a new one if you need to change it.",
  no_changes: "Nothing has changed.",
  not_found: "That holding no longer exists. Refresh the page.",
};

export interface EditHoldingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holdingId: string;
  ticker: string;
  initial: {
    quantity: number;
    avgCost: number;
    costCurrency: "GBP" | "USD";
    wrapper: string;
    brokerLabel: string | null;
    notes: string | null;
  };
}

export function EditHoldingModal({
  open,
  onOpenChange,
  holdingId,
  ticker,
  initial,
}: EditHoldingModalProps) {
  const router = useRouter();

  const [quantity, setQuantity] = useState(String(initial.quantity));
  const [avgCost, setAvgCost] = useState(String(initial.avgCost));
  const [costCurrency, setCostCurrency] = useState<"GBP" | "USD">(initial.costCurrency);
  const [wrapper, setWrapper] = useState<string>(initial.wrapper);
  const [brokerLabel, setBrokerLabel] = useState(initial.brokerLabel ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");

  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const resetForm = () => {
    setQuantity(String(initial.quantity));
    setAvgCost(String(initial.avgCost));
    setCostCurrency(initial.costCurrency);
    setWrapper(initial.wrapper);
    setBrokerLabel(initial.brokerLabel ?? "");
    setNotes(initial.notes ?? "");
    setStatus({ kind: "idle" });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

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
      const res = await fetch(`/api/portfolio/holdings/${holdingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: qty,
          avg_cost: cost,
          cost_currency: costCurrency,
          wrapper,
          broker_label: brokerLabel.trim() === "" ? null : brokerLabel.trim(),
          notes: notes.trim() === "" ? null : notes.trim(),
        }),
      });

      if (res.status === 204) {
        onOpenChange(false);
        router.refresh();
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

      if (res.status === 404) {
        setStatus({ kind: "server-error", message: ERROR_COPY.not_found });
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
            Edit {ticker}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Ticker can&apos;t be changed. Delete this row and add a new one if you need to rename it.
          </Dialog.Description>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="edit-holding-quantity" className="block text-sm font-medium text-foreground">
                Quantity
              </label>
              <input
                id="edit-holding-quantity"
                type="number"
                required
                inputMode="decimal"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={submitting}
                className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-3">
              <div className="space-y-2">
                <label htmlFor="edit-holding-currency" className="block text-sm font-medium text-foreground">
                  Currency
                </label>
                <select
                  id="edit-holding-currency"
                  value={costCurrency}
                  onChange={(e) => setCostCurrency(e.target.value as "GBP" | "USD")}
                  disabled={submitting}
                  className="block h-[42px] rounded-lg border border-input bg-background px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
                >
                  <option value="GBP">GBP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-holding-avg-cost" className="block text-sm font-medium text-foreground">
                  Average cost (per share)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-base text-muted-foreground">
                    {costPrefix}
                  </span>
                  <input
                    id="edit-holding-avg-cost"
                    type="number"
                    required
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={avgCost}
                    onChange={(e) => setAvgCost(e.target.value)}
                    disabled={submitting}
                    className="block w-full rounded-lg border border-input bg-background py-2.5 pl-7 pr-3 font-mono text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-holding-wrapper" className="block text-sm font-medium text-foreground">
                Wrapper
              </label>
              <select
                id="edit-holding-wrapper"
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

            <div className="space-y-2">
              <label htmlFor="edit-holding-broker" className="block text-sm font-medium text-foreground">
                Broker <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                id="edit-holding-broker"
                type="text"
                maxLength={80}
                value={brokerLabel}
                onChange={(e) => setBrokerLabel(e.target.value)}
                disabled={submitting}
                className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-holding-notes" className="block text-sm font-medium text-foreground">
                Notes <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="edit-holding-notes"
                maxLength={500}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                className="block w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
              />
            </div>

            {(status.kind === "field-error" || status.kind === "server-error") && (
              <p role="alert" aria-live="assertive" className="text-sm font-medium text-destructive">
                {status.message}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Dialog.Close className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
