# On-demand score refresh ("Refresh scores now") — design spec

**Date:** 2026-06-12
**Status:** Approved design, ready for implementation plan
**Author:** Glenn + Claude (brainstormed 2026-06-12)

> This spec is written to be picked up cold in a fresh session. It assumes no
> memory of the brainstorming conversation. Read the "Repo orientation" and
> "Existing scoring pipeline" sections before writing any code.

---

## 1. Context — the problem

DividendMapper scores every user's equity holdings (and watchlist tickers) for
Quality (a.k.a. Buy), Trim, and Risk. Scores are produced **only** by a nightly
Vercel cron (`/api/internal/refresh-equity-scores`, fires 22:30 UTC). Until that
cron runs, a ticker with no score row renders a soft **"Collecting…"** placeholder
in the UI.

The pain: when a Pro user connects a Trading 212 portfolio (or adds 20 holdings),
**all** of those holdings sit at "Collecting…" until the next nightly run — up to
~24h. We want to let the user **trigger scoring on demand** for their own tickers
and fill those scores in within a minute, without waiting for the cron.

This is a Pro feature. The hard constraint is **FMP API cost / rate limits** (see
§4): scoring one ticker is a ~17-call FMP burst, so an on-demand path must be
capped and paced.

---

## 2. Repo orientation (read first)

- **Git root:** `C:\Users\grodg\dividend_mapper_plan` (this is where `git` runs).
- **Next.js app:** lives in the `dividendmapper/` subfolder. All paths below are
  relative to `dividendmapper/` unless noted. The app is **Next 16 / React 19 /
  Tailwind v4** — per `dividendmapper/AGENTS.md`, read `node_modules/next/dist/docs/`
  before writing Next-specific code; patterns may post-date training data.
- **Branch:** this work builds on top of the Phase 3.5 Sprint 2 work. At spec time
  the relevant branch is `phase-3.5-sprint2` (commits `bb64c38` watchlist +
  `2c43f90` multi-T212, not yet merged to `main`). **Confirm the current branch /
  base when starting** — if Sprint 2 has merged, branch off `main`; otherwise
  branch off `phase-3.5-sprint2` so `tracked_tickers`/watchlist exist.
- **node_modules gotcha:** switching branches in-place can leave `node_modules`
  stale (missing deps like `framer-motion`), which breaks vitest with
  "Failed to resolve import". If tests fail to load a module, run `npm install`
  first (it syncs to the lockfile without changing `package.json`).
- **Tests:** vitest. `npx vitest run <path>`. Component tests use RTL + jsdom.
  Repo convention is **strict TDD** (test first, watch it fail, then implement).
- **Supabase CLI** (for the migration): from `dividendmapper/`, run
  `set -a && source .env.local && set +a && npx supabase db push --dry-run --linked`
  then `--yes`. Ad-hoc SQL: `npx supabase db query --linked "<sql>"`. Applying a
  migration to prod is **Glenn's explicit call**.

---

## 3. Existing scoring pipeline (what we reuse)

### The cron route
`app/api/internal/refresh-equity-scores/route.ts` (`runtime=nodejs`,
`maxDuration=300`). It:

1. Authorizes via `Authorization: Bearer ${CRON_SECRET}`.
2. Builds the ticker set = `holdings.ticker ∪ tracked_tickers.ticker` (distinct).
   *(The `∪ tracked_tickers` was added in the watchlist work — Promise.all over
   both tables, then a `Set`.)*
3. Pulls one market-wide dividends calendar: `getDividendsCalendar(today, +90d)`.
4. Loops tickers with a `TICKER_PAD_MS` (default 1000ms) pad between each, and for
   each ticker runs the **score-one-ticker block** (route lines ~264–338):
   - `fetchTickerBundle(ticker, calendar)` — **17 FMP calls** via `runWithConcurrency`
     (`FMP_CONCURRENCY`, default 5): `getProfile, getRatiosTtm, getRatiosQuarterly,
     getDividends, getIncomeStatementQuarterly, getCashFlowStatementQuarterly,
     getBalanceSheetStatementQuarterly, getKeyMetricsTtm, getKeyMetricsQuarterly,
     getAnalystEstimates, getDcf, getSma, getRsi, getHistoricalEod,
     getPriceTargetConsensus, getGradesHistorical, getInsiderTrades`.
   - `loadPriorHistory(supabase, ticker)` — reads back recent `equity_score_history`.
   - `assembleScoreInputs(ticker, bundle, history)` from `@/lib/scoring/assemble-inputs`.
   - `computeBuyScore / computeTrimScore / computeRiskScore` (three `@/lib/scoring/compute-*`).
   - Derive `data_quality` (`degraded_uk` | `sparse` | `full`).
   - `nextUpcomingDividend(calendar, ticker, today)` from `@/lib/scoring/next-dividend`.
   - **Upsert three tables** (service-role client):
     `equity_scores` (onConflict `ticker`), `equity_score_history`
     (onConflict `ticker,observed_at`), `equity_score_signals`
     (onConflict `ticker,score_type,signal_code,observed_at`, top-5 via local
     `topSignalRows`).

### Local helpers currently inlined in the cron route (must move)
`fetchTickerBundle` (~L63), `loadPriorHistory` (~L153), `topSignalRows` (~L188),
plus the inline upsert block. These move into the shared module (§5.1).

### Test boundary to preserve
`app/api/internal/refresh-equity-scores/__tests__/route.test.ts` mocks
`@/lib/scoring/fmp-client` (all `get*` helpers) and `@supabase/supabase-js`
`createClient`. **The extracted module must keep importing FMP via
`@/lib/scoring/fmp-client`** so this mock boundary still works and the cron tests
stay green after refactor.

### Relevant schema
- `equity_scores` — public-read, service-role-write. Has `ticker` (PK/unique),
  `computed_at timestamptz`, `name`, `buy_score`, `trim_score`, `risk_score`,
  `buy_quality_gate_passed`, `buy_failed_gates`, `data_quality`, `ticker_market`,
  `next_ex_div_*`.
- `holdings` — user-scoped (RLS). Has `ticker`, `archived_at` (null = active),
  `user_id`.
- `tracked_tickers` — user-scoped (RLS). Has `ticker`, `user_id`. (Watchlist.)
- `profiles` — created in migration `0001`. Has `tier` (`free|pro|premium`).
- Latest migration on disk: `0011_broker_multi_connection.sql`. **Next = 0012.**

### Auth helpers
- `requireUser(path)` / `getCurrentUser()` in `lib/auth/server.ts` (for pages).
- API routes resolve the user via `createSupabaseServerClient()` →
  `supabase.auth.getClaims()` → `claims.sub`. Service-role admin client via
  `createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, …)`.

---

## 4. Design decisions (locked)

| Decision | Choice |
|---|---|
| **Which tickers** | The user's `holdings (archived_at is null) ∪ tracked_tickers`, distinct, keeping those with **no `equity_scores` row** OR `computed_at` older than **24h**. Skip anything scored within 24h. |
| **Ordering** | **Missing-first** (never-scored before merely-stale), so "Collecting…" rows fill before refreshes. |
| **Batch cap** | **20 tickers per call** (= ~340 FMP calls). |
| **FMP rate limit** | **750 calls/min.** 17 calls/ticker → ~44 tickers/min ceiling. 20-cap = 340 calls/batch, safely under. The call is **synchronous and the button is disabled in-flight**, so one user can't overlap batches; with the inter-ticker pad each batch spans ~30–40s, keeping sustained rate well under 750/min even on back-to-back batches. No separate rate-limiter needed. |
| **Cooldown** | 15-min per-user cooldown anchored on `profiles.last_score_refresh_at`, **bypassed whenever the user still has eligible (missing or stale) tickers**. So batches-of-20 re-clicks always work; the cooldown only engages once everything is fresh (which is already a no-op via the 24h skip). It is belt-and-suspenders against pointless repeat clicks. |
| **Wait UX** | **Synchronous**, capped. Click → spinner "Scoring N holdings…" → `router.refresh()` on success. |
| **Over-cap (>20)** | Score 20, return `remaining`. UI shows "Score the next 20" and the re-click bypasses the cooldown. |
| **Button placement** | **Portfolio Manager** (`/app/portfolio/scoring`) and **Watchlist** (`/app/portfolio/watchlist`) only. |
| **Tier** | Pro+ only (Free → 403). |

---

## 5. Architecture & components

### 5.1 Shared module: `lib/scoring/score-ticker.ts` (new)
Extract the score-one-ticker logic so the cron and the on-demand endpoint share
one code path (no drift).

- `export async function fetchTickerBundle(ticker, calendar): Promise<RawFmpBundle>`
  — moved verbatim from the cron (keeps importing `@/lib/scoring/fmp-client`).
- `export async function scoreTicker(admin: SupabaseClient, ticker: string,
  calendar: FmpCalendarDividend[], today: string): Promise<void>` — the per-ticker
  body: `fetchTickerBundle` → `loadPriorHistory` → `assembleScoreInputs` →
  compute three → derive `data_quality` → `nextUpcomingDividend` → upsert the three
  tables. Throws on a hard error (caller catches per-ticker).
- Move `loadPriorHistory` and `topSignalRows` here too (no longer route-local).

**Refactor the cron route** to import and call `scoreTicker(...)` inside its loop;
keep `TICKER_PAD_MS`, `getDividendsCalendar`, auth, and the ticker-set query in the
route. The cron's behaviour and its tests must be unchanged.

### 5.2 Endpoint: `app/api/portfolio/refresh-scores/route.ts` (new)
`POST`, `runtime=nodejs`, `dynamic=force-dynamic`, `maxDuration=300`.

Flow:
1. `getClaims()` → `userId`; 401 if none.
2. Read `profiles.tier` + `profiles.last_score_refresh_at`. Free → `403 {code:"pro_required"}`.
3. **Gather eligible tickers** (user RLS client):
   - distinct tickers from `holdings` (`archived_at is null`) and `tracked_tickers`.
   - fetch `equity_scores.ticker, computed_at` for those tickers.
   - `missing` = no score row; `stale` = `computed_at < now - 24h`.
   - `eligible = [...missing, ...stale]` (missing-first), capped at **20**;
     `remaining = totalEligible - scoredThisCall`.
4. **Cooldown:** if `missing.length === 0` AND `last_score_refresh_at > now - 15min`,
   return `429 {code:"cooldown", retryAfterSeconds}`. (Missing tickers always
   bypass; a fully-fresh portfolio with no eligible work returns `200 {scored:0,
   remaining:0, upToDate:true}` without 429.)
5. If `eligible.length === 0` → `200 {scored:0, remaining:0, upToDate:true}`.
6. One `getDividendsCalendar(today, +90d)` pull. Service-role admin client. For
   each eligible ticker: `await scoreTicker(admin, ticker, calendar, today)` with a
   per-ticker pad (reuse `FMP_TICKER_PAD_MS`, ~1–1.5s; 0 under test). Per-ticker
   failures are caught + counted, never abort the batch.
7. Stamp `profiles.last_score_refresh_at = now` (service-role update).
8. Return `200 {scored, failed, remaining}`.

### 5.3 Migration `supabase/migrations/0012_profiles_last_score_refresh.sql` (new)
```sql
alter table public.profiles
  add column if not exists last_score_refresh_at timestamptz;
```
Nullable, no backfill. Apply is Glenn's call (`db push --dry-run` then `--yes`).

### 5.4 UI: `<RefreshScoresButton />` (new client component)
Suggested location: `app/app/portfolio/_components/refresh-scores-button.tsx`.
- `POST /api/portfolio/refresh-scores`, `useTransition` + `router.refresh()`.
- States: idle → "Refresh scores" / "Scoring N holdings…" (disabled in-flight) →
  on success: if `remaining>0` show "Score the next 20"; else "Scores up to date".
- Handle `429` (`code:"cooldown"`): show "Try again in ~M min" using `retryAfterSeconds`.
- Render on **Portfolio Manager** (`app/app/portfolio/scoring/page.tsx`) and
  **Watchlist** (`app/app/portfolio/watchlist/page.tsx`), near the heading.

---

## 6. Data flow (per click)

```
Button (client) ──POST──▶ /api/portfolio/refresh-scores
                            │ getClaims → userId; profiles.tier (Pro gate)
                            │ gather holdings∪tracked → diff vs equity_scores.computed_at
                            │ cooldown check (bypassed if missing>0)
                            │ getDividendsCalendar (1 pull)
                            │ for each of ≤20 eligible: scoreTicker(admin,…)  ← shared w/ cron
                            │     fetchTickerBundle (17 FMP calls) → assemble → compute → upsert ×3
                            │ stamp profiles.last_score_refresh_at
                            └─▶ { scored, failed, remaining }
Button ◀── router.refresh() repaints chips; shows "next 20" or "up to date"
```

---

## 7. Error handling
- 401 no session, 403 Free, 429 cooldown (with `retryAfterSeconds`), 500 on
  missing service-role env.
- Per-ticker failures inside the batch are caught, Sentry-captured, counted in
  `failed`, and never abort the run (mirrors the cron).
- The button surfaces a friendly message for 429 and network errors; a partial
  success (`failed>0`) still refreshes and shows what landed.

---

## 8. Testing plan (TDD)
- **`lib/scoring/__tests__/score-ticker.test.ts`** — `scoreTicker` happy path:
  given mocked `@/lib/scoring/fmp-client` + a stub admin client, it upserts
  `equity_scores`/`equity_score_history`/`equity_score_signals` for the ticker.
- **Cron tests stay green** — `refresh-equity-scores/__tests__/route.test.ts` must
  pass unchanged after the extraction (verifies the refactor preserved behaviour).
- **`app/api/portfolio/refresh-scores/__tests__/route.test.ts`** — 401; 403 Free;
  429 cooldown when no missing + within 15min; cooldown bypassed when missing>0;
  stale (>24h) selected, fresh (<24h) skipped; 20-cap with `remaining>0`;
  missing-first ordering; `scoreTicker` called per eligible ticker;
  `last_score_refresh_at` stamped; `upToDate` when nothing eligible.
- **`refresh-scores-button.test.tsx`** — renders; click POSTs; disabled in-flight;
  shows "next 20" on `remaining>0`; shows cooldown message on 429.

## 9. Verification (end-to-end)
- `npx vitest run` all green; `npx eslint <changed>`; `npx tsc --noEmit`; `npm run build`.
- Apply migration 0012 (Glenn's go). Local dev as a Pro user: add ~3 tickers that
  have no score → they show "Collecting…" → click **Refresh scores** → spinner →
  chips populate after the call. Click again immediately → "Scores up to date"
  (24h skip), no FMP burst. Confirm Free users get 403 / no button.
- Spot-check FMP usage stays within 750/min for a 20-ticker batch.

## 10. Out of scope (YAGNI)
- Background/queue processing or polling UX (synchronous is enough at this cap).
- A global cross-user rate limiter (the per-call cap + synchronous pacing suffices).
- Forced re-score of <24h-fresh tickers (deliberately disallowed to bound cost).
- `watchlist_alert` / `weekly_digest` / reinvest alert emails (unrelated).

## 11. Open considerations for the implementer
- Pick the per-ticker pad so a 20-ticker batch lands comfortably inside
  `maxDuration=300` while staying under 750 FMP calls/min (≈1–1.5s pad → ~30–40s).
- `profiles` update for the timestamp should use the **service-role** client
  (don't assume the user can update their own `profiles` row under RLS).
- Keep the eligibility SQL set-based where possible (one `in (...)` lookup of
  `equity_scores.computed_at` for the user's tickers), not N round-trips.
```
