import { createHash } from "node:crypto";
import Papa from "papaparse";
import type { Currency, Wrapper } from "@/lib/brokers/csv-import";

// Generic, broker-agnostic CSV DIVIDEND-history importer — pure (no I/O). The
// companion to the holdings importer (lib/brokers/csv-import.ts): instead of
// positions it ingests REALISED dividend payments into user_dividends, so users
// who won't paste a broker API key can still populate the "Received (12m)"
// surface. parseCsvDividends validates + line-numbers the file; buildCsvDividend-
// ImportPlan computes the upsert rows.
//
// Unlike the T212 sync path (lib/brokers/sync.ts) there is no broker connection
// and no ticker mapping: the user supplies OUR scoring ticker directly, so each
// row is written with source='csv', connection_id=null, and ticker == ticker_scoring.
// external_id is a deterministic hash prefixed "csv:" (mirrors sync's hashDividend)
// so re-uploading the same file upserts the same rows — idempotent, no duplicates.

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

// Same shape as the holdings importer / manual Add-Holding route so every entry
// path agrees on what a valid ticker is.
const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;

// ISO calendar dates only, with '-' or '/' separators. Deliberately strict: we
// will NOT guess DD/MM vs MM/DD, since a wrong-month dividend silently corrupts
// realised-income totals. The template documents YYYY-MM-DD.
const DATE_RE = /^(\d{4})[-/](\d{2})[-/](\d{2})$/;

export type DividendRowErrorStatus =
  | "invalid_ticker"
  | "invalid_amount"
  | "invalid_date"
  | "invalid_currency"
  | "invalid_wrapper"
  | "invalid_gross";

export interface ParsedDividend {
  line: number; // 1-based data-row number (header excluded)
  ticker: string; // normalised, uppercased scoring ticker
  amount: number;
  paidOn: string; // YYYY-MM-DD
  currency: Currency;
  wrapper: Wrapper;
  grossPerShare: number | null;
  type: string; // lowercased
}

export interface DividendParseError {
  line: number;
  status: DividendRowErrorStatus;
  ticker: string; // best-effort, for display in the preview
}

export interface DividendParseResult {
  rows: ParsedDividend[];
  errors: DividendParseError[];
  missingColumns: string[]; // required canonical columns not found in the header
}

type Canonical =
  | "ticker"
  | "amount"
  | "paid_on"
  | "currency"
  | "wrapper"
  | "gross_amount_per_share"
  | "type";

const REQUIRED: Canonical[] = ["ticker", "amount", "paid_on"];

const HEADER_ALIASES: Record<Canonical, string[]> = {
  ticker: ["ticker", "symbol", "instrument"],
  amount: [
    "amount",
    "dividend_amount",
    "dividend amount",
    "value",
    "net_amount",
    "net amount",
    "total",
    "amount_received",
    "amount received",
    "received",
  ],
  paid_on: [
    "paid_on",
    "paid on",
    "paidon",
    "paid",
    "date",
    "pay_date",
    "pay date",
    "payment_date",
    "payment date",
    "paid_date",
    "paid date",
  ],
  currency: ["currency", "ccy", "cur"],
  wrapper: ["wrapper", "account", "account_type", "account type", "accounttype"],
  gross_amount_per_share: [
    "gross_amount_per_share",
    "gross amount per share",
    "gross_per_share",
    "gross per share",
    "gross",
    "dividend_per_share",
    "dividend per share",
    "amount_per_share",
    "amount per share",
    "per_share",
    "per share",
  ],
  type: ["type", "dividend_type", "dividend type", "kind"],
};

const ALIAS_TO_CANONICAL = new Map<string, Canonical>();
for (const [canon, aliases] of Object.entries(HEADER_ALIASES) as [Canonical, string[]][]) {
  for (const a of aliases) ALIAS_TO_CANONICAL.set(a, canon);
}

export interface DividendParseOptions {
  defaultWrapper?: Wrapper;
  defaultCurrency?: Currency;
}

// Validate a real calendar date and normalise separators to '-'. Round-trips
// through Date.UTC so rollover values (e.g. 2026-02-30 → Mar 2) are rejected.
function normaliseIsoDate(raw: string): string | null {
  const m = DATE_RE.exec(raw);
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return `${y}-${mo}-${d}`;
}

export function parseCsvDividends(
  text: string,
  opts: DividendParseOptions = {},
): DividendParseResult {
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
  const aIdx = colIndex.get("amount")!;
  const dIdx = colIndex.get("paid_on")!;
  const curIdx = colIndex.get("currency");
  const wIdx = colIndex.get("wrapper");
  const gIdx = colIndex.get("gross_amount_per_share");
  const typeIdx = colIndex.get("type");

  const rows: ParsedDividend[] = [];
  const errors: DividendParseError[] = [];

  for (let i = 1; i < records.length; i++) {
    const cells = records[i];
    const line = i; // 1-based data row (header is record 0)

    const ticker = (cells[tIdx] ?? "").trim().toUpperCase();
    if (!TICKER_RE.test(ticker)) {
      errors.push({ line, status: "invalid_ticker", ticker });
      continue;
    }

    const aRaw = (cells[aIdx] ?? "").trim();
    const amount = aRaw === "" ? NaN : Number(aRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ line, status: "invalid_amount", ticker });
      continue;
    }

    const dRaw = (cells[dIdx] ?? "").trim();
    const paidOn = normaliseIsoDate(dRaw);
    if (paidOn == null) {
      errors.push({ line, status: "invalid_date", ticker });
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

    let grossPerShare: number | null = null;
    if (gIdx != null) {
      const raw = (cells[gIdx] ?? "").trim();
      if (raw !== "") {
        const g = Number(raw);
        if (!Number.isFinite(g) || g < 0) {
          errors.push({ line, status: "invalid_gross", ticker });
          continue;
        }
        grossPerShare = g;
      }
    }

    let type = "dividend";
    if (typeIdx != null) {
      const raw = (cells[typeIdx] ?? "").trim().toLowerCase();
      if (raw !== "") type = raw;
    }

    rows.push({ line, ticker, amount, paidOn, currency, wrapper, grossPerShare, type });
  }

  return { rows, errors, missingColumns: [] };
}

// ---------------------------------------------------------------------------
// buildCsvDividendImportPlan
// ---------------------------------------------------------------------------

export interface CsvDividendUpsertRow {
  user_id: string;
  connection_id: null;
  ticker: string; // scoring ticker (user supplies ours directly)
  ticker_scoring: string; // == ticker for csv rows
  wrapper: Wrapper;
  amount: number;
  currency: Currency;
  gross_amount_per_share: number | null;
  paid_on: string; // YYYY-MM-DD
  type: string;
  external_id: string; // "csv:" + sha256(ticker|paid_on|amount|gross)
  source: "csv";
}

export interface CsvDividendPreviewItem {
  ticker: string;
  paidOn: string;
  amount: number;
  currency: Currency;
  type: string;
}

export interface CsvDividendImportPlan {
  upserts: CsvDividendUpsertRow[];
  preview: CsvDividendPreviewItem[];
}

export interface CsvDividendImportPlanInput {
  userId: string;
  rows: ParsedDividend[];
}

// Mirrors sync.ts hashDividend so the two ingest paths agree on identity, but
// namespaced "csv:" so a CSV import never collides with a broker-synced payment.
function hashCsvDividend(
  ticker: string,
  paidOn: string,
  amount: number,
  grossPerShare: number | null,
): string {
  const composite = [ticker, paidOn, amount, grossPerShare ?? ""].join("|");
  return "csv:" + createHash("sha256").update(composite).digest("hex").slice(0, 32);
}

export function buildCsvDividendImportPlan(
  input: CsvDividendImportPlanInput,
): CsvDividendImportPlan {
  const { userId, rows } = input;

  // Collapse rows that hash to the same external_id within one file. Postgres
  // ON CONFLICT cannot touch the same row twice in a single upsert statement,
  // so identical (ticker, paid_on, amount, gross) lines must dedupe — last wins.
  const byId = new Map<string, CsvDividendUpsertRow>();
  for (const r of rows) {
    const external_id = hashCsvDividend(r.ticker, r.paidOn, r.amount, r.grossPerShare);
    byId.set(external_id, {
      user_id: userId,
      connection_id: null,
      ticker: r.ticker,
      ticker_scoring: r.ticker,
      wrapper: r.wrapper,
      amount: r.amount,
      currency: r.currency,
      gross_amount_per_share: r.grossPerShare,
      paid_on: r.paidOn,
      type: r.type,
      external_id,
      source: "csv",
    });
  }

  const upserts = [...byId.values()];
  const preview: CsvDividendPreviewItem[] = upserts.map((u) => ({
    ticker: u.ticker,
    paidOn: u.paid_on,
    amount: u.amount,
    currency: u.currency,
    type: u.type,
  }));

  return { upserts, preview };
}
