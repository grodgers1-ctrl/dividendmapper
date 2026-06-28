import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { normalizeTicker } from "@/lib/scoring/load-score";
import { loadInspectBundle } from "@/lib/inspect/load-inspect-bundle";
import { readCachedBundle } from "@/lib/inspect/read-cached-bundle";
import {
  checkInspectRateLimit,
  recordInspectLookup,
  type Tier,
} from "@/lib/inspect/inspect-rate-limit";
import { attachPercentileBand } from "@/lib/inspect/percentile-bands";
import { synthesiseVerdicts } from "@/lib/inspect/synthesise-verdicts";
import { getCurrentUserAndTier } from "@/lib/inspect/get-current-user";
import type {
  CachedMonthlyRow,
  CachedQuarterlyRow,
  InspectBundle,
} from "@/lib/inspect/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public read for one ticker's Inspect bundle: cached quarterly + monthly
 * series, current snapshot, percentile bands (per metric, over its own
 * history), and the four short verdict strings.
 *
 *   GET /api/inspect/[ticker]
 *
 * Tier-aware rate limit (anon 3/day, free 10/day, pro unlimited) — see
 * lib/inspect/inspect-rate-limit.ts. Cache miss falls through to FMP via
 * loadInspectBundle, which also persists the rows to ticker_inspect_*.
 */

function ipHashFrom(req: NextRequest): string {
  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

function bandFor(
  rows: Array<{ observed_at: string; [k: string]: unknown }>,
  key: string,
): number | null {
  if (!rows.length) return null;
  const points = rows.map((r) => ({
    at: r.observed_at,
    raw: (r[key] as number | null | undefined) ?? null,
  }));
  return attachPercentileBand(points)[0]?.percentile ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: raw } = await params;
  const ticker = normalizeTicker(raw);
  if (!ticker) {
    return NextResponse.json({ error: "invalid_ticker" }, { status: 400 });
  }

  const { user, tier } = await getCurrentUserAndTier();
  const tierKey: Tier = !user
    ? "anon"
    : tier === "pro" || tier === "premium"
      ? "pro"
      : "free";
  const ipHash = ipHashFrom(req);

  const rl = await checkInspectRateLimit({
    tier: tierKey,
    ipHash,
    userId: user?.id ?? null,
  });
  if (!rl.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000),
    );
    return NextResponse.json(
      { status: "rate_limited", tier: tierKey },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Reset": rl.resetAt.toISOString(),
        },
      },
    );
  }

  const cached = await readCachedBundle(ticker);
  let bundle: InspectBundle | null = cached;
  const cacheHit = !!cached;

  if (!bundle) {
    const loaded = await loadInspectBundle(ticker);
    if (loaded.status === "uncoverable") {
      await recordInspectLookup({
        ipHash,
        userId: user?.id ?? null,
        ticker,
        cacheHit: false,
      });
      return NextResponse.json({ status: "uncoverable" }, { status: 404 });
    }
    bundle = loaded.bundle;
  }

  await recordInspectLookup({
    ipHash,
    userId: user?.id ?? null,
    ticker,
    cacheHit,
  });

  const q0: Partial<CachedQuarterlyRow> = bundle.quarterly[0] ?? {};
  const m0: Partial<CachedMonthlyRow> = bundle.monthly[0] ?? {};

  const current = {
    pe: q0.pe ?? null,
    p_fcf: q0.p_fcf ?? null,
    dividend_yield: m0.dividend_yield ?? null,
    fcf_payout: q0.fcf_payout ?? null,
    net_debt_ebitda: q0.net_debt_ebitda ?? null,
    interest_coverage: q0.interest_coverage ?? null,
    dgr_5y: m0.dgr_5y ?? null,
    fcf_growth_yoy: q0.fcf_growth_yoy ?? null,
    roic: q0.roic ?? null,
    gross_margin: q0.gross_margin ?? null,
    operating_margin: q0.operating_margin ?? null,
    net_margin: q0.net_margin ?? null,
  };

  const percentiles = {
    pe: bandFor(bundle.quarterly, "pe"),
    p_fcf: bandFor(bundle.quarterly, "p_fcf"),
    dividend_yield: bandFor(bundle.monthly, "dividend_yield"),
    fcf_payout: bandFor(bundle.quarterly, "fcf_payout"),
    net_debt_ebitda: bandFor(bundle.quarterly, "net_debt_ebitda"),
    interest_coverage: bandFor(bundle.quarterly, "interest_coverage"),
    dgr_5y: bandFor(bundle.monthly, "dgr_5y"),
    fcf_growth_yoy: bandFor(bundle.quarterly, "fcf_growth_yoy"),
    roic: bandFor(bundle.quarterly, "roic"),
    gross_margin: bandFor(bundle.quarterly, "gross_margin"),
    operating_margin: bandFor(bundle.quarterly, "operating_margin"),
    net_margin: bandFor(bundle.quarterly, "net_margin"),
  };

  const verdicts = synthesiseVerdicts({ ticker, current, percentiles });

  return NextResponse.json(
    {
      status: "ok",
      ticker,
      bundle,
      current,
      percentiles,
      verdicts,
      rangeYears: {
        quarterly: bundle.rangeYearsQuarterly,
        monthly: bundle.rangeYearsMonthly,
      },
    },
    {
      headers: {
        "X-RateLimit-Remaining":
          rl.remaining === Infinity ? "unlimited" : String(rl.remaining),
      },
    },
  );
}
