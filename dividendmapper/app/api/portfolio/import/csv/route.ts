import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseCsvHoldings,
  buildCsvImportPlan,
  type CsvExistingHolding,
  type Wrapper,
} from "@/lib/brokers/csv-import";
import {
  parseCsvDividends,
  buildCsvDividendImportPlan,
} from "@/lib/brokers/csv-dividends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/portfolio/import/csv — generic, broker-agnostic CSV import.
//
// One endpoint serves two kinds, selected by the `kind` form field:
//   kind=holdings (default) — positions → holdings (insert/update/supersede)
//   kind=dividends          — realised payments → user_dividends (upsert)
//
// Pro-gated (Free users can't import; the free-tier 10-cap therefore never
// applies). multipart/form-data: `file` (the CSV) + optional `wrapper` (default
// for rows with no wrapper column) + `dryRun` + `kind`. With dryRun the route
// parses, builds the plan and annotates each ticker against the scoring
// universe, then returns a PREVIEW without writing. Without it, the plan is
// applied with the RLS server client (the user owns every row). The holdings
// path mirrors runBrokerSync's apply order; the dividends path upserts on
// (user_id, external_id) so re-uploads are idempotent — no duplicates.

const MAX_BYTES = 1_000_000; // ~1 MB upload cap
const MAX_ROWS = 2000; // bound the work per import

const VALID_WRAPPERS: readonly Wrapper[] = [
  "isa",
  "sipp",
  "gia",
  "401k",
  "ira",
  "roth_ira",
  "brokerage",
];

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Pro gate (mirrors the broker connect route): Free users can't import.
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
  if ((profile?.tier ?? "free") === "free") {
    return NextResponse.json(
      { code: "pro_required", message: "Importing a CSV is a Pro feature" },
      { status: 403 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }
  const text = await file.text();

  const dryRunRaw = form.get("dryRun");
  const dryRun = dryRunRaw === "true" || dryRunRaw === "1";

  const wrapperRaw = form.get("wrapper");
  const defaultWrapper =
    typeof wrapperRaw === "string" && VALID_WRAPPERS.includes(wrapperRaw as Wrapper)
      ? (wrapperRaw as Wrapper)
      : "gia";

  const kind = form.get("kind") === "dividends" ? "dividends" : "holdings";
  if (kind === "dividends") {
    return importDividends({ supabase, userId, text, dryRun, defaultWrapper });
  }
  return importHoldings({ supabase, userId, text, dryRun, defaultWrapper });
}

interface ImportArgs {
  supabase: SupabaseClient;
  userId: string;
  text: string;
  dryRun: boolean;
  defaultWrapper: Wrapper;
}

// Annotate which tickers we actually score (others are value-tracked only).
async function loadScoredTickers(
  supabase: SupabaseClient,
  tickers: string[],
): Promise<Set<string>> {
  const known = new Set<string>();
  if (tickers.length === 0) return known;
  const { data: scored } = (await supabase
    .from("equity_scores")
    .select("ticker")
    .in("ticker", tickers)) as { data: { ticker: string }[] | null };
  for (const s of scored ?? []) known.add(s.ticker);
  return known;
}

async function importHoldings({ supabase, userId, text, dryRun, defaultWrapper }: ImportArgs) {
  const parsed = parseCsvHoldings(text, { defaultWrapper });
  if (parsed.missingColumns.length > 0) {
    return NextResponse.json(
      { error: "missing_columns", missingColumns: parsed.missingColumns },
      { status: 400 },
    );
  }
  if (parsed.rows.length > MAX_ROWS) {
    return NextResponse.json({ error: "too_many_rows", max: MAX_ROWS }, { status: 413 });
  }

  // Load the user's existing holdings (RLS scopes to this user). reconcile
  // ignores already-archived rows, so fetch everything.
  const { data: holdingRows, error: holdingsErr } = (await supabase
    .from("holdings")
    .select("id, ticker, wrapper, source, archived_at")) as {
    data:
      | {
          id: string;
          ticker: string;
          wrapper: string;
          source: CsvExistingHolding["source"];
          archived_at: string | null;
        }[]
      | null;
    error: unknown;
  };
  if (holdingsErr) {
    return NextResponse.json({ error: "holdings_load_failed" }, { status: 500 });
  }
  const existing: CsvExistingHolding[] = (holdingRows ?? []).map((r) => ({
    id: r.id,
    ticker: r.ticker,
    wrapper: r.wrapper,
    source: r.source,
    archivedAt: r.archived_at,
  }));

  const plan = buildCsvImportPlan({ userId, rows: parsed.rows, existing });

  // Universe annotation: mark tickers we don't score (value-tracked only).
  const tickers = [...new Set(parsed.rows.map((r) => r.ticker))];
  const knownTickers = await loadScoredTickers(supabase, tickers);
  const preview = plan.preview.map((p) => ({ ...p, scored: knownTickers.has(p.ticker) }));

  const summary = {
    inserts: plan.inserts.length,
    updates: plan.updates.length,
    supersedes: plan.supersedeArchiveIds.length,
    invalid: parsed.errors.length,
    unknownTickers: preview.filter((p) => !p.scored).length,
  };

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, preview, errors: parsed.errors, summary });
  }

  // Apply the plan (same order as runBrokerSync). RLS forces user_id on insert.
  try {
    if (plan.inserts.length) {
      const { error } = await supabase.from("holdings").insert(plan.inserts);
      if (error) throw error;
    }
    for (const u of plan.updates) {
      const { error } = await supabase
        .from("holdings")
        .update({ quantity: u.quantity, avg_cost: u.avg_cost })
        .eq("id", u.id);
      if (error) throw error;
    }
    if (plan.supersedeArchiveIds.length) {
      const { error } = await supabase
        .from("holdings")
        .update({ archived_at: new Date().toISOString() })
        .in("id", plan.supersedeArchiveIds);
      if (error) throw error;
    }
  } catch (err) {
    console.error("[portfolio/import/csv] apply failed", err);
    return NextResponse.json({ error: "import_apply_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, dryRun: false, summary, errors: parsed.errors });
}

async function importDividends({ supabase, userId, text, dryRun, defaultWrapper }: ImportArgs) {
  const parsed = parseCsvDividends(text, { defaultWrapper });
  if (parsed.missingColumns.length > 0) {
    return NextResponse.json(
      { error: "missing_columns", missingColumns: parsed.missingColumns },
      { status: 400 },
    );
  }
  if (parsed.rows.length > MAX_ROWS) {
    return NextResponse.json({ error: "too_many_rows", max: MAX_ROWS }, { status: 413 });
  }

  const plan = buildCsvDividendImportPlan({ userId, rows: parsed.rows });

  // Universe annotation: mark tickers we don't score (value-tracked only).
  const tickers = [...new Set(parsed.rows.map((r) => r.ticker))];
  const knownTickers = await loadScoredTickers(supabase, tickers);
  const preview = plan.preview.map((p) => ({ ...p, scored: knownTickers.has(p.ticker) }));

  const summary = {
    dividends: plan.upserts.length,
    invalid: parsed.errors.length,
    unknownTickers: preview.filter((p) => !p.scored).length,
  };

  if (dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, preview, errors: parsed.errors, summary });
  }

  // Apply: upsert on (user_id, external_id) so re-uploads never duplicate.
  // RLS scopes to this user; user_id is set on every row.
  try {
    if (plan.upserts.length) {
      const { error } = await supabase
        .from("user_dividends")
        .upsert(plan.upserts, { onConflict: "user_id,external_id" });
      if (error) throw error;
    }
  } catch (err) {
    console.error("[portfolio/import/csv] dividend apply failed", err);
    return NextResponse.json({ error: "import_apply_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, dryRun: false, summary, errors: parsed.errors });
}
