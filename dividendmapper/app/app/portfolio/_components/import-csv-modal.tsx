"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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

type Kind = "holdings" | "dividends";

interface HoldingPreviewItem {
  ticker: string;
  wrapper: string;
  quantity: number;
  avgCost: number;
  currency: string;
  action: "insert" | "update" | "supersede";
  scored: boolean;
}

interface DividendPreviewItem {
  ticker: string;
  paidOn: string;
  amount: number;
  currency: string;
  type: string;
  scored: boolean;
}

type PreviewItem = HoldingPreviewItem | DividendPreviewItem;

interface RowError {
  line: number;
  status: string;
  ticker: string;
}

interface HoldingsSummary {
  inserts: number;
  updates: number;
  supersedes: number;
  invalid: number;
  unknownTickers: number;
}

interface DividendsSummary {
  dividends: number;
  invalid: number;
  unknownTickers: number;
}

type Summary = HoldingsSummary | DividendsSummary;

type Status =
  | { kind: "idle" }
  | { kind: "previewing" }
  | { kind: "preview"; preview: PreviewItem[]; errors: RowError[]; summary: Summary }
  | { kind: "importing"; preview: PreviewItem[]; errors: RowError[]; summary: Summary }
  | { kind: "error"; message: string };

const ROW_ERROR_COPY: Record<string, string> = {
  invalid_ticker: "ticker isn't a valid symbol",
  invalid_quantity: "quantity must be a number greater than zero",
  invalid_avg_cost: "average cost can't be negative",
  invalid_currency: "currency must be GBP or USD",
  invalid_wrapper: "wrapper isn't one we recognise",
  invalid_amount: "amount must be a number greater than zero",
  invalid_date: "paid_on must be a date like 2026-03-01",
  invalid_gross: "gross per share can't be negative",
};

const ACTION_COPY: Record<HoldingPreviewItem["action"], string> = {
  insert: "New",
  update: "Update",
  supersede: "Replaces manual",
};

const KIND_COPY: Record<
  Kind,
  { title: string; columns: string; template: string; templateName: string; noun: string }
> = {
  holdings: {
    title: "Import holdings from CSV",
    columns: "ticker, quantity, avg_cost, and optionally currency and wrapper",
    template: "/portfolio-import-template.csv",
    templateName: "holdings",
    noun: "holding",
  },
  dividends: {
    title: "Import dividends from CSV",
    columns:
      "ticker, amount, paid_on (YYYY-MM-DD), and optionally currency, wrapper, gross_amount_per_share and type",
    template: "/portfolio-dividends-template.csv",
    templateName: "dividends",
    noun: "dividend",
  },
};

function isDividendSummary(s: Summary): s is DividendsSummary {
  return "dividends" in s;
}

export function ImportCsvModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("holdings");
  const [file, setFile] = useState<File | null>(null);
  const [defaultWrapper, setDefaultWrapper] = useState("gia");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const reset = () => {
    setKind("holdings");
    setFile(null);
    setDefaultWrapper("gia");
    setStatus({ kind: "idle" });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  // Switching kind invalidates any in-progress preview (the columns differ).
  const handleKindChange = (next: Kind) => {
    setKind(next);
    setStatus({ kind: "idle" });
  };

  const send = (dryRun: boolean) => {
    const fd = new FormData();
    fd.append("file", file!);
    fd.append("wrapper", defaultWrapper);
    fd.append("kind", kind);
    fd.append("dryRun", dryRun ? "true" : "false");
    return fetch("/api/portfolio/import/csv", { method: "POST", body: fd });
  };

  const handlePreview = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setStatus({ kind: "previewing" });
    try {
      const res = await send(true);
      if (res.status === 400) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          missingColumns?: string[];
        };
        if (json.error === "missing_columns" && json.missingColumns?.length) {
          const need =
            kind === "dividends"
              ? "a ticker, an amount and a paid_on date"
              : "a ticker, a quantity and an average cost";
          setStatus({
            kind: "error",
            message: `Your file is missing required columns: ${json.missingColumns.join(
              ", ",
            )}. Each row needs ${need}.`,
          });
          return;
        }
        setStatus({ kind: "error", message: "We couldn't read that file. Check it's a CSV and try again." });
        return;
      }
      if (res.status === 403) {
        setStatus({ kind: "error", message: "Importing a CSV is a Pro feature." });
        return;
      }
      if (!res.ok) {
        setStatus({ kind: "error", message: "Something went wrong reading that file. Try again." });
        return;
      }
      const json = (await res.json()) as {
        preview: PreviewItem[];
        errors: RowError[];
        summary: Summary;
      };
      setStatus({ kind: "preview", preview: json.preview, errors: json.errors, summary: json.summary });
    } catch {
      setStatus({ kind: "error", message: "Network error. Check your connection and try again." });
    }
  };

  const handleImport = async () => {
    if (status.kind !== "preview") return;
    setStatus({
      kind: "importing",
      preview: status.preview,
      errors: status.errors,
      summary: status.summary,
    });
    try {
      const res = await send(false);
      if (!res.ok) {
        setStatus({ kind: "error", message: `Something went wrong saving those ${kind}. Try again.` });
        return;
      }
      onOpenChange(false);
      reset();
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Network error. Check your connection and try again." });
    }
  };

  const previewing = status.kind === "previewing";
  const importing = status.kind === "importing";
  const showPreview = status.kind === "preview" || status.kind === "importing";
  const summary = showPreview ? status.summary : null;
  const writeCount =
    summary == null ? 0 : isDividendSummary(summary) ? summary.dividends : summary.inserts + summary.updates;
  const copy = KIND_COPY[kind];

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <Dialog.Title className="font-display text-xl font-semibold tracking-tight text-foreground">
            {copy.title}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Upload a CSV with one row per {copy.noun}. Columns: <span className="font-mono">{copy.columns}</span>.{" "}
            <a
              href={copy.template}
              download
              className="font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              Download {copy.templateName} template
            </a>
          </Dialog.Description>

          {/* What are you importing? — swaps the parser, template and preview. */}
          <fieldset className="mt-5" disabled={previewing || importing}>
            <legend className="mb-2 text-sm font-medium text-foreground">What are you importing?</legend>
            <div
              role="radiogroup"
              aria-label="Import type"
              className="inline-flex rounded-lg border border-border p-0.5"
            >
              {(["holdings", "dividends"] as const).map((k) => (
                <label
                  key={k}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    kind === k
                      ? "bg-brand-600 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    name="import-kind"
                    value={k}
                    checked={kind === k}
                    onChange={() => handleKindChange(k)}
                    className="sr-only"
                  />
                  {k}
                </label>
              ))}
            </div>
          </fieldset>

          <form onSubmit={handlePreview} noValidate className="mt-5 space-y-4">
            <div className="space-y-2">
              <label htmlFor="import-csv-file" className="block text-sm font-medium text-foreground">
                CSV file
              </label>
              <input
                id="import-csv-file"
                type="file"
                accept=".csv,text/csv"
                disabled={previewing || importing}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setStatus({ kind: "idle" });
                }}
                className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-secondary/70 disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="import-csv-wrapper" className="block text-sm font-medium text-foreground">
                Default wrapper{" "}
                <span className="font-normal text-muted-foreground">
                  (used for rows with no wrapper column)
                </span>
              </label>
              <select
                id="import-csv-wrapper"
                value={defaultWrapper}
                onChange={(e) => setDefaultWrapper(e.target.value)}
                disabled={previewing || importing}
                className="block h-[42px] w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-60"
              >
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

            {status.kind === "error" && (
              <p role="alert" aria-live="assertive" className="text-sm font-medium text-destructive">
                {status.message}
              </p>
            )}

            {!showPreview && (
              <div className="flex items-center justify-end gap-2 pt-2">
                <Dialog.Close className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
                  Cancel
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={!file || previewing}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {previewing ? "Reading…" : "Preview"}
                </button>
              </div>
            )}
          </form>

          {showPreview && summary && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                {isDividendSummary(summary) ? (
                  <>
                    {summary.dividends} dividend{summary.dividends === 1 ? "" : "s"}
                    {summary.invalid > 0 && ` · ${summary.invalid} skipped`}
                    {summary.unknownTickers > 0 &&
                      ` · ${summary.unknownTickers} value-only (no resilience score yet)`}
                  </>
                ) : (
                  <>
                    {summary.inserts} new · {summary.updates} updated
                    {summary.supersedes > 0 && ` · ${summary.supersedes} replacing a manual entry`}
                    {summary.invalid > 0 && ` · ${summary.invalid} skipped`}
                    {summary.unknownTickers > 0 &&
                      ` · ${summary.unknownTickers} value-only (no resilience score yet)`}
                  </>
                )}
              </p>

              {status.errors.length > 0 && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground"
                >
                  <p className="font-medium">These rows will be skipped:</p>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {status.errors.slice(0, 10).map((er) => (
                      <li key={`${er.line}-${er.status}`}>
                        Row {er.line} ({er.ticker || "—"}): {ROW_ERROR_COPY[er.status] ?? "invalid row"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {status.preview.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-secondary text-left text-xs uppercase text-muted-foreground">
                      {kind === "dividends" ? (
                        <tr>
                          <th className="px-3 py-2 font-medium">Ticker</th>
                          <th className="px-3 py-2 font-medium">Paid on</th>
                          <th className="px-3 py-2 text-right font-medium">Amount</th>
                          <th className="px-3 py-2 font-medium">Type</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="px-3 py-2 font-medium">Ticker</th>
                          <th className="px-3 py-2 font-medium">Wrapper</th>
                          <th className="px-3 py-2 text-right font-medium">Qty</th>
                          <th className="px-3 py-2 text-right font-medium">Avg cost</th>
                          <th className="px-3 py-2 font-medium">Change</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {kind === "dividends"
                        ? (status.preview as DividendPreviewItem[]).map((p, i) => (
                            <tr key={`${p.ticker}-${p.paidOn}-${i}`} className="border-t border-border">
                              <td className="px-3 py-2 font-mono text-foreground">
                                {p.ticker}
                                {!p.scored && (
                                  <span className="ml-1 text-xs text-muted-foreground">(value-only)</span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono text-muted-foreground">{p.paidOn}</td>
                              <td className="px-3 py-2 text-right font-mono">
                                {p.currency === "GBP" ? "£" : "$"}
                                {p.amount}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{p.type}</td>
                            </tr>
                          ))
                        : (status.preview as HoldingPreviewItem[]).map((p) => (
                            <tr key={`${p.ticker}-${p.wrapper}`} className="border-t border-border">
                              <td className="px-3 py-2 font-mono text-foreground">
                                {p.ticker}
                                {!p.scored && (
                                  <span className="ml-1 text-xs text-muted-foreground">(value-only)</span>
                                )}
                              </td>
                              <td className="px-3 py-2 uppercase text-muted-foreground">{p.wrapper}</td>
                              <td className="px-3 py-2 text-right font-mono">{p.quantity}</td>
                              <td className="px-3 py-2 text-right font-mono">
                                {p.currency === "GBP" ? "£" : "$"}
                                {p.avgCost}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{ACTION_COPY[p.action]}</td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStatus({ kind: "idle" })}
                  disabled={importing}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing || writeCount === 0}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {importing
                    ? "Importing…"
                    : `Import ${writeCount} ${copy.noun}${writeCount === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
