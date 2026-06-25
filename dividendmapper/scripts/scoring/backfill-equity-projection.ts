// One-shot backfill for the Income Calendar v2 projection cache.
// Populates the new equity_scores columns (added in migration 0021) by
// re-fetching FMP dividend history per ticker and running the projection
// engine. Run BEFORE the first post-migration cron cycle so /app/calendar
// doesn't render empty forecasts on day one.
//
//   npx tsx dividendmapper/scripts/scoring/backfill-equity-projection.ts
//
// Reads FMP_API_KEY + SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
// from dividendmapper/.env.local. Idempotent: re-running is safe (the upsert
// path uses .update().eq("ticker") so only the projection columns change).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  detectCadence,
  computeGrowthRate,
  projectDividends,
  type HistoricalPayment,
  type ProjectedPayment,
} from "../../lib/scoring/project-dividends";
import { inferExDivNativeCurrency } from "../../lib/portfolio/ex-div-currency";

const FMP_BASE = "https://financialmodelingprep.com/stable";
const PAD_MS = 1000;

const envPath = new URL("../../.env.local", import.meta.url);
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const apiKey = process.env.FMP_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!apiKey || !supabaseUrl || !serviceKey) {
  console.error("missing FMP_API_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface FmpDividendRow {
  date: string;
  dividend: number;
}

async function fetchFmpDividends(ticker: string): Promise<FmpDividendRow[]> {
  const url = new URL(`${FMP_BASE}/dividends`);
  url.searchParams.set("symbol", ticker);
  url.searchParams.set("limit", "24");
  url.searchParams.set("apikey", apiKey!);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP dividends ${ticker}: ${res.status}`);
  const body = (await res.json()) as unknown;
  return Array.isArray(body)
    ? (body as Array<{ date?: string; dividend?: number }>)
        .filter((d) => typeof d.date === "string" && typeof d.dividend === "number")
        .map((d) => ({ date: d.date!, dividend: d.dividend! }))
    : [];
}

function toJsonbRow(p: ProjectedPayment): Record<string, unknown> {
  return {
    ex_date: p.exDate,
    pay_date: p.payDate,
    per_share_amount: p.perShareAmount,
    currency: p.currency,
    confidence: p.confidence,
  };
}

async function main() {
  const startedAt = Date.now();
  const { data: rows, error } = await sb
    .from("equity_scores")
    .select("ticker");
  if (error) throw error;

  const tickers = (rows ?? []).map((r) => (r as { ticker: string }).ticker);
  console.log(`backfilling projection cache for ${tickers.length} tickers...`);

  const today = new Date();
  let ok = 0;
  let fail = 0;
  const fmpEmptyTickers: string[] = [];

  for (const ticker of tickers) {
    try {
      const dividends = await fetchFmpDividends(ticker);
      const historicalPayments: HistoricalPayment[] = dividends.map((d) => ({
        exDate: d.date,
        amount: d.dividend,
      }));
      const cadence = detectCadence(historicalPayments);
      const growthRate = computeGrowthRate(historicalPayments);
      const currency = inferExDivNativeCurrency(ticker);
      const forward = projectDividends({
        ticker,
        historicalPayments,
        holding: { quantity: 1, createdAt: null },
        today,
        direction: "forward",
        currency,
      });
      const backward = projectDividends({
        ticker,
        historicalPayments,
        holding: { quantity: 1, createdAt: null },
        today,
        direction: "backward",
        currency,
      });

      const { error: updErr } = await sb
        .from("equity_scores")
        .update({
          projected_next_12m_payments: forward.map(toJsonbRow),
          projected_historical_12m_payments: backward.map(toJsonbRow),
          projected_cadence: cadence,
          projected_growth_rate: growthRate,
          projected_at: today.toISOString(),
        })
        .eq("ticker", ticker);
      if (updErr) throw updErr;

      ok++;
      if (historicalPayments.length === 0) fmpEmptyTickers.push(ticker);
      process.stdout.write(`. (${ok + fail}/${tickers.length})\r`);
      await sleep(PAD_MS);
    } catch (err) {
      fail++;
      console.error(`\n${ticker} failed:`, err instanceof Error ? err.message : err);
    }
  }

  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\ndone in ${elapsedSec}s. ok=${ok} fail=${fail}`);
  if (fmpEmptyTickers.length > 0) {
    console.log(
      `${fmpEmptyTickers.length} tickers had no FMP dividend history (cadence='unknown', projections empty):`,
      fmpEmptyTickers.join(", "),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
