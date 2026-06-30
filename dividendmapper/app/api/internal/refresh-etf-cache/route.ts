// ETF Lane Task 3.5 - Weekly refresh cron for ETF caches. Mondays 03:00 UTC
// (per vercel.json). Iterates etf_universe and for each ticker:
//   1. FMP /etf/info        -> upsert etf_facts row + replace etf_sector_weights_cache rows
//   2. FMP /etf/country-weightings -> replace etf_country_weights_cache rows
//   3. resolveHoldings (AV for US tickers, Yahoo fallback)
//                           -> replace etf_holdings_cache rows
//
// DELETE+INSERT (rather than UPSERT) is intentional: it removes rows that
// dropped out of the latest snapshot (e.g. a holding falling out of the top-10).
// The brief race window is acceptable for a Monday 03:00 cron.
//
// AV's 25 calls/day cap will exhaust partway through; remaining US tickers
// fall back to Yahoo via the resolver's short-circuit. That's expected.
//
// Auth: Authorization: Bearer ${CRON_SECRET} (Vercel Cron sends it). Per-ticker
// failures are caught + Sentry-captured but never abort the run.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { getEtfInfo, getEtfCountryWeights } from "@/lib/scoring/fmp-client";
import { resolveHoldings } from "@/lib/etf/holdings-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 80 tickers × ~5s = 400s baseline; pad headroom for AV/Yahoo slow paths.
export const maxDuration = 800;

async function handle(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[refresh-etf-cache] CRON_SECRET not set");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[refresh-etf-cache] missing supabase env");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = Date.now();

  const { data: universe, error: uErr } = await sb
    .from("etf_universe")
    .select("ticker, domicile");
  if (uErr) {
    Sentry.captureException(uErr, { extra: { stage: "etf_universe" } });
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const rows = (universe ?? []) as { ticker: string; domicile: string | null }[];

  let infoOk = 0;
  let holdingsOk = 0;
  let sectorOk = 0;
  let countryOk = 0;
  const errors: string[] = [];

  for (const u of rows) {
    try {
      const info = (await getEtfInfo(u.ticker))[0];
      if (info) {
        await sb.from("etf_facts").upsert({
          ticker: u.ticker,
          ter: info.expenseRatio ?? null,
          aum: info.assetsUnderManagement ?? null,
          inception_date: info.inceptionDate ?? null,
          holdings_count: info.holdingsCount ?? null,
          isin: info.isin ?? null,
          domicile: info.domicile ?? null,
          family: info.etfCompany ?? null,
          nav_currency: info.navCurrency ?? null,
          refreshed_at: new Date().toISOString(),
        });
        infoOk++;

        if (Array.isArray(info.sectorsList) && info.sectorsList.length) {
          await sb.from("etf_sector_weights_cache").delete().eq("ticker", u.ticker);
          await sb.from("etf_sector_weights_cache").insert(
            info.sectorsList.map((s) => ({
              ticker: u.ticker,
              source: "fmp",
              sector: s.industry,
              weight_pct: s.exposure,
            })),
          );
          sectorOk++;
        }
      }

      const countries = await getEtfCountryWeights(u.ticker);
      if (countries.length) {
        await sb.from("etf_country_weights_cache").delete().eq("ticker", u.ticker);
        await sb.from("etf_country_weights_cache").insert(
          countries.map((c) => ({
            ticker: u.ticker,
            country: c.country,
            weight_pct: Number(String(c.weightPercentage).replace("%", "")),
          })),
        );
        countryOk++;
      }

      const resolved = await resolveHoldings(u.ticker, { domicile: u.domicile });
      if (resolved) {
        await sb.from("etf_holdings_cache").delete().eq("ticker", u.ticker);
        await sb.from("etf_holdings_cache").insert(
          resolved.holdings.map((h) => ({
            ticker: u.ticker,
            source: resolved.source,
            holding_symbol: h.symbol,
            holding_name: h.name,
            weight_pct: h.weight * 100,
            rank: h.rank,
          })),
        );
        holdingsOk++;
      }
    } catch (e) {
      const msg = `${u.ticker}: ${(e as Error).message}`;
      errors.push(msg);
      console.error(`[refresh-etf-cache] ${msg}`);
      Sentry.captureException(e, {
        extra: { ticker: u.ticker, stage: "refresh-etf-cache" },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    tickerCount: rows.length,
    infoOk,
    holdingsOk,
    sectorOk,
    countryOk,
    errors,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
