# On-Demand Score Refresh ("Refresh scores now") Implementation Plan

> **Status:** ✅ IMPLEMENTED + SHIPPED 2026-06-12 (prod `a191a12`). All 6 tasks complete; 680 tests green; migration 0012 applied to prod. Remaining: manual Pro end-to-end click-test + FMP-rate spot-check (need a live Pro session). Source spec: `dividendmapper/docs/superpowers/specs/2026-06-12-on-demand-score-refresh-design.md`.
>
> **For agentic workers:** This plan was executed via superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Pro users a "Refresh scores" button on Portfolio Manager and Watchlist that scores their own missing/stale tickers on demand (20 per click), so newly-connected holdings fill in within a minute instead of waiting up to ~24h for the nightly cron.

**Architecture:** Extract the cron's per-ticker scoring body into a shared `lib/scoring/score-ticker.ts` so the new endpoint and the cron run one code path (no drift). Add a Pro-gated `POST /api/portfolio/refresh-scores` that diffs the user's `holdings ∪ tracked_tickers` against `equity_scores.computed_at`, scores up to 20 eligible (missing-first) synchronously via `scoreTicker`, and stamps a per-user cooldown timestamp. A small client button POSTs and calls `router.refresh()`.

**Tech Stack:** Next 16 / React 19 / Tailwind v4, Supabase (RLS user client + service-role admin client), FMP scoring pipeline, vitest + RTL/jsdom, strict TDD.

---

## Context

Scores are produced **only** by the nightly Vercel cron (`/api/internal/refresh-equity-scores`, 22:30 UTC). Until it runs, an unscored ticker renders a soft "Collecting…" placeholder. When a Pro user connects a Trading 212 portfolio or bulk-adds holdings, *every* row sits at "Collecting…" for up to ~24h. This feature lets the user trigger scoring for their own tickers on demand. The hard constraint is FMP cost/limits — scoring one ticker is a ~17-call FMP burst (750/min cap), so the path is capped at 20 tickers/call and paced. Design is fully locked in the spec above; this plan is its TDD execution.

## Repo orientation (confirmed against `main` @ `a2289d5`)

- **Git root:** `C:\Users\grodg\dividend_mapper_plan`. **Next app:** `dividendmapper/` subfolder; all paths below are relative to it. Path alias `@/*` → `./*`.
- **Branch:** Sprint 2 is **merged to `main`** (watchlist `tracked_tickers` + multi-T212 both present). Branch off `main`.
- **Latest migration on disk:** `0011_broker_multi_connection.sql`. **Next = `0012`.**
- **Tests:** `npx vitest run <path>`. **node_modules gotcha:** if vitest fails with "Failed to resolve import", run `npm install` first.
- **AGENTS.md rule:** read `node_modules/next/dist/docs/` before writing Next-specific code (Next 16 patterns may post-date training data).
- **Templates to mirror (read before coding):**
  - Cron route (source of the extraction): `app/api/internal/refresh-equity-scores/route.ts`.
  - Cron test (mock boundary to preserve): `app/api/internal/refresh-equity-scores/__tests__/route.test.ts`.
  - Endpoint pattern (auth + Pro gate + service-role handoff): `app/api/portfolio/broker/sync/route.ts`.
  - Client-button pattern (fetch → status → `router.refresh()`): `app/app/account/_components/broker-connection.tsx`.

## File map

| File | Action | Responsibility |
|---|---|---|
| `lib/scoring/score-ticker.ts` | **create** | Shared `fetchTickerBundle`, `loadPriorHistory`, `topSignalRows`, and `scoreTicker(admin, ticker, calendar, today)` — the per-ticker score+upsert body. |
| `lib/scoring/__tests__/score-ticker.test.ts` | **create** | Unit test: `scoreTicker` upserts all three tables. |
| `app/api/internal/refresh-equity-scores/route.ts` | **modify** | Delete the now-shared locals; import + call `scoreTicker` inside the loop. Behaviour unchanged. |
| `supabase/migrations/0012_profiles_last_score_refresh.sql` | **create** | `profiles.last_score_refresh_at timestamptz` (nullable). |
| `app/api/portfolio/refresh-scores/route.ts` | **create** | Pro-gated POST: gather → diff → cooldown → score ≤20 → stamp. |
| `app/api/portfolio/refresh-scores/__tests__/route.test.ts` | **create** | Endpoint tests (auth/gate/cooldown/cap/ordering/stamp). |
| `app/app/portfolio/_components/refresh-scores-button.tsx` | **create** | Client button: POST + `useTransition` + `router.refresh()`. |
| `app/app/portfolio/_components/__tests__/refresh-scores-button.test.tsx` | **create** | Button render/click/in-flight/next-20/cooldown tests. |
| `app/app/portfolio/scoring/page.tsx` | **modify** | Render the button near the heading. |
| `app/app/portfolio/watchlist/page.tsx` | **modify** | Render the button near the heading. |

---

## Task 1: Extract the shared scoring module (refactor, behaviour-preserving)

**Files:**
- Create: `lib/scoring/score-ticker.ts`
- Test: `lib/scoring/__tests__/score-ticker.test.ts`
- Modify: `app/api/internal/refresh-equity-scores/route.ts`

- [ ] **Step 1: Write the failing test** — `lib/scoring/__tests__/score-ticker.test.ts`

Mirrors the cron test's mock shapes so `assembleScoreInputs`/compute run end-to-end on minimal data. Asserts `scoreTicker` upserts all three tables on the passed-in admin client.

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/scoring/fmp-client", () => {
  const arr = () => vi.fn().mockResolvedValue([]);
  return {
    getProfile: vi.fn().mockResolvedValue([
      { symbol: "TEST", mktCap: 5_000_000_000, industry: "Software - Application", currency: "USD", companyName: "Test Co" },
    ]),
    getRatiosTtm: vi.fn().mockResolvedValue([{ symbol: "TEST", dividendPayoutRatioTTM: 0.4, dividendYieldTTM: 0.03 }]),
    getRatiosQuarterly: arr(),
    getDividends: vi.fn().mockResolvedValue([{ date: "2026-05-01", adjDividend: 0.25, dividend: 0.25 }]),
    getIncomeStatementQuarterly: vi.fn().mockResolvedValue([{ operatingIncome: 250, interestExpense: 50, netIncome: 200 }]),
    getCashFlowStatementQuarterly: vi.fn().mockResolvedValue([{ freeCashFlow: 300, netDividendsPaid: -100 }]),
    getBalanceSheetStatementQuarterly: arr(),
    getKeyMetricsTtm: vi.fn().mockResolvedValue([{ netDebtToEBITDATTM: 1.5 }]),
    getKeyMetricsQuarterly: arr(),
    getAnalystEstimates: vi.fn().mockResolvedValue([{ date: "2027-09-27", epsAvg: 10 }]),
    getDcf: vi.fn().mockResolvedValue([{ symbol: "TEST", dcf: 150, "Stock Price": 120 }]),
    getSma: vi.fn().mockResolvedValue([{ date: "2026-05-29", close: 130, high: 131, low: 129, sma: 110 }]),
    getRsi: vi.fn().mockResolvedValue([{ date: "2026-05-29", close: 130, high: 131, low: 129, rsi: 65 }]),
    getHistoricalEod: vi.fn().mockResolvedValue([{ symbol: "TEST", date: "2026-05-29", close: 130, high: 131, low: 129 }]),
    getPriceTargetConsensus: vi.fn().mockResolvedValue([{ symbol: "TEST", targetMedian: 155 }]),
    getGradesHistorical: arr(),
    getInsiderTrades: arr(),
    // getDividendsCalendar is NOT called by scoreTicker (calendar is passed in),
    // but the route module imports it — keep a stub so the import resolves.
    getDividendsCalendar: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { scoreTicker } from "@/lib/scoring/score-ticker";

function makeAdmin() {
  const upserts: Record<string, unknown[]> = {};
  const chain = (table: string) => ({
    select: vi.fn(() => chain(table)),
    eq: vi.fn(() => chain(table)),
    order: vi.fn(() => chain(table)),
    limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    upsert: vi.fn((rows: unknown) => {
      upserts[table] = (upserts[table] ?? []).concat(rows as unknown[]);
      return Promise.resolve({ error: null });
    }),
  });
  return {
    upserts,
    client: { from: vi.fn((table: string) => chain(table)) } as unknown as import("@supabase/supabase-js").SupabaseClient,
  };
}

describe("scoreTicker", () => {
  it("upserts equity_scores, equity_score_history and equity_score_signals", async () => {
    const { client, upserts } = makeAdmin();
    await scoreTicker(client, "TEST", [], "2026-06-12");
    expect(upserts["equity_scores"]).toBeDefined();
    expect((upserts["equity_scores"][0] as { ticker: string }).ticker).toBe("TEST");
    expect(upserts["equity_score_history"]).toBeDefined();
    expect(upserts["equity_score_signals"]).toBeDefined();
    expect((upserts["equity_score_signals"] as unknown[]).length).toBeGreaterThan(0);
  });

  it("throws when an upsert returns an error (so the caller can count it)", async () => {
    const { client } = makeAdmin();
    (client.from as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      upsert: vi.fn(() => Promise.resolve({ error: { message: "boom" } })),
      select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(),
    }));
    await expect(scoreTicker(client, "TEST", [], "2026-06-12")).rejects.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/scoring/__tests__/score-ticker.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/scoring/score-ticker"` (module doesn't exist yet).

- [ ] **Step 3: Create `lib/scoring/score-ticker.ts`**

Move `fetchTickerBundle` (route ~L63–149), `loadPriorHistory` (~L153–186), `topSignalRows` (~L188–210), the `isoDateOffset` helper, and the per-ticker score+upsert body (~L264–336) **verbatim**, parameterised on a passed-in `admin` client. Note: `loadPriorHistory` and the upserts use `admin` (was the route's service-role `supabase`).

```ts
// Shared per-ticker scoring path. Used by BOTH the nightly cron
// (app/api/internal/refresh-equity-scores) and the on-demand refresh endpoint
// (app/api/portfolio/refresh-scores) so the two never drift. Imports FMP via
// @/lib/scoring/fmp-client so existing route tests' mock boundary still applies.

import { type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import {
  getProfile, getRatiosTtm, getRatiosQuarterly, getDividends,
  getIncomeStatementQuarterly, getCashFlowStatementQuarterly,
  getBalanceSheetStatementQuarterly, getKeyMetricsTtm, getKeyMetricsQuarterly,
  getAnalystEstimates, getDcf, getSma, getRsi, getHistoricalEod,
  getPriceTargetConsensus, getGradesHistorical, getInsiderTrades,
  type FmpCalendarDividend,
} from "@/lib/scoring/fmp-client";
import { assembleScoreInputs, type RawFmpBundle, type PriorHistory } from "@/lib/scoring/assemble-inputs";
import { computeBuyScore, type SignalRecord } from "@/lib/scoring/compute-buy-score";
import { computeTrimScore } from "@/lib/scoring/compute-trim-score";
import { computeRiskScore } from "@/lib/scoring/compute-risk-score";
import { runWithConcurrency } from "@/lib/concurrency";
import { nextUpcomingDividend } from "@/lib/scoring/next-dividend";

const FMP_CONCURRENCY = Number(process.env.FMP_CONCURRENCY) || 5;

export function isoDateOffset(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

export async function fetchTickerBundle(
  symbol: string,
  calendar: FmpCalendarDividend[],
): Promise<RawFmpBundle> {
  // ↓↓↓ MOVE the body verbatim from route.ts lines 67–148 (from5y/today through the
  // runWithConcurrency([...], FMP_CONCURRENCY) cast and the returned object). ↓↓↓
}

export async function loadPriorHistory(admin: SupabaseClient, ticker: string): Promise<PriorHistory> {
  // ↓↓↓ MOVE the body verbatim from route.ts lines 154–186 (rename param supabase→admin). ↓↓↓
}

export function topSignalRows(
  ticker: string,
  scoreType: "buy" | "trim" | "risk",
  signals: SignalRecord[],
  observedAt: string,
) {
  // ↓↓↓ MOVE the body verbatim from route.ts lines 194–209. ↓↓↓
}

// Score ONE ticker and persist it. Throws on a hard error so the caller can
// count + Sentry-capture per ticker without aborting a batch.
export async function scoreTicker(
  admin: SupabaseClient,
  ticker: string,
  calendar: FmpCalendarDividend[],
  today: string,
): Promise<void> {
  const bundle = await fetchTickerBundle(ticker, calendar);
  const history = await loadPriorHistory(admin, ticker);
  const assembled = assembleScoreInputs(ticker, bundle, history);

  const buy = computeBuyScore(assembled.buy);
  const trim = computeTrimScore(assembled.trim);
  const risk = computeRiskScore(assembled.risk);

  const dataQuality = assembled.meta.dataQualityUk
    ? "degraded_uk"
    : risk.dataQuality === "sparse"
      ? "sparse"
      : "full";

  const nextDiv = nextUpcomingDividend(calendar, ticker, today);

  const { error: scoresErr } = await admin.from("equity_scores").upsert(
    {
      ticker,
      name: bundle.profile[0]?.companyName ?? null,
      buy_score: buy.score,
      buy_quality_gate_passed: buy.qualityGatePassed,
      buy_failed_gates: buy.failedGates,
      trim_score: trim.score,
      risk_score: risk.score,
      ticker_market: assembled.meta.isUs ? "US" : "LSE",
      data_quality: dataQuality,
      next_ex_div_date: nextDiv?.date ?? null,
      next_ex_div_amount: nextDiv?.dividend ?? null,
      next_ex_div_pay_date:
        typeof nextDiv?.paymentDate === "string" && nextDiv.paymentDate !== ""
          ? nextDiv.paymentDate
          : null,
      computed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ticker" },
  );
  if (scoresErr) throw scoresErr;

  const { error: histErr } = await admin.from("equity_score_history").upsert(
    {
      ticker,
      observed_at: today,
      buy_score: buy.score,
      trim_score: trim.score,
      risk_score: risk.score,
      current_price: assembled.buy.b1.currentPrice || null,
      current_yield: assembled.buy.a1.todayYield || null,
      dividend_per_share: assembled.dividendPerShareTtm || null,
      eps_avg: assembled.risk.r4.currentEpsAvg || null,
      net_debt_to_ebitda: assembled.risk.r5.currentNetDebtToEbitda || null,
      interest_coverage: assembled.risk.r6.currentInterestCoverage || null,
    },
    { onConflict: "ticker,observed_at" },
  );
  if (histErr) throw histErr;

  const signalRows = [
    ...topSignalRows(ticker, "buy", buy.signals, today),
    ...topSignalRows(ticker, "trim", trim.signals, today),
    ...topSignalRows(ticker, "risk", risk.signals, today),
  ];
  if (signalRows.length) {
    const { error: sigErr } = await admin
      .from("equity_score_signals")
      .upsert(signalRows, { onConflict: "ticker,score_type,signal_code,observed_at" });
    if (sigErr) throw sigErr;
  }
}
```

> Note: `Sentry` is imported only if you keep the Sentry capture inside `loadPriorHistory` (the cron's version does — keep it). `FMP_CONCURRENCY` is used by `fetchTickerBundle`.

- [ ] **Step 4: Run the new test to verify it passes**

Run: `npx vitest run lib/scoring/__tests__/score-ticker.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Refactor the cron route to use the shared module**

In `app/api/internal/refresh-equity-scores/route.ts`:
- **Delete** the local `fetchTickerBundle`, `loadPriorHistory`, `topSignalRows`, `isoDateOffset` and the now-unused FMP `get*` imports + `runWithConcurrency`, `assembleScoreInputs`, `computeBuyScore/Trim/Risk`, `SignalRecord`, `nextUpcomingDividend`, `RawFmpBundle`, `PriorHistory`. **Keep** `getDividendsCalendar` + `FmpCalendarDividend` (still used for the one calendar pull), `createClient`, `Sentry`, `NextResponse`.
- Add: `import { scoreTicker, isoDateOffset } from "@/lib/scoring/score-ticker";`
- Replace the per-ticker `try { … }` body (lines ~264–338, fetch→assemble→compute→upsert×3→`successfulTickerCount++`) with:

```ts
    try {
      await scoreTicker(supabase, ticker, calendar, today);
      successfulTickerCount++;
    } catch (err) {
      failedTickerCount++;
      console.error(`[refresh-equity-scores] ticker ${ticker} failed`, err);
      Sentry.captureException(err, { extra: { ticker } });
    }
```
- Keep `TICKER_PAD_MS`/`sleep`/the `getDividendsCalendar` pull/auth/the `holdings ∪ tracked_tickers` query/the JSON response exactly as-is.

- [ ] **Step 6: Run the cron tests to verify behaviour is unchanged**

Run: `npx vitest run app/api/internal/refresh-equity-scores/__tests__/route.test.ts`
Expected: PASS unchanged (this proves the extraction preserved behaviour). If it fails on a missing import, run `npm install` then re-run.

- [ ] **Step 7: Typecheck + commit**

```bash
npx tsc --noEmit
git add lib/scoring/score-ticker.ts lib/scoring/__tests__/score-ticker.test.ts app/api/internal/refresh-equity-scores/route.ts
git commit -m "refactor(scoring): extract shared scoreTicker from cron route"
```

---

## Task 2: Migration 0012 — `profiles.last_score_refresh_at`

**Files:**
- Create: `supabase/migrations/0012_profiles_last_score_refresh.sql`

- [ ] **Step 1: Write the migration**

```sql
-- On-demand score refresh: anchors the per-user 15-min cooldown. Nullable, no
-- backfill — a null value means "never refreshed", which always passes the gate.
alter table public.profiles
  add column if not exists last_score_refresh_at timestamptz;
```

- [ ] **Step 2: Dry-run (do NOT apply — applying to prod is Glenn's explicit call)**

Run (from `dividendmapper/`):
```bash
set -a && source .env.local && set +a && npx supabase db push --dry-run --linked
```
Expected: the diff lists only the new `0012` column add, nothing else.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0012_profiles_last_score_refresh.sql
git commit -m "feat(db): migration 0012 profiles.last_score_refresh_at"
```

> Glenn applies with `… npx supabase db push --linked --yes` when he gives the go (see Verification).

---

## Task 3: The on-demand endpoint

**Files:**
- Create: `app/api/portfolio/refresh-scores/route.ts`
- Test: `app/api/portfolio/refresh-scores/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

`app/api/portfolio/refresh-scores/__tests__/route.test.ts`. Mocks `@/lib/supabase/server` (user client → claims + reads), `@supabase/supabase-js` `createClient` (admin), `@/lib/scoring/score-ticker` (`scoreTicker` spy — we don't re-test scoring here), and `@/lib/scoring/fmp-client` `getDividendsCalendar`.

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const scoreTicker = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/scoring/score-ticker", () => ({
  scoreTicker: (...a: unknown[]) => scoreTicker(...a),
  isoDateOffset: (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10),
}));
vi.mock("@/lib/scoring/fmp-client", () => ({ getDividendsCalendar: vi.fn().mockResolvedValue([]) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const adminUpdate = vi.fn().mockResolvedValue({ error: null });
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: vi.fn(() => ({ update: vi.fn(() => ({ eq: adminUpdate })) })),
  }),
}));

// Configurable per-test fixtures for the RLS user client.
let tier: "free" | "pro" | "premium" = "pro";
let lastRefresh: string | null = null;
let holdings: { ticker: string }[] = [];
let tracked: { ticker: string }[] = [];
let scores: { ticker: string; computed_at: string }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "user-1" } } }) },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { tier, last_score_refresh_at: lastRefresh } }) }) }) };
      }
      if (table === "holdings") {
        return { select: () => ({ is: async () => ({ data: holdings, error: null }) }) };
      }
      if (table === "tracked_tickers") {
        return { select: async () => ({ data: tracked, error: null }) };
      }
      if (table === "equity_scores") {
        return { select: () => ({ in: async () => ({ data: scores, error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { POST } from "../route";

function req() {
  return new Request("http://localhost/api/portfolio/refresh-scores", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  tier = "pro"; lastRefresh = null; holdings = []; tracked = []; scores = [];
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc"; process.env.NEXT_PUBLIC_SUPABASE_URL = "http://sb";
  process.env.NODE_ENV = "test";
});

describe("POST /api/portfolio/refresh-scores", () => {
  it("403 for free tier", async () => {
    tier = "free"; holdings = [{ ticker: "AAPL.US" }];
    const res = await POST(req());
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("pro_required");
    expect(scoreTicker).not.toHaveBeenCalled();
  });

  it("scores missing tickers and stamps last_score_refresh_at", async () => {
    holdings = [{ ticker: "AAPL.US" }, { ticker: "MSFT.US" }];
    scores = []; // both missing
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scored).toBe(2);
    expect(body.remaining).toBe(0);
    expect(scoreTicker).toHaveBeenCalledTimes(2);
    expect(adminUpdate).toHaveBeenCalled(); // timestamp stamped
  });

  it("selects stale (>24h) and skips fresh (<24h)", async () => {
    holdings = [{ ticker: "AAPL.US" }, { ticker: "MSFT.US" }];
    const old = new Date(Date.now() - 25 * 3600_000).toISOString();
    const fresh = new Date(Date.now() - 1 * 3600_000).toISOString();
    scores = [{ ticker: "AAPL.US", computed_at: old }, { ticker: "MSFT.US", computed_at: fresh }];
    const res = await POST(req());
    const body = await res.json();
    expect(body.scored).toBe(1);
    expect(scoreTicker).toHaveBeenCalledWith(expect.anything(), "AAPL.US", expect.anything(), expect.anything());
  });

  it("caps at 20 and reports remaining", async () => {
    holdings = Array.from({ length: 25 }, (_, i) => ({ ticker: `T${i}.US` }));
    scores = [];
    const res = await POST(req());
    const body = await res.json();
    expect(body.scored).toBe(20);
    expect(body.remaining).toBe(5);
    expect(scoreTicker).toHaveBeenCalledTimes(20);
  });

  it("orders missing-first before stale", async () => {
    holdings = [{ ticker: "STALE.US" }, { ticker: "MISS.US" }];
    const old = new Date(Date.now() - 25 * 3600_000).toISOString();
    scores = [{ ticker: "STALE.US", computed_at: old }];
    await POST(req());
    expect(scoreTicker.mock.calls[0][1]).toBe("MISS.US");
    expect(scoreTicker.mock.calls[1][1]).toBe("STALE.US");
  });

  it("429 cooldown when nothing missing and within 15min", async () => {
    holdings = [{ ticker: "AAPL.US" }];
    scores = [{ ticker: "AAPL.US", computed_at: new Date().toISOString() }]; // fresh → no missing, no stale
    lastRefresh = new Date(Date.now() - 5 * 60_000).toISOString();
    const res = await POST(req());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("cooldown");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(scoreTicker).not.toHaveBeenCalled();
  });

  it("cooldown is bypassed when there are missing tickers", async () => {
    holdings = [{ ticker: "AAPL.US" }];
    scores = []; // missing
    lastRefresh = new Date(Date.now() - 1 * 60_000).toISOString(); // within 15min
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(scoreTicker).toHaveBeenCalledTimes(1);
  });

  it("upToDate when nothing eligible and no cooldown active", async () => {
    holdings = [{ ticker: "AAPL.US" }];
    scores = [{ ticker: "AAPL.US", computed_at: new Date().toISOString() }];
    lastRefresh = new Date(Date.now() - 60 * 60_000).toISOString(); // > 15min ago
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ scored: 0, remaining: 0, upToDate: true });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/api/portfolio/refresh-scores/__tests__/route.test.ts`
Expected: FAIL — `Failed to resolve import "../route"`.

- [ ] **Step 3: Implement the endpoint** — `app/api/portfolio/refresh-scores/route.ts`

```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDividendsCalendar } from "@/lib/scoring/fmp-client";
import { scoreTicker, isoDateOffset } from "@/lib/scoring/score-ticker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// On-demand "Refresh scores now". Pro-gated. Scores the user's own missing/stale
// tickers (holdings ∪ watchlist) so newly-added rows fill in without waiting for
// the nightly cron. Capped at 20/call (~340 FMP calls) and paced; shares the
// scoreTicker path with the cron. See docs/.../on-demand-score-refresh-design.md.

const BATCH_CAP = 20;
const STALE_MS = 24 * 3600_000;
const COOLDOWN_MS = 15 * 60_000;
const TICKER_PAD_MS =
  process.env.NODE_ENV === "test" ? 0 : Number(process.env.FMP_TICKER_PAD_MS) || 1000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, last_score_refresh_at")
    .eq("id", userId)
    .maybeSingle<{ tier: "free" | "pro" | "premium"; last_score_refresh_at: string | null }>();
  const tier = profile?.tier ?? "free";
  if (tier === "free") {
    return NextResponse.json(
      { code: "pro_required", message: "On-demand refresh is a Pro feature" },
      { status: 403 },
    );
  }

  // Gather the user's tickers (RLS-scoped). Active holdings only + the watchlist.
  const [holdingsRes, trackedRes] = await Promise.all([
    supabase.from("holdings").select("ticker").is("archived_at", null),
    supabase.from("tracked_tickers").select("ticker"),
  ]);
  if (holdingsRes.error || trackedRes.error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const allTickers = Array.from(
    new Set([...(holdingsRes.data ?? []), ...(trackedRes.data ?? [])].map((r) => r.ticker)),
  );

  if (allTickers.length === 0) {
    return NextResponse.json({ scored: 0, remaining: 0, upToDate: true });
  }

  // One set-based lookup of existing scores for those tickers.
  const { data: scoreRows, error: scoresErr } = await supabase
    .from("equity_scores")
    .select("ticker, computed_at")
    .in("ticker", allTickers);
  if (scoresErr) return NextResponse.json({ error: "query_failed" }, { status: 500 });

  const computedAt = new Map<string, string | null>(
    (scoreRows ?? []).map((r) => [r.ticker as string, r.computed_at as string | null]),
  );
  const now = Date.now();
  const missing = allTickers.filter((t) => !computedAt.has(t));
  const stale = allTickers.filter((t) => {
    const c = computedAt.get(t);
    return c != null && now - new Date(c).getTime() > STALE_MS;
  });

  // Cooldown only engages once nothing is MISSING (missing always bypasses it).
  if (missing.length === 0) {
    const last = profile?.last_score_refresh_at ? new Date(profile.last_score_refresh_at).getTime() : 0;
    if (now - last < COOLDOWN_MS && stale.length > 0) {
      const retryAfterSeconds = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
      return NextResponse.json({ code: "cooldown", retryAfterSeconds }, { status: 429 });
    }
  }

  const eligible = [...missing, ...stale]; // missing-first
  if (eligible.length === 0) {
    return NextResponse.json({ scored: 0, remaining: 0, upToDate: true });
  }

  const batch = eligible.slice(0, BATCH_CAP);
  const remaining = Math.max(0, eligible.length - batch.length);

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const today = isoDateOffset(0);
  let calendar: Awaited<ReturnType<typeof getDividendsCalendar>> = [];
  try {
    calendar = await getDividendsCalendar(today, isoDateOffset(90));
  } catch {
    // Calendar is best-effort metadata; scoring proceeds without it.
  }

  let scored = 0;
  let failed = 0;
  for (let i = 0; i < batch.length; i++) {
    if (i > 0 && TICKER_PAD_MS > 0) await sleep(TICKER_PAD_MS);
    try {
      await scoreTicker(admin, batch[i], calendar, today);
      scored++;
    } catch (err) {
      failed++;
      console.error(`[refresh-scores] ticker ${batch[i]} failed`, err);
    }
  }

  // Service-role stamp (don't assume the user can update their own profiles row).
  await admin.from("profiles").update({ last_score_refresh_at: new Date().toISOString() }).eq("id", userId);

  return NextResponse.json({ scored, failed, remaining });
}
```

> Sentry: add `import * as Sentry from "@sentry/nextjs";` and `Sentry.captureException(err, { extra: { ticker: batch[i] } });` inside the per-ticker catch to mirror the cron (the test already mocks `@sentry/nextjs`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/api/portfolio/refresh-scores/__tests__/route.test.ts`
Expected: PASS (all cases). If a `.from()` chain mock mismatches the real query shape, align the test mock to the query (e.g. `holdings` uses `.select().is()`, `equity_scores` uses `.select().in()`).

- [ ] **Step 5: Commit**

```bash
git add app/api/portfolio/refresh-scores/
git commit -m "feat(scoring): on-demand refresh-scores endpoint (Pro, 20/batch, cooldown)"
```

---

## Task 4: The `<RefreshScoresButton />` client component

**Files:**
- Create: `app/app/portfolio/_components/refresh-scores-button.tsx`
- Test: `app/app/portfolio/_components/__tests__/refresh-scores-button.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { RefreshScoresButton } from "../refresh-scores-button";

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("RefreshScoresButton", () => {
  it("renders the idle label", () => {
    render(<RefreshScoresButton />);
    expect(screen.getByRole("button", { name: /refresh scores/i })).toBeInTheDocument();
  });

  it("POSTs on click and refreshes on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ scored: 3, failed: 0, remaining: 0 }), { status: 200 }),
    );
    render(<RefreshScoresButton />);
    await userEvent.click(screen.getByRole("button", { name: /refresh scores/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/portfolio/refresh-scores",
      expect.objectContaining({ method: "POST" }),
    ));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(await screen.findByText(/up to date/i)).toBeInTheDocument();
  });

  it("offers 'next 20' when remaining > 0", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ scored: 20, failed: 0, remaining: 5 }), { status: 200 }),
    );
    render(<RefreshScoresButton />);
    await userEvent.click(screen.getByRole("button", { name: /refresh scores/i }));
    expect(await screen.findByText(/next 20/i)).toBeInTheDocument();
  });

  it("shows a cooldown message on 429", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "cooldown", retryAfterSeconds: 600 }), { status: 429 }),
    );
    render(<RefreshScoresButton />);
    await userEvent.click(screen.getByRole("button", { name: /refresh scores/i }));
    expect(await screen.findByText(/try again/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/app/portfolio/_components/__tests__/refresh-scores-button.test.tsx`
Expected: FAIL — cannot resolve `../refresh-scores-button`.

- [ ] **Step 3: Implement the component**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Pro button on Portfolio Manager + Watchlist. POSTs to the on-demand refresh
// endpoint, which scores up to 20 of the user's missing/stale tickers, then
// router.refresh() repaints the score chips. Disabled in-flight; surfaces the
// 429 cooldown and a "next 20" prompt when more than a batch is eligible.

type Result =
  | { kind: "idle" }
  | { kind: "done"; scored: number; failed: number; remaining: number }
  | { kind: "cooldown"; minutes: number }
  | { kind: "error" };

export function RefreshScoresButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>({ kind: "idle" });

  async function run() {
    setBusy(true);
    setResult({ kind: "idle" });
    try {
      const res = await fetch("/api/portfolio/refresh-scores", { method: "POST" });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setResult({ kind: "cooldown", minutes: Math.ceil((body.retryAfterSeconds ?? 900) / 60) });
        return;
      }
      if (!res.ok) {
        setResult({ kind: "error" });
        return;
      }
      const body = (await res.json()) as { scored: number; failed: number; remaining: number };
      setResult({ kind: "done", scored: body.scored, failed: body.failed, remaining: body.remaining });
      startTransition(() => router.refresh());
    } catch {
      setResult({ kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  const inFlight = busy || pending;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={inFlight}
        className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {inFlight
          ? "Scoring…"
          : result.kind === "done" && result.remaining > 0
            ? "Score the next 20"
            : "Refresh scores"}
      </button>
      {result.kind === "done" && result.remaining === 0 && (
        <span className="text-xs text-muted-foreground">Scores up to date</span>
      )}
      {result.kind === "done" && result.remaining > 0 && (
        <span className="text-xs text-muted-foreground">
          Scored {result.scored}. {result.remaining} more to go.
        </span>
      )}
      {result.kind === "cooldown" && (
        <span className="text-xs text-muted-foreground">Try again in ~{result.minutes} min</span>
      )}
      {result.kind === "error" && (
        <span className="text-xs text-rose-600 dark:text-rose-400">Couldn&apos;t refresh. Try again.</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run app/app/portfolio/_components/__tests__/refresh-scores-button.test.tsx`
Expected: PASS (all four cases).

- [ ] **Step 5: Commit**

```bash
git add app/app/portfolio/_components/refresh-scores-button.tsx app/app/portfolio/_components/__tests__/refresh-scores-button.test.tsx
git commit -m "feat(scoring): RefreshScoresButton client component"
```

---

## Task 5: Wire the button into both pages

**Files:**
- Modify: `app/app/portfolio/scoring/page.tsx`
- Modify: `app/app/portfolio/watchlist/page.tsx`

Both pages already redirect Free users away, so the button is implicitly Pro-only there; the endpoint enforces it server-side regardless.

- [ ] **Step 1: Portfolio Manager** — add the import and render the button in the heading block.

In `app/app/portfolio/scoring/page.tsx`, add to the imports:
```tsx
import { RefreshScoresButton } from "../_components/refresh-scores-button";
```
Replace the heading `<div>` (lines ~68–76) so the button sits to the right of the title:
```tsx
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Portfolio Manager
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Quality, Trim and Risk across your holdings. Signals are a resilience
            check, not a buy recommendation. Not financial advice.
          </p>
        </div>
        <RefreshScoresButton />
      </div>
```

- [ ] **Step 2: Watchlist** — same treatment in `app/app/portfolio/watchlist/page.tsx`.

Add import:
```tsx
import { RefreshScoresButton } from "../_components/refresh-scores-button";
```
Replace the heading `<div>` (lines ~63–72):
```tsx
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Watchlist
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Track tickers you don&apos;t own yet. They&apos;re scored in the nightly update alongside
            your holdings. Signals are a resilience check, not a buy recommendation. Not financial
            advice.
          </p>
        </div>
        <RefreshScoresButton />
      </div>
```

- [ ] **Step 3: Typecheck + lint the changed files**

Run:
```bash
npx tsc --noEmit
npx eslint app/app/portfolio/scoring/page.tsx app/app/portfolio/watchlist/page.tsx app/app/portfolio/_components/refresh-scores-button.tsx app/api/portfolio/refresh-scores/route.ts lib/scoring/score-ticker.ts
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/app/portfolio/scoring/page.tsx app/app/portfolio/watchlist/page.tsx
git commit -m "feat(scoring): surface RefreshScoresButton on Portfolio Manager + Watchlist"
```

---

## Task 6: Full verification

- [ ] **Step 1: Whole suite green**

Run: `npx vitest run`
Expected: all pass, including the **unchanged** cron tests (proves the refactor preserved behaviour).

- [ ] **Step 2: Typecheck + build**

Run:
```bash
npx tsc --noEmit
npm run build
```
Expected: clean.

- [ ] **Step 3: Apply migration 0012 (Glenn's explicit go)**

From `dividendmapper/`:
```bash
set -a && source .env.local && set +a && npx supabase db push --linked --yes
```
Then confirm: `npx supabase db query --linked "select column_name from information_schema.columns where table_name='profiles' and column_name='last_score_refresh_at';"`

- [ ] **Step 4: Manual end-to-end (local dev, as a Pro user)**

  1. Add ~3 tickers with no score (e.g. via the Ledger / Watchlist) → they show **"Collecting…"**.
  2. Visit `/app/portfolio/scoring` → click **Refresh scores** → button shows "Scoring…", disabled → on return, chips populate and "Scores up to date" appears.
  3. Click again immediately → "Scores up to date", **no FMP burst** (24h skip).
  4. Add 25 unscored tickers → click → "Scored 20. 5 more to go." and the button reads "Score the next 20"; click again (cooldown bypassed by missing) → remaining clears.
  5. Confirm a Free user gets no button (page redirects) and a direct `POST /api/portfolio/refresh-scores` returns 403.
  6. Repeat step 2 on `/app/portfolio/watchlist`.

- [ ] **Step 5: FMP sanity** — watch the dev server log during a 20-ticker batch; confirm the ~30–40s span keeps sustained FMP rate under 750/min (17 calls × 20 tickers = 340 over ~30s).

---

## Self-review checklist (run before handing off)

- **Spec coverage:** shared module §5.1 → Task 1; endpoint §5.2 → Task 3; migration §5.3 → Task 2; button §5.4 → Tasks 4–5; testing plan §8 → Tasks 1/3/4 + cron-stay-green; verification §9 → Task 6. ✅
- **Type consistency:** `scoreTicker(admin, ticker, calendar, today)` signature identical in Task 1 (definition), Task 3 (caller), and both test specs. `isoDateOffset` exported once from `score-ticker.ts`, imported by route. Response shape `{ scored, failed, remaining }` / `{ scored:0, remaining:0, upToDate:true }` / `{ code:"cooldown", retryAfterSeconds }` consistent between endpoint and button tests. ✅
- **Mock boundary:** new module + endpoint both import FMP via `@/lib/scoring/fmp-client`, so the cron test's existing mock still covers them. ✅

## Risks / watch-items

- **Refactor regression** is the main risk — Task 1 Step 6 (cron tests unchanged) is the guard. Move the inlined helpers *verbatim*; don't "improve" them.
- **Test mock shape drift** — the endpoint's query builder calls (`.is()`, `.in()`, `.maybeSingle()`) must match the mock chains in the test. If a test fails on `x is not a function`, align the mock to the actual query, not the route to the mock.
- **`profiles` RLS** — the timestamp stamp uses the **service-role** admin client deliberately (Task 3); do not switch it to the user client.
- **node_modules staleness** after branch switch — run `npm install` if vitest can't resolve an import.
