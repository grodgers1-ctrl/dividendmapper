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

interface PreviewItem {
  ticker: string;
  wrapper: string;
  quantity: number;
  avgCost: number;
  currency: string;
  action: "insert" | "update" | "supersede";
  scored: boolean;
}

interface RowError {
  line: number;
  status: string;
  ticker: string;
}

interface Summary {
  inserts: number;
  updates: number;
  supersedes: number;
  invalid: number;
  unknownTickers: number;
}

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
};

const ACTION_COPY: Record<PreviewItem["action"], string> = {
  insert: "New",
  update: "Update",
  supersede: "Replaces manual",
};

export function ImportCsvModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [defaultWrapper, setDefaultWrapper] = useState("gia");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const reset = () => {
    setFile(null);
    setDefaultWrapper("gia");
    setStatus({ kind: "idle" });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const send = (dryRun: boolean) => {
    const fd = new FormData();
    fd.append("file", file!);
    fd.append("wrapper", defaultWrapper);
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
          setStatus({
            kind: "error",
            message: `Your file is missing required columns: ${json.missingColumns.join(
              ", ",
            )}. Each row needs a ticker, a quantity and an average cost.`,
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
        setStatus({ kind: "error", message: "Something went wrong saving those holdings. Try again." });
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
  const writeCount = showPreview ? status.summary.inserts + status.summary.updates : 0;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <Dialog.Title className="font-display text-xl font-semibold tracking-tight text-foreground">
            Import holdings from CSV
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Upload a CSV with one row per holding. Columns: <span className="font-mono">ticker</span>,{" "}
            <span className="font-mono">quantity</span>, <span className="font-mono">avg_cost</span>, and
            optionally <span className="font-mono">currency</span> and{" "}
            <span className="font-mono">wrapper</span>.{" "}
            <a
              href="/portfolio-import-template.csv"
              download
              className="font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              Download template
            </a>
          </Dialog.Description>

          <form onSubmit={handlePreview} noValidate className="mt-6 space-y-4">
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

          {showPreview && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                {status.summary.inserts} new · {status.summary.updates} updated
                {status.summary.supersedes > 0 && ` · ${status.summary.supersedes} replacing a manual entry`}
                {status.summary.invalid > 0 && ` · ${status.summary.invalid} skipped`}
                {status.summary.unknownTickers > 0 &&
                  ` · ${status.summary.unknownTickers} value-only (no resilience score yet)`}
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
                      <tr>
                        <th className="px-3 py-2 font-medium">Ticker</th>
                        <th className="px-3 py-2 font-medium">Wrapper</th>
                        <th className="px-3 py-2 text-right font-medium">Qty</th>
                        <th className="px-3 py-2 text-right font-medium">Avg cost</th>
                        <th className="px-3 py-2 font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.preview.map((p) => (
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
                    : `Import ${writeCount} holding${writeCount === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
