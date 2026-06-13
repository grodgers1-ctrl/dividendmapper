import Papa from "papaparse";

// Generic, broker-agnostic CSV holdings importer — pure (no I/O). The user maps
// any broker export (or a hand-built sheet) onto a small documented column set;
// we parse + validate it (parseCsvHoldings) and compute the holdings writes
// (buildCsvImportPlan). Unlike the T212 sync path (lib/brokers/sync.ts) there is
// no broker connection, no ticker mapping and no GBX conversion: the user supplies
// our scoring ticker and a 3-letter currency directly, so csv holdings are written
// with source='csv', connection_id=null, external_ref=<scoring ticker>.

export type Wrapper = "isa" | "sipp" | "gia" | "401k" | "ira" | "roth_ira" | "brokerage";
export type Currency = "GBP" | "USD";

const VALID_WRAPPERS: readonly Wrapper[] = [
  "isa",
  "sipp",
  "gia",
  "401k",
  "ira",
  "roth_ira",
  "brokerage",
];
const VALID_CURRENCIES: readonly Currency[] = ["GBP", "USD"];

// Same shape as the manual Add-Holding route (app/api/portfolio/holdings/route.ts)
// so CSV and manual entry agree on what a valid ticker is.
const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;

export type RowErrorStatus =
  | "invalid_ticker"
  | "invalid_quantity"
  | "invalid_avg_cost"
  | "invalid_currency"
  | "invalid_wrapper";

export interface ParsedHolding {
  line: number; // 1-based data-row number (header excluded)
  ticker: string; // normalised, uppercased scoring ticker
  quantity: number;
  avgCost: number;
  currency: Currency;
  wrapper: Wrapper;
}

export interface ParseError {
  line: number;
  status: RowErrorStatus;
  ticker: string; // best-effort, for display in the preview
}

export interface ParseResult {
  rows: ParsedHolding[];
  errors: ParseError[];
  missingColumns: string[]; // required canonical columns not found in the header
}

type Canonical = "ticker" | "quantity" | "avg_cost" | "currency" | "wrapper";

const REQUIRED: Canonical[] = ["ticker", "quantity", "avg_cost"];

const HEADER_ALIASES: Record<Canonical, string[]> = {
  ticker: ["ticker", "symbol", "instrument"],
  quantity: ["quantity", "shares", "qty", "units"],
  avg_cost: [
    "avg_cost",
    "avgcost",
    "cost",
    "price",
    "average_price",
    "averageprice",
    "average cost",
    "avg cost",
    "avg price",
    "average price",
    "book_cost",
    "bookcost",
    "cost_basis",
    "cost basis",
  ],
  currency: ["currency", "ccy", "cur"],
  wrapper: ["wrapper", "account", "account_type", "account type", "accounttype"],
};

const ALIAS_TO_CANONICAL = new Map<string, Canonical>();
for (const [canon, aliases] of Object.entries(HEADER_ALIASES) as [Canonical, string[]][]) {
  for (const a of aliases) ALIAS_TO_CANONICAL.set(a, canon);
}

export interface ParseOptions {
  defaultWrapper?: Wrapper;
  defaultCurrency?: Currency;
}

export function parseCsvHoldings(text: string, opts: ParseOptions = {}): ParseResult {
  const defaultWrapper = opts.defaultWrapper ?? "gia";
  const defaultCurrency = opts.defaultCurrency ?? "GBP";

  // Strip a leading UTF-8 BOM so the first header cell matches its alias.
  const clean = text.replace(/^﻿/, "");
  const parsed = Papa.parse<string[]>(clean, { skipEmptyLines: "greedy" });
  const records = parsed.data.filter((r) => Array.isArray(r));

  if (records.length === 0) {
    return { rows: [], errors: [], missingColumns: [...REQUIRED] };
  }

  const header = records[0];
  const colIndex = new Map<Canonical, number>();
  header.forEach((cell, i) => {
    const canon = ALIAS_TO_CANONICAL.get((cell ?? "").trim().toLowerCase());
    if (canon && !colIndex.has(canon)) colIndex.set(canon, i);
  });

  const missingColumns = REQUIRED.filter((c) => !colIndex.has(c));
  if (missingColumns.length > 0) {
    return { rows: [], errors: [], missingColumns };
  }

  const tIdx = colIndex.get("ticker")!;
  const qIdx = colIndex.get("quantity")!;
  const cIdx = colIndex.get("avg_cost")!;
  const curIdx = colIndex.get("currency");
  const wIdx = colIndex.get("wrapper");

  const rows: ParsedHolding[] = [];
  const errors: ParseError[] = [];

  for (let i = 1; i < records.length; i++) {
    const cells = records[i];
    const line = i; // 1-based data row (header is record 0)

    const ticker = (cells[tIdx] ?? "").trim().toUpperCase();
    if (!TICKER_RE.test(ticker)) {
      errors.push({ line, status: "invalid_ticker", ticker });
      continue;
    }

    const qRaw = (cells[qIdx] ?? "").trim();
    const quantity = qRaw === "" ? NaN : Number(qRaw);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push({ line, status: "invalid_quantity", ticker });
      continue;
    }

    const cRaw = (cells[cIdx] ?? "").trim();
    const avgCost = cRaw === "" ? NaN : Number(cRaw);
    if (!Number.isFinite(avgCost) || avgCost < 0) {
      errors.push({ line, status: "invalid_avg_cost", ticker });
      continue;
    }

    let currency: Currency = defaultCurrency;
    if (curIdx != null) {
      const raw = (cells[curIdx] ?? "").trim();
      if (raw !== "") {
        const up = raw.toUpperCase() as Currency;
        if (!VALID_CURRENCIES.includes(up)) {
          errors.push({ line, status: "invalid_currency", ticker });
          continue;
        }
        currency = up;
      }
    }

    let wrapper: Wrapper = defaultWrapper;
    if (wIdx != null) {
      const raw = (cells[wIdx] ?? "").trim();
      if (raw !== "") {
        const low = raw.toLowerCase() as Wrapper;
        if (!VALID_WRAPPERS.includes(low)) {
          errors.push({ line, status: "invalid_wrapper", ticker });
          continue;
        }
        wrapper = low;
      }
    }

    rows.push({ line, ticker, quantity, avgCost, currency, wrapper });
  }

  return { rows, errors, missingColumns: [] };
}

// ---------------------------------------------------------------------------
// buildCsvImportPlan
// ---------------------------------------------------------------------------

export interface CsvExistingHolding {
  id: string;
  ticker: string; // scoring ticker (holdings.ticker)
  wrapper: string;
  source: "manual" | "trading212" | "csv";
  archivedAt: string | null;
}

export interface CsvInsertRow {
  user_id: string;
  ticker: string;
  quantity: number;
  avg_cost: number;
  cost_currency: Currency;
  wrapper: Wrapper;
  source: "csv";
  external_ref: string;
  connection_id: null;
}

export interface CsvUpdateRow {
  id: string;
  quantity: number;
  avg_cost: number;
}

export type PreviewAction = "insert" | "update" | "supersede";

export interface PreviewItem {
  ticker: string;
  wrapper: Wrapper;
  quantity: number;
  avgCost: number;
  currency: Currency;
  action: PreviewAction;
}

export interface CsvImportPlan {
  inserts: CsvInsertRow[];
  updates: CsvUpdateRow[];
  supersedeArchiveIds: string[];
  preview: PreviewItem[];
}

export interface CsvImportPlanInput {
  userId: string;
  rows: ParsedHolding[];
  existing: CsvExistingHolding[];
}

function holdingKey(ticker: string, wrapper: string): string {
  return `${ticker}::${wrapper}`;
}

// Rules (modelled on lib/brokers/reconcile.ts, with one deliberate divergence):
//   1. Matches an existing csv holding by (ticker, wrapper) → UPDATE (re-upload
//      refreshes; idempotent — never duplicates).
//   2. Matches a non-archived manual holding by (ticker, wrapper) → ARCHIVE the
//      manual (retained, never deleted) + INSERT the csv row.
//   3. No match → INSERT a new source='csv' holding.
//   DIVERGENCE: csv holdings absent from the file are LEFT UNTOUCHED (not
//   archived). A file upload is more error-prone than an API snapshot, so we
//   never destroy rows the file omits; removal stays with the archived/delete UI.
// Already-archived existing rows are inert (never matched, never re-archived).
export function buildCsvImportPlan(input: CsvImportPlanInput): CsvImportPlan {
  const { userId, rows, existing } = input;

  const active = existing.filter((h) => h.archivedAt == null);
  const csvByKey = new Map<string, CsvExistingHolding>();
  const manualsByKey = new Map<string, CsvExistingHolding[]>();
  for (const h of active) {
    const k = holdingKey(h.ticker, h.wrapper);
    if (h.source === "csv") {
      csvByKey.set(k, h);
    } else if (h.source === "manual") {
      const list = manualsByKey.get(k) ?? [];
      list.push(h);
      manualsByKey.set(k, list);
    }
  }

  // Collapse duplicate (ticker, wrapper) rows within the file — last wins.
  const deduped = new Map<string, ParsedHolding>();
  for (const r of rows) deduped.set(holdingKey(r.ticker, r.wrapper), r);

  const inserts: CsvInsertRow[] = [];
  const updates: CsvUpdateRow[] = [];
  const supersedeArchiveIds: string[] = [];
  const preview: PreviewItem[] = [];

  for (const r of deduped.values()) {
    const k = holdingKey(r.ticker, r.wrapper);
    const base = {
      ticker: r.ticker,
      wrapper: r.wrapper,
      quantity: r.quantity,
      avgCost: r.avgCost,
      currency: r.currency,
    };

    const csvMatch = csvByKey.get(k);
    if (csvMatch) {
      updates.push({ id: csvMatch.id, quantity: r.quantity, avg_cost: r.avgCost });
      preview.push({ ...base, action: "update" });
      continue;
    }

    const manuals = manualsByKey.get(k);
    let action: PreviewAction = "insert";
    if (manuals && manuals.length > 0) {
      for (const m of manuals) supersedeArchiveIds.push(m.id);
      action = "supersede";
    }
    inserts.push({
      user_id: userId,
      ticker: r.ticker,
      quantity: r.quantity,
      avg_cost: r.avgCost,
      cost_currency: r.currency,
      wrapper: r.wrapper,
      source: "csv",
      external_ref: r.ticker,
      connection_id: null,
    });
    preview.push({ ...base, action });
  }

  return { inserts, updates, supersedeArchiveIds, preview };
}
