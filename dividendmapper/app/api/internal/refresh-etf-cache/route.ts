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
//
// === Vercel Hobby tier (60s cap) chunking ===
// The route picks the N stalest tickers per invocation (oldest refreshed_at
// first, NULLs/unseeded first, alphabetical tie-breaker for deterministic
// debugging). A soft 50s deadline is enforced inside the per-ticker loop so
// the response always returns inside the 60s function cap. Callers (Vercel
// cron with ?limit=10, or the local smoke loop) re-invoke until the response
// shows processed < requestedLimit, which means the queue is drained.
//
// Idempotency note: two overlapping invocations would race on the DELETE+INSERT
// for the same ticker. A weekly Monday 03:00 cron + a chunked manual smoke
// won't collide in practice, but if this ever fans out to per-hour we'd want
// an advisory lock per ticker.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { getEtfInfo, getEtfCountryWeights, getDividends } from "@/lib/scoring/fmp-client";
import { resolveHoldings } from "@/lib/etf/holdings-resolver";
import { detectCadence } from "@/lib/scoring/project-dividends";
import { computeEtfQuality } from "@/lib/scoring/compute-etf-quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby tier caps function execution at 60s. Chunked via ?limit=N.
export const maxDuration = 60;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
// Leave ~10s headroom for the JSON response + any in-flight cleanup.
const SOFT_DEADLINE_MS = 50_000;

// Cadence detector returns 'monthly' | 'quarterly' | 'semi' | 'annual' |
// 'irregular' | 'unknown'. We collapse to the 3 ETF Quality tiers.
async function classifyCadence(ticker: string): Promise<"regular" | "semi-irregular" | "irregular"> {
  const divs = await getDividends(ticker, 40);
  const cad = detectCadence(
    divs.map((d) => ({
      exDate: d.date,
      amount: d.adjDividend ?? d.dividend,
    })),
  );
  if (cad === "monthly" || cad === "quarterly" || cad === "semi" || cad === "annual") {
    return "regular";
  }
  // 'irregular' and 'unknown' both fall here. 'semi-irregular' never produced
  // by the current detector but is a valid Tier value the score module accepts.
  return "irregular";
}

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

  // Parse + clamp the limit query param (default 10, 1..50).
  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const requestedLimit = Math.max(
    1,
    Math.min(MAX_LIMIT, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : DEFAULT_LIMIT),
  );

  // Optional staleBefore cursor: when set, only pick tickers whose
  // refreshed_at is NULL or strictly older than this ISO timestamp. The local
  // smoke captures Date.now() at run start and passes it on every request so
  // tickers already refreshed this run are excluded, letting the loop
  // terminate cleanly once every ticker has been touched. Production cron
  // omits this param and falls back to the "stalest N" cursor.
  const staleBeforeParam = url.searchParams.get("staleBefore");
  const staleBefore: string | null =
    staleBeforeParam && !Number.isNaN(Date.parse(staleBeforeParam))
      ? new Date(staleBeforeParam).toISOString()
      : null;

  // Cursor: two simple queries + JS-side sort. Bulletproof and avoids
  // PostgREST embed-join gotchas. NULLs (unseeded tickers) come first, then
  // oldest refreshed_at, with alphabetical ticker as the tie-breaker.
  const [universeRes, factsRes] = await Promise.all([
    sb.from("etf_universe").select("ticker, domicile"),
    sb.from("etf_facts").select("ticker, refreshed_at"),
  ]);
  if (universeRes.error) {
    console.error("[refresh-etf-cache] etf_universe query failed", universeRes.error);
    Sentry.captureException(universeRes.error, { extra: { stage: "etf_universe" } });
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  if (factsRes.error) {
    console.error("[refresh-etf-cache] etf_facts query failed", factsRes.error);
    Sentry.captureException(factsRes.error, { extra: { stage: "etf_facts" } });
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const refreshedByTicker = new Map<string, string | null>(
    (factsRes.data ?? []).map((r: { ticker: string; refreshed_at: string | null }) => [
      r.ticker,
      r.refreshed_at,
    ]),
  );
  const totalUniverse = universeRes.data?.length ?? 0;
  const universe = (universeRes.data ?? [])
    .map((u: { ticker: string; domicile: string | null }) => ({
      ticker: u.ticker,
      domicile: u.domicile,
      refreshed_at: refreshedByTicker.get(u.ticker) ?? null,
    }))
    .sort((a, b) => {
      // NULLs first (unseeded tickers).
      if (a.refreshed_at === null && b.refreshed_at === null) {
        return a.ticker.localeCompare(b.ticker);
      }
      if (a.refreshed_at === null) return -1;
      if (b.refreshed_at === null) return 1;
      // Oldest refreshed_at first; alphabetical tie-breaker.
      const cmp = a.refreshed_at.localeCompare(b.refreshed_at);
      return cmp !== 0 ? cmp : a.ticker.localeCompare(b.ticker);
    });
  const candidates = universe.filter(
    (u) => staleBefore === null || u.refreshed_at === null || u.refreshed_at < staleBefore,
  );
  const rows = candidates.slice(0, requestedLimit);

  let infoOk = 0;
  let holdingsOk = 0;
  let sectorOk = 0;
  let countryOk = 0;
  let processed = 0;
  let deadlineHit = false;
  const errors: string[] = [];

  for (const u of rows) {
    // Deadline check at the TOP of each iteration so we never start a
    // ticker we can't finish before the 60s cap.
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) {
      deadlineHit = true;
      console.warn(
        `[refresh-etf-cache] deadline hit after ${processed} tickers; bailing with ${rows.length - processed} remaining in this chunk`,
      );
      break;
    }
    try {
      const info = (await getEtfInfo(u.ticker))[0];
      if (info) {
        // FMP returns expenseRatio as a percent number (0.19 = 0.19%). We store
        // as decimal (0.0019) so computeEtfQuality and downstream display can
        // both treat it as a fraction.
        const terDecimal = info.expenseRatio != null ? info.expenseRatio / 100 : null;
        await sb.from("etf_facts").upsert({
          ticker: u.ticker,
          ter: terDecimal,
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

        // --- Income Quality scoring ---
        let cadenceTier: "regular" | "semi-irregular" | "irregular" = "irregular";
        try {
          cadenceTier = await classifyCadence(u.ticker);
        } catch (e) {
          // dividend fetch can 429 / 404 - degrade to 'irregular' rather than abort
          console.warn(`[refresh-etf-cache] cadence ${u.ticker}: ${(e as Error).message}`);
        }
        const { data: uniRow } = await sb
          .from("etf_universe")
          .select("distribution_policy")
          .eq("ticker", u.ticker)
          .maybeSingle();
        const policy = (uniRow?.distribution_policy ?? "Unknown") as
          | "Distributing"
          | "Accumulating"
          | "Unknown";
        const quality = computeEtfQuality({
          ter: terDecimal,
          aum: info.assetsUnderManagement ?? null,
          inception_date: info.inceptionDate ?? null,
          distribution_policy: policy,
          cadenceTier,
          yieldStabilityTier: "moderate", // placeholder until TTM CV refinement
        });
        await sb
          .from("etf_facts")
          .update({
            quality_headline: quality.headline,
            quality_cost: quality.pillars.cost,
            quality_process: quality.pillars.process,
            quality_income: quality.pillars.income,
          })
          .eq("ticker", u.ticker);
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
      processed++;
    } catch (e) {
      const msg = `${u.ticker}: ${(e as Error).message}`;
      errors.push(msg);
      console.error(`[refresh-etf-cache] ${msg}`);
      Sentry.captureException(e, {
        extra: { ticker: u.ticker, stage: "refresh-etf-cache" },
      });
      // Count it as processed so the caller doesn't loop forever on a poison ticker.
      processed++;
    }
  }

  return NextResponse.json({
    ok: true,
    requestedLimit,
    processed,
    deadlineHit,
    remaining: candidates.length - rows.length, // tickers not picked this round
    staleBefore,
    tickerCount: rows.length,
    universeSize: totalUniverse,
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
