# Portfolio View Glow-Up — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `/app/portfolio` from a flat spreadsheet into a premium ledger — logos via logo.dev (with a deterministic initials fallback), a per-row server-rendered `30D · 1Y · 5Y` price sparkline backed by a new `ticker_price_history` table, beveled rows with a whole-row click target, wrapper demotion, sortable sticky headers, density toggle, % of portfolio bar, and 2dp quantity/cost formatting.

**Architecture:** One feature branch, shippable as a single PR. Data layer first (migration → loader → backfill → cron extension) so the UI can wire against real data, then leaf components (`<InitialsTile>`, `<HoldingLogo>`, `<RowSparkline>`, `<RangeToggle>`, `<DensityToggle>`, `<WrapperFilterChips>`, `<PortfolioBar>`) under TDD, then the `holdings-table.tsx` rewrite that composes them, then `page.tsx` wiring + mobile refresh + the logo attribution footer + a final smoke pass.

**Tech Stack:** Next.js 16 App Router + React 19 + Tailwind v4, Supabase Postgres + Auth, Vitest + RTL. New external surface: logo.dev CDN (already have token in env). Reuses existing primitives: `lib/portfolio/load-priced-holdings.ts`, `lib/portfolio/format-money.ts`, `lib/portfolio/sort-holdings.ts`, `app/(public)/_components/price-nav-sparkline.tsx` (SVG-path math reused, not the component itself).

**Spec:** [planning/specs/2026-06-27-portfolio-view-glow-up-design.md](../specs/2026-06-27-portfolio-view-glow-up-design.md)

**Branch:** `feature/portfolio-glow-up` off `main`, in worktree `dividendmapper/.worktrees/portfolio-glow-up`.

---

## Task 1: Pre-flight (worktree + baseline)

**Files:**
- Create worktree: `dividendmapper/.worktrees/portfolio-glow-up`

- [ ] **Step 1: Create worktree, link node_modules + env, install if needed**

```bash
cd /c/Users/grodg/dividend_mapper_plan && \
  git fetch origin && \
  git worktree add dividendmapper/.worktrees/portfolio-glow-up -b feature/portfolio-glow-up origin/main && \
  cd dividendmapper/.worktrees/portfolio-glow-up/dividendmapper && \
  cmd //C "rmdir node_modules" 2>/dev/null; \
  cmd //C "mklink /J node_modules C:\\Users\\grodg\\dividend_mapper_plan\\dividendmapper\\node_modules" && \
  cmd //C "mklink .env.local C:\\Users\\grodg\\dividend_mapper_plan\\dividendmapper\\.env.local"
```

The chained `&&` is deliberate — Glenn's memory note `feedback_concurrent_worktree_branch_race` documents that running parallel agents in the same root can move HEAD between calls. Chain atomically.

If `node_modules` is empty in the primary checkout (a parallel agent wiped it), run `npm install --no-audit --no-fund --prefer-offline` from inside the new worktree before the baseline.

- [ ] **Step 2: Capture baseline test count**

Run: `npx vitest run --no-file-parallelism 2>&1 | tail -3`
Expected: `Tests <baseline-count> passed (<n>)`. Note the count; later tasks will add ~30-40 new tests across the new components.

- [ ] **Step 3: Confirm `LOGO_DEV_PUBLISHABLE_API_KEY` is in `.env.local`**

```bash
grep -E '^(NEXT_PUBLIC_)?LOGO_DEV_PUBLISHABLE_API_KEY=' .env.local
```

Expected: at least one line. If `NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_API_KEY=...` isn't present, add it — copy the value from the private `LOGO_DEV_PUBLISHABLE_API_KEY` line. The `NEXT_PUBLIC_` prefix is required because logo.dev URLs render in client HTML.

---

## Task 2: Database migration — ticker_price_history

**Files:**
- Create: `dividendmapper/supabase/migrations/0024_ticker_price_history.sql`

> **Note:** `0023_scoring_lookup_audit.sql` lands first (from the free-UX glow-up branch — Glenn applied it to prod on 2026-06-27). Our migration is therefore `0024`. If the migration head has moved further by the time you run this task, bump every reference in this task to the next free number.

- [ ] **Step 1: Confirm the next free migration number**

```bash
ls dividendmapper/supabase/migrations/ | sort | tail -3
```

Expected: head is `0023_scoring_lookup_audit.sql`. Our new file is `0024_ticker_price_history.sql`. If head is higher than `0023`, bump every reference in this task to `head + 1`.

- [ ] **Step 2: Author the migration**

```sql
-- 0024_ticker_price_history.sql
-- Per-ticker daily close-price history backing the row sparklines on /app/portfolio.
-- Populated by the one-time backfill script (FMP historical-price-full) and the
-- nightly cron (append today's close per ticker). Retention is bounded by a daily
-- prune to keep ~5Y per ticker (1300 trading days).

create table if not exists public.ticker_price_history (
  ticker      text          not null,
  trade_date  date          not null,
  close       numeric(20,6) not null,
  currency    text          not null,
  primary key (ticker, trade_date)
);

create index if not exists ticker_price_history_recent_idx
  on public.ticker_price_history (ticker, trade_date desc);

-- Public read; service role only writes. Holds no user data.
alter table public.ticker_price_history enable row level security;

drop policy if exists "ticker_price_history read public"
  on public.ticker_price_history;
create policy "ticker_price_history read public"
  on public.ticker_price_history for select
  using (true);

comment on table public.ticker_price_history is
  'Per-ticker daily close prices in display units (USD for US, GBp for .L). '
  'Server-rendered sparklines on /app/portfolio. Public read; backfilled from '
  'FMP historical-price-full and appended by the nightly cron.';
```

- [ ] **Step 3: Dry-run the migration**

```bash
set -a && source .env.local && set +a
npx supabase db push --dry-run | tail -20
```

Expected: lists `0024_ticker_price_history.sql` as the only new migration. If `0023_scoring_lookup_audit.sql` also appears as pending, the free-UX branch's migration has not been applied to this database yet — stop and confirm with Glenn before proceeding. Per memory `reference_supabase_out_of_order_migration_workaround`, applying our `0024` while `0023` is pending will jam the migration tracker.

- [ ] **Step 4: Apply the migration**

Stop and ask Glenn to run the apply step in his terminal — direct database writes are a hand-off step in his workflow:

> Migration `0024_ticker_price_history.sql` is dry-run clean. Please run:
>
> ```bash
> set -a && source .env.local && set +a && npx supabase db push --yes
> ```
>
> Confirm `Applied migration 0024_ticker_price_history.sql` before continuing.

- [ ] **Step 5: Verify the table is in place**

```bash
psql "$DATABASE_URL" -c "\d public.ticker_price_history"
```

Expected: the `\d` output shows the table with the four columns above, the composite primary key, and the `ticker_price_history_recent_idx` index.

- [ ] **Step 6: Commit**

```bash
git add dividendmapper/supabase/migrations/0024_ticker_price_history.sql
git commit -m "feat(db): add ticker_price_history for sparkline series"
```

---

## Task 3: loadSparklineSeriesByTicker helper

**Files:**
- Create: `dividendmapper/lib/portfolio/load-sparkline-series.ts`
- Create: `dividendmapper/lib/portfolio/__tests__/load-sparkline-series.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// dividendmapper/lib/portfolio/__tests__/load-sparkline-series.test.ts
import { describe, it, expect, vi } from "vitest";
import { loadSparklineSeriesByTicker, downsampleSeries, RANGE_DAYS } from "../load-sparkline-series";

function fakeSupabase(rows: { ticker: string; trade_date: string; close: number; currency: string }[]) {
  return {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        in: (_col: string, _vals: string[]) => ({
          gte: (_col2: string, _val: string) => ({
            order: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }),
          }),
        }),
      }),
    }),
  };
}

describe("downsampleSeries", () => {
  it("returns input unchanged when under target", () => {
    const xs = [1, 2, 3, 4, 5];
    expect(downsampleSeries(xs, 100)).toEqual(xs);
  });

  it("strides 1260 points down to ~100", () => {
    const xs = Array.from({ length: 1260 }, (_, i) => i);
    const out = downsampleSeries(xs, 100);
    expect(out.length).toBeGreaterThan(95);
    expect(out.length).toBeLessThanOrEqual(110);
    expect(out[0]).toBe(0);
    expect(out.at(-1)).toBe(1259);
  });
});

describe("loadSparklineSeriesByTicker", () => {
  it("returns sliced series keyed by ticker", async () => {
    const rows = [
      { ticker: "AAPL", trade_date: "2026-05-01", close: 200, currency: "USD" },
      { ticker: "AAPL", trade_date: "2026-05-02", close: 202, currency: "USD" },
      { ticker: "AAPL", trade_date: "2026-05-03", close: 201, currency: "USD" },
      { ticker: "PYPL", trade_date: "2026-05-03", close: 70, currency: "USD" },
    ];
    const supabase = fakeSupabase(rows);
    const out = await loadSparklineSeriesByTicker(supabase as any, ["AAPL", "PYPL"], "30D");
    expect(out.get("AAPL")?.points).toEqual([200, 202, 201]);
    expect(out.get("AAPL")?.firstClose).toBe(200);
    expect(out.get("AAPL")?.lastClose).toBe(201);
    expect(out.get("AAPL")?.currency).toBe("USD");
    expect(out.get("PYPL")?.points).toEqual([70]);
  });

  it("returns empty map when no tickers requested", async () => {
    const supabase = fakeSupabase([]);
    const out = await loadSparklineSeriesByTicker(supabase as any, [], "30D");
    expect(out.size).toBe(0);
  });

  it("uses range-appropriate days threshold", () => {
    expect(RANGE_DAYS["30D"]).toBe(30);
    expect(RANGE_DAYS["1Y"]).toBe(365);
    expect(RANGE_DAYS["5Y"]).toBe(1825);
  });

  it("downsamples 5Y range to ~100 points per ticker", async () => {
    const rows = Array.from({ length: 1260 }, (_, i) => ({
      ticker: "AAPL",
      trade_date: `2021-01-${String((i % 28) + 1).padStart(2, "0")}`,
      close: 200 + i,
      currency: "USD",
    }));
    const supabase = fakeSupabase(rows);
    const out = await loadSparklineSeriesByTicker(supabase as any, ["AAPL"], "5Y");
    const series = out.get("AAPL")!;
    expect(series.points.length).toBeGreaterThan(95);
    expect(series.points.length).toBeLessThanOrEqual(110);
    expect(series.firstClose).toBe(200);
    expect(series.lastClose).toBe(200 + 1259);
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

Run: `npx vitest run lib/portfolio/__tests__/load-sparkline-series.test.ts 2>&1 | tail -10`
Expected: FAIL with `Cannot find module '../load-sparkline-series'`.

- [ ] **Step 3: Implement the helper**

```ts
// dividendmapper/lib/portfolio/load-sparkline-series.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type SparklineRange = "30D" | "1Y" | "5Y";

export const RANGE_DAYS: Record<SparklineRange, number> = {
  "30D": 30,
  "1Y": 365,
  "5Y": 1825,
};

const DOWNSAMPLE_TARGET = 100;

export interface SparklineSeries {
  points: number[];
  firstClose: number;
  lastClose: number;
  currency: string;
}

export function downsampleSeries(points: number[], target: number): number[] {
  if (points.length <= target) return points;
  const stride = Math.ceil(points.length / target);
  const out: number[] = [];
  for (let i = 0; i < points.length; i += stride) out.push(points[i]);
  // Always retain the last point so the line ends where reality ends.
  if (out.at(-1) !== points.at(-1)) out.push(points.at(-1)!);
  return out;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function loadSparklineSeriesByTicker(
  supabase: SupabaseClient,
  tickers: string[],
  range: SparklineRange,
): Promise<Map<string, SparklineSeries>> {
  const out = new Map<string, SparklineSeries>();
  if (tickers.length === 0) return out;

  const since = daysAgoIso(RANGE_DAYS[range]);
  const { data, error } = await supabase
    .from("ticker_price_history")
    .select("ticker, trade_date, close, currency")
    .in("ticker", tickers)
    .gte("trade_date", since)
    .order("ticker", { ascending: true })
    .order("trade_date", { ascending: true });

  if (error || !data) return out;

  // Group rows by ticker preserving the trade_date ASC order.
  const grouped = new Map<string, { close: number; currency: string }[]>();
  for (const row of data as { ticker: string; close: number; currency: string }[]) {
    if (!grouped.has(row.ticker)) grouped.set(row.ticker, []);
    grouped.get(row.ticker)!.push({ close: Number(row.close), currency: row.currency });
  }

  for (const [ticker, rows] of grouped) {
    if (rows.length === 0) continue;
    const points = rows.map((r) => r.close);
    const downsampled = range === "5Y" ? downsampleSeries(points, DOWNSAMPLE_TARGET) : points;
    out.set(ticker, {
      points: downsampled,
      firstClose: points[0],
      lastClose: points.at(-1)!,
      currency: rows[0].currency,
    });
  }

  return out;
}
```

- [ ] **Step 4: Run test — confirm it passes**

Run: `npx vitest run lib/portfolio/__tests__/load-sparkline-series.test.ts 2>&1 | tail -8`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/lib/portfolio/load-sparkline-series.ts \
        dividendmapper/lib/portfolio/__tests__/load-sparkline-series.test.ts
git commit -m "feat(portfolio): loadSparklineSeriesByTicker helper with 5Y downsample"
```

---

## Task 4: Backfill script — backfill-ticker-price-history.mjs

**Files:**
- Create: `dividendmapper/scripts/sanity/backfill-ticker-price-history.mjs`

This script runs once during rollout. It's a sanity-style ad-hoc script, not a tested unit — its correctness is verified by running it against the real DB + spot-checking a handful of tickers.

- [ ] **Step 1: Author the script**

```js
// dividendmapper/scripts/sanity/backfill-ticker-price-history.mjs
// One-time backfill of ticker_price_history from FMP historical-price-full.
// Iterates the distinct ticker universe (holdings ∪ watchlist ∪ vehicle scores),
// fetches up to 1300 daily closes per ticker, upserts into ticker_price_history.
// Idempotent — safe to re-run for failed tickers.
//
// Usage:
//   set -a && source .env.local && set +a
//   node dividendmapper/scripts/sanity/backfill-ticker-price-history.mjs [--only=AAPL,PYPL]

import { createClient } from "@supabase/supabase-js";

const FMP_KEY = process.env.FMP_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!FMP_KEY || !SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error("Missing FMP_API_KEY, NEXT_PUBLIC_SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { persistSession: false } });
const KEEP_DAYS = 1300;
const SLEEP_MS = 100; // ~10 req/s, well under FMP's 750/min Premium ceiling.

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null;

async function distinctTickers() {
  const [{ data: h }, { data: w }, { data: v }] = await Promise.all([
    supabase.from("holdings").select("ticker").is("archived_at", null),
    supabase.from("watchlist").select("ticker"),
    supabase.from("vehicle_scores").select("ticker"),
  ]);
  const set = new Set();
  for (const row of [...(h ?? []), ...(w ?? []), ...(v ?? [])]) {
    if (row?.ticker) set.add(row.ticker);
  }
  if (only) for (const t of [...set]) if (!only.has(t)) set.delete(t);
  return [...set].sort();
}

async function fetchHistory(ticker) {
  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(ticker)}?serietype=line&apikey=${FMP_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP ${res.status} for ${ticker}`);
  const json = await res.json();
  // FMP returns { symbol, historical: [{ date, close, ... }, ...] } (date DESC).
  const historical = Array.isArray(json?.historical) ? json.historical : [];
  if (historical.length === 0) return { rows: [], currency: null };
  // FMP doesn't include a per-row currency in this endpoint. Heuristic:
  // `.L` suffix → GBp, else USD. Vehicle scoring already uses this convention.
  const currency = ticker.endsWith(".L") ? "GBp" : "USD";
  const rows = historical
    .slice(0, KEEP_DAYS)
    .map((r) => ({ ticker, trade_date: r.date, close: r.close, currency }))
    .filter((r) => Number.isFinite(r.close) && /^\d{4}-\d{2}-\d{2}$/.test(r.trade_date));
  return { rows, currency };
}

async function upsertChunk(rows) {
  // upsert in chunks of 500 to stay under Supabase's row-array limit
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase
      .from("ticker_price_history")
      .upsert(chunk, { onConflict: "ticker,trade_date" });
    if (error) throw error;
  }
}

async function main() {
  const tickers = await distinctTickers();
  console.log(`Backfilling ${tickers.length} tickers`);
  let ok = 0, miss = 0, fail = 0;
  for (const ticker of tickers) {
    try {
      const { rows, currency } = await fetchHistory(ticker);
      if (rows.length === 0) {
        console.warn(`MISS ${ticker} — no historical data`);
        miss++;
      } else {
        await upsertChunk(rows);
        console.log(`OK   ${ticker} — ${rows.length} closes (${currency})`);
        ok++;
      }
    } catch (e) {
      console.error(`FAIL ${ticker} — ${e.message}`);
      fail++;
    }
    await new Promise((r) => setTimeout(r, SLEEP_MS));
  }
  console.log(`\nDone: ${ok} ok, ${miss} miss, ${fail} fail`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke-test the script against a single ticker**

```bash
set -a && source .env.local && set +a
node dividendmapper/scripts/sanity/backfill-ticker-price-history.mjs --only=AAPL
```

Expected: one line `OK   AAPL — <N> closes (USD)`, summary `1 ok, 0 miss, 0 fail`.

Verify in DB:

```bash
psql "$DATABASE_URL" -c "select count(*), min(trade_date), max(trade_date), currency from public.ticker_price_history where ticker = 'AAPL' group by currency;"
```

Expected: count ~1260, min ≈ 5 years ago, max within last 2 trading days, currency `USD`.

- [ ] **Step 3: Smoke-test a UK ticker**

```bash
node dividendmapper/scripts/sanity/backfill-ticker-price-history.mjs --only=BME.L
```

Expected: `OK   BME.L — <N> closes (GBp)`. If miss, log the FMP raw response shape and check whether `.L` tickers need a different endpoint variant — note in the per-ticker outcome log for triage.

- [ ] **Step 4: Full run + spot check**

```bash
node dividendmapper/scripts/sanity/backfill-ticker-price-history.mjs 2>&1 | tee /tmp/backfill.log
```

Wait ~7 minutes for completion. Then:

```bash
psql "$DATABASE_URL" -c "select count(distinct ticker), count(*), pg_size_pretty(pg_total_relation_size('public.ticker_price_history')) from public.ticker_price_history;"
```

Expected: distinct-ticker count matches `distinctTickers()` output. Total rows ~ticker count × ~1260. Total size well under 1 GB.

Pick 5 random tickers from the log and confirm their `count(*)` ≈ 1260 in DB.

Note the MISS list at the end of the log — funds and obscure listings will likely miss. The initials tile handles them.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/scripts/sanity/backfill-ticker-price-history.mjs
git commit -m "feat(scripts): one-time backfill for ticker_price_history from FMP"
```

---

## Task 5: Extend the nightly job to append today's close per ticker

**Files:**
- Modify: `dividendmapper/app/api/internal/refresh-equity-scores/route.ts` (likely) — confirm in Step 1
- Test: `dividendmapper/app/api/internal/refresh-equity-scores/__tests__/route.test.ts` (extend)

The spec assumed the nightly cron lives at a specific path; this task starts with discovery.

- [ ] **Step 1: Find the route that already populates `priceByTicker` for `/app/portfolio`**

```bash
grep -RIn "priceByTicker\|equity_scores.*price\|update.*last_price" dividendmapper/app/api/internal dividendmapper/lib | head -30
```

Pick the route whose handler updates per-ticker prices. Confirm by reading its handler — it should iterate the distinct ticker universe and write the latest FMP close to `equity_scores` or a similar table. The most likely match is `app/api/internal/refresh-equity-scores/route.ts`. Note the route file path here for reuse in the steps below; replace `<CRON_ROUTE>` with that path.

If no route currently writes per-ticker close prices, the nearest match is the route called by Vercel Cron `0 2 * * *` (or similar). Read its handler, find the loop over tickers, and add the `ticker_price_history` insert inside that loop.

- [ ] **Step 2: Write the failing test extension**

Open the route's existing test file. Add a new `it(…)` block:

```ts
it("appends today's close to ticker_price_history for each ticker", async () => {
  // Reuse the existing mock setup pattern; this assumes the test already
  // stubs FMP and supabase. Confirm by reading the existing tests first.
  const inserts: { ticker: string; trade_date: string; close: number; currency: string }[] = [];
  mockSupabase.from = (table: string) => {
    if (table === "ticker_price_history") {
      return {
        upsert: (rows: typeof inserts) => {
          inserts.push(...rows);
          return Promise.resolve({ error: null });
        },
      };
    }
    return originalFrom(table);
  };

  await POST(makeRequest());

  expect(inserts.length).toBeGreaterThan(0);
  const today = new Date().toISOString().slice(0, 10);
  expect(inserts.every((r) => r.trade_date === today)).toBe(true);
  expect(inserts.some((r) => r.ticker === "AAPL" && r.currency === "USD")).toBe(true);
});
```

Adapt the mock-Supabase shape to the route's existing test pattern. The point of the test is the behaviour: for every ticker the cron prices, one row also lands in `ticker_price_history`.

- [ ] **Step 3: Run test — confirm it fails**

Run: `npx vitest run <CRON_ROUTE_TEST> 2>&1 | tail -8`
Expected: FAIL with the new `it(…)` block reporting `inserts.length` is 0.

- [ ] **Step 4: Wire the upsert into the route handler**

Inside the route's per-ticker loop, after fetching the latest FMP price, add an upsert against `ticker_price_history`. Idempotent on `(ticker, trade_date)`:

```ts
const today = new Date().toISOString().slice(0, 10);
const ohlcRows = tickerPriceUpdates.map((u) => ({
  ticker: u.ticker,
  trade_date: today,
  close: u.close,
  currency: u.currency,
}));
if (ohlcRows.length > 0) {
  const { error: ohlcErr } = await supabase
    .from("ticker_price_history")
    .upsert(ohlcRows, { onConflict: "ticker,trade_date" });
  if (ohlcErr) {
    console.warn(`[cron] ticker_price_history upsert failed: ${ohlcErr.message}`);
  }
}
```

Adapt `tickerPriceUpdates` to whatever the route's local variable is called. The upsert must run inside the same loop iteration / batch context as the existing price write, so a re-run on the same day is a no-op.

- [ ] **Step 5: Run test — confirm it passes**

Run: `npx vitest run <CRON_ROUTE_TEST> 2>&1 | tail -8`
Expected: all tests in that file pass, including the new one.

- [ ] **Step 6: Add a daily prune step (same handler)**

Right after the per-ticker upsert loop, drop anything older than 1300 days:

```ts
await supabase
  .from("ticker_price_history")
  .delete()
  .lt("trade_date", new Date(Date.now() - 1300 * 86400_000).toISOString().slice(0, 10));
```

- [ ] **Step 7: Commit**

```bash
git add <CRON_ROUTE> <CRON_ROUTE_TEST>
git commit -m "feat(cron): append daily closes to ticker_price_history, prune >1300d"
```

---

## Task 6: Add img.logo.dev to next.config.ts + env example

**Files:**
- Modify: `dividendmapper/next.config.ts`
- Modify: `dividendmapper/.env.example`

- [ ] **Step 1: Add the logo.dev remote pattern**

Open `dividendmapper/next.config.ts`. Find the `images.remotePatterns` array. Add:

```ts
{ protocol: "https", hostname: "img.logo.dev", pathname: "/**" },
```

If the file doesn't yet expose `images.remotePatterns`, add the whole block:

```ts
images: {
  remotePatterns: [
    { protocol: "https", hostname: "img.logo.dev", pathname: "/**" },
  ],
},
```

- [ ] **Step 2: Add the public env var to .env.example**

In `dividendmapper/.env.example`, append:

```
# Public token for logo.dev — used to render holding logos on /app/portfolio.
# Free tier: 500k req/month with attribution. Public-by-design (appears in client HTML).
NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_API_KEY=
```

- [ ] **Step 3: Sanity check the dev server still boots**

```bash
npm run dev
```

Visit `http://localhost:3000/`. Confirm no console error about the next.config schema.

- [ ] **Step 4: Commit**

```bash
git add dividendmapper/next.config.ts dividendmapper/.env.example
git commit -m "chore(config): allow img.logo.dev in next/image + add NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_API_KEY"
```

---

## Task 7: InitialsTile component

**Files:**
- Create: `dividendmapper/app/app/portfolio/_components/initials-tile.tsx`
- Create: `dividendmapper/app/app/portfolio/_components/__tests__/initials-tile.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// dividendmapper/app/app/portfolio/_components/__tests__/initials-tile.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { InitialsTile, hashHue } from "../initials-tile";

describe("hashHue", () => {
  it("is deterministic for the same ticker", () => {
    expect(hashHue("AAPL")).toBe(hashHue("AAPL"));
    expect(hashHue("BME.L")).toBe(hashHue("BME.L"));
  });

  it("differs across distinct tickers", () => {
    expect(hashHue("AAPL")).not.toBe(hashHue("PYPL"));
  });

  it("returns a value in [0, 360)", () => {
    for (const t of ["A", "AAPL", "BME.L", "401k", "VERY_LONG_TICKER_NAME"]) {
      const h = hashHue(t);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });
});

describe("InitialsTile", () => {
  it("renders 1-2 uppercase alphanumerics from the ticker", () => {
    const { getByRole } = render(<InitialsTile ticker="AAPL" />);
    expect(getByRole("img").textContent).toBe("AA");
  });

  it("strips non-alphanumerics", () => {
    const { getByRole } = render(<InitialsTile ticker="BME.L" />);
    expect(getByRole("img").textContent).toBe("BM");
  });

  it("falls back to a single letter when only one alphanumeric is present", () => {
    const { getByRole } = render(<InitialsTile ticker="X" />);
    expect(getByRole("img").textContent).toBe("X");
  });

  it("falls back to ? when no alphanumerics", () => {
    const { getByRole } = render(<InitialsTile ticker="$$$" />);
    expect(getByRole("img").textContent).toBe("?");
  });

  it("uses the same colour for the same ticker across renders", () => {
    const a = render(<InitialsTile ticker="AAPL" />).getByRole("img") as HTMLElement;
    const b = render(<InitialsTile ticker="AAPL" />).getByRole("img") as HTMLElement;
    expect(a.style.backgroundColor).toBe(b.style.backgroundColor);
  });

  it("has an accessible label including the ticker", () => {
    const { getByRole } = render(<InitialsTile ticker="AAPL" />);
    expect(getByRole("img").getAttribute("aria-label")).toContain("AAPL");
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

Run: `npx vitest run app/app/portfolio/_components/__tests__/initials-tile.test.tsx 2>&1 | tail -8`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the component**

```tsx
// dividendmapper/app/app/portfolio/_components/initials-tile.tsx
// Deterministic placeholder tile rendered when a logo.dev request 404s.
// Background colour derives from a hash of the ticker so the same holding
// always gets the same colour across renders.

export function hashHue(ticker: string): number {
  // FNV-1a 32-bit, then mod 360.
  let h = 0x811c9dc5;
  for (let i = 0; i < ticker.length; i++) {
    h ^= ticker.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 360;
}

function initials(ticker: string): string {
  const alnum = ticker.replace(/[^A-Za-z0-9]/g, "");
  if (alnum.length === 0) return "?";
  return alnum.slice(0, 2).toUpperCase();
}

interface Props {
  ticker: string;
  size?: number;
}

export function InitialsTile({ ticker, size = 32 }: Props) {
  const hue = hashHue(ticker);
  return (
    <div
      role="img"
      aria-label={`${ticker} placeholder logo`}
      style={{
        width: size,
        height: size,
        backgroundColor: `hsl(${hue} 35% 28%)`,
        color: `hsl(${hue} 55% 88%)`,
      }}
      className="grid place-items-center rounded-md border border-border/40 font-display text-[11px] font-semibold"
    >
      {initials(ticker)}
    </div>
  );
}
```

- [ ] **Step 4: Run test — confirm it passes**

Run: `npx vitest run app/app/portfolio/_components/__tests__/initials-tile.test.tsx 2>&1 | tail -8`
Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/initials-tile.tsx \
        dividendmapper/app/app/portfolio/_components/__tests__/initials-tile.test.tsx
git commit -m "feat(portfolio): InitialsTile fallback with deterministic hue"
```

---

## Task 8: HoldingLogo component

**Files:**
- Create: `dividendmapper/app/app/portfolio/_components/holding-logo.tsx`
- Create: `dividendmapper/app/app/portfolio/_components/__tests__/holding-logo.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// dividendmapper/app/app/portfolio/_components/__tests__/holding-logo.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { HoldingLogo } from "../holding-logo";

// next/image renders as a normal <img> in the jsdom test environment with the
// project's existing test setup. Confirm with the existing image-using tests.

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_API_KEY", "test_token_123");
});

describe("HoldingLogo", () => {
  it("renders an img with the logo.dev ticker URL and retina=true", () => {
    const { getByRole } = render(<HoldingLogo ticker="AAPL" name="Apple" />);
    const img = getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("https://img.logo.dev/ticker/AAPL");
    expect(img.src).toContain("token=test_token_123");
    expect(img.src).toContain("retina=true");
    expect(img.src).toContain("fallback=404");
  });

  it("uses the ticker as alt when no name is supplied", () => {
    const { getByRole } = render(<HoldingLogo ticker="AAPL" />);
    expect((getByRole("img") as HTMLImageElement).alt).toContain("AAPL");
  });

  it("falls back to InitialsTile when the image errors", () => {
    const { getByRole, container } = render(<HoldingLogo ticker="AAPL" />);
    const img = getByRole("img") as HTMLImageElement;
    fireEvent.error(img);
    // The img is gone; the tile (role=img + textContent) is now in place.
    expect(container.textContent).toBe("AA");
  });

  it("encodes the ticker so .L suffix survives unchanged", () => {
    const { getByRole } = render(<HoldingLogo ticker="BME.L" />);
    expect((getByRole("img") as HTMLImageElement).src).toContain("/ticker/BME.L");
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

Run: `npx vitest run app/app/portfolio/_components/__tests__/holding-logo.test.tsx 2>&1 | tail -8`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the component**

```tsx
// dividendmapper/app/app/portfolio/_components/holding-logo.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { InitialsTile } from "./initials-tile";

interface Props {
  ticker: string;
  name?: string;
  size?: number;
}

export function HoldingLogo({ ticker, name, size = 32 }: Props) {
  const [errored, setErrored] = useState(false);
  if (errored) return <InitialsTile ticker={ticker} size={size} />;

  const token = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_API_KEY ?? "";
  const url = `https://img.logo.dev/ticker/${ticker}?token=${token}&size=${size * 2}&retina=true&format=webp&fallback=404`;

  return (
    <Image
      src={url}
      width={size}
      height={size}
      alt={`${name ?? ticker} logo`}
      className="rounded-md border border-border/40 bg-card object-contain"
      onError={() => setErrored(true)}
    />
  );
}
```

- [ ] **Step 4: Run test — confirm it passes**

Run: `npx vitest run app/app/portfolio/_components/__tests__/holding-logo.test.tsx 2>&1 | tail -8`
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/holding-logo.tsx \
        dividendmapper/app/app/portfolio/_components/__tests__/holding-logo.test.tsx
git commit -m "feat(portfolio): HoldingLogo via logo.dev with InitialsTile fallback"
```

---

## Task 9: RowSparkline component

**Files:**
- Create: `dividendmapper/app/app/portfolio/_components/row-sparkline.tsx`
- Create: `dividendmapper/app/app/portfolio/_components/__tests__/row-sparkline.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// dividendmapper/app/app/portfolio/_components/__tests__/row-sparkline.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { RowSparkline } from "../row-sparkline";

const baseSeries = {
  firstClose: 100,
  lastClose: 110,
  currency: "USD",
};

describe("RowSparkline", () => {
  it("renders the Collecting pill when fewer than 8 points", () => {
    const { container } = render(
      <RowSparkline
        ticker="AAPL"
        name="Apple"
        range="30D"
        series={{ ...baseSeries, points: [100, 102, 104] }}
      />,
    );
    expect(container.textContent).toContain("Collecting");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders the Collecting pill when series is null", () => {
    const { container } = render(
      <RowSparkline ticker="AAPL" name="Apple" range="30D" series={null} />,
    );
    expect(container.textContent).toContain("Collecting");
  });

  it("renders an SVG path with M…L… for ≥ 8 points", () => {
    const points = Array.from({ length: 30 }, (_, i) => 100 + i);
    const { container } = render(
      <RowSparkline
        ticker="AAPL"
        name="Apple"
        range="30D"
        series={{ ...baseSeries, points, lastClose: 129 }}
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const path = svg!.querySelector("path");
    expect(path?.getAttribute("d")?.startsWith("M ")).toBe(true);
    expect(path?.getAttribute("d")).toContain(" L ");
  });

  it("places the last-point dot at the right edge", () => {
    const points = Array.from({ length: 30 }, (_, i) => 100 + i);
    const { container } = render(
      <RowSparkline
        ticker="AAPL"
        name="Apple"
        range="30D"
        series={{ ...baseSeries, points }}
      />,
    );
    const circle = container.querySelector("circle");
    const cx = Number(circle?.getAttribute("cx") ?? 0);
    // viewBox width = 120; expect dot within the last few px.
    expect(cx).toBeGreaterThan(115);
  });

  it("renders a horizontal line for an all-flat series", () => {
    const points = Array.from({ length: 30 }, () => 100);
    const { container } = render(
      <RowSparkline
        ticker="AAPL"
        name="Apple"
        range="30D"
        series={{ ...baseSeries, points, firstClose: 100, lastClose: 100 }}
      />,
    );
    const path = container.querySelector("path");
    // Path should only contain a horizontal stroke — same y across all segments.
    const ys = (path?.getAttribute("d") ?? "")
      .split(/[ML]/)
      .filter(Boolean)
      .map((p) => Number(p.trim().split(/\s+/)[1]));
    const unique = new Set(ys.map((y) => Math.round(y)));
    expect(unique.size).toBe(1);
  });

  it("includes an aria-label with ticker + range + last-close", () => {
    const points = Array.from({ length: 30 }, (_, i) => 100 + i);
    const { container } = render(
      <RowSparkline
        ticker="AAPL"
        name="Apple"
        range="1Y"
        series={{ ...baseSeries, points, lastClose: 129 }}
      />,
    );
    const label = container.querySelector("[role='img']")?.getAttribute("aria-label") ?? "";
    expect(label).toContain("AAPL");
    expect(label).toContain("1Y");
    expect(label).toContain("129");
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

Run: `npx vitest run app/app/portfolio/_components/__tests__/row-sparkline.test.tsx 2>&1 | tail -8`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the component**

```tsx
// dividendmapper/app/app/portfolio/_components/row-sparkline.tsx
// Server-rendered SVG sparkline for one holding row. Reuses the line-path math
// from price-nav-sparkline.tsx, sized for an inline table cell.

import type { SparklineRange, SparklineSeries } from "@/lib/portfolio/load-sparkline-series";

const VB_W = 120;
const VB_H = 40;
const PAD_X = 2;
const PAD_Y = 4;

interface Props {
  ticker: string;
  name?: string;
  range: SparklineRange;
  series: SparklineSeries | null;
}

export function RowSparkline({ ticker, name, range, series }: Props) {
  if (!series || series.points.length < 8) {
    return (
      <span
        className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
        title="Price history collects after the next nightly update."
      >
        Collecting…
      </span>
    );
  }

  const { points, lastClose, currency } = series;
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const range_v = hi - lo;
  const innerW = VB_W - 2 * PAD_X;
  const innerH = VB_H - 2 * PAD_Y;

  const x = (i: number) => PAD_X + (i / (points.length - 1)) * innerW;
  const y = (v: number) =>
    range_v === 0
      ? PAD_Y + innerH / 2
      : PAD_Y + innerH - ((v - lo) / range_v) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p).toFixed(1)}`)
    .join(" ");

  // Gradient fill clipped to under the line: append a closing path to the baseline.
  const areaPath =
    `${linePath} L ${x(points.length - 1).toFixed(1)} ${(VB_H - PAD_Y).toFixed(1)} ` +
    `L ${x(0).toFixed(1)} ${(VB_H - PAD_Y).toFixed(1)} Z`;

  const lastX = x(points.length - 1);
  const lastY = y(lastClose);
  const gradId = `spark-grad-${ticker.replace(/[^a-z0-9]/gi, "")}`;
  const labelNum = Number.isFinite(lastClose) ? lastClose.toFixed(2) : String(lastClose);

  return (
    <div
      role="img"
      aria-label={`${name ?? ticker} ${range} price line, ended at ${labelNum} ${currency}`}
      className="inline-block text-brand-500"
    >
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block h-10 w-[120px]" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        <path d={linePath} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lastX} cy={lastY} r={1.8} fill="currentColor" />
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Run test — confirm it passes**

Run: `npx vitest run app/app/portfolio/_components/__tests__/row-sparkline.test.tsx 2>&1 | tail -8`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/row-sparkline.tsx \
        dividendmapper/app/app/portfolio/_components/__tests__/row-sparkline.test.tsx
git commit -m "feat(portfolio): RowSparkline SVG with collecting + flat edge cases"
```

---

## Task 10: RangeToggle component

**Files:**
- Create: `dividendmapper/app/app/portfolio/_components/range-toggle.tsx`
- Create: `dividendmapper/app/app/portfolio/_components/__tests__/range-toggle.test.tsx`

The pattern matches the existing `holdings-table.tsx` sort hookup: `useSyncExternalStore` over a `localStorage` key + a custom-event broadcast.

- [ ] **Step 1: Write the failing test**

```tsx
// dividendmapper/app/app/portfolio/_components/__tests__/range-toggle.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { RangeToggle, readStoredRange, RANGE_STORAGE_KEY, RANGE_CHANGE_EVENT } from "../range-toggle";

beforeEach(() => {
  window.localStorage.clear();
});

describe("readStoredRange", () => {
  it("returns 30D when nothing stored", () => {
    expect(readStoredRange()).toBe("30D");
  });
  it("returns the stored value when valid", () => {
    window.localStorage.setItem(RANGE_STORAGE_KEY, "1Y");
    expect(readStoredRange()).toBe("1Y");
  });
  it("returns 30D when an invalid value is stored", () => {
    window.localStorage.setItem(RANGE_STORAGE_KEY, "bogus");
    expect(readStoredRange()).toBe("30D");
  });
});

describe("RangeToggle", () => {
  it("renders three buttons labelled 30D / 1Y / 5Y", () => {
    const { getByRole } = render(<RangeToggle />);
    for (const label of ["30D", "1Y", "5Y"]) {
      expect(getByRole("button", { name: label })).toBeDefined();
    }
  });

  it("highlights the active range as aria-pressed=true", () => {
    window.localStorage.setItem(RANGE_STORAGE_KEY, "1Y");
    const { getByRole } = render(<RangeToggle />);
    expect(getByRole("button", { name: "1Y" }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole("button", { name: "30D" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("persists the choice + broadcasts the custom event on click", () => {
    let fired = 0;
    window.addEventListener(RANGE_CHANGE_EVENT, () => { fired++; });
    const { getByRole } = render(<RangeToggle />);
    act(() => { fireEvent.click(getByRole("button", { name: "5Y" })); });
    expect(window.localStorage.getItem(RANGE_STORAGE_KEY)).toBe("5Y");
    expect(fired).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

Run: `npx vitest run app/app/portfolio/_components/__tests__/range-toggle.test.tsx 2>&1 | tail -8`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the component**

```tsx
// dividendmapper/app/app/portfolio/_components/range-toggle.tsx
"use client";

import { useSyncExternalStore } from "react";
import type { SparklineRange } from "@/lib/portfolio/load-sparkline-series";

export const RANGE_STORAGE_KEY = "dm.holdings-sparkline-range";
export const RANGE_CHANGE_EVENT = "dm:holdings-range-change";
const RANGES: SparklineRange[] = ["30D", "1Y", "5Y"];
const VALID = new Set<string>(RANGES);

export function readStoredRange(): SparklineRange {
  if (typeof window === "undefined") return "30D";
  const v = window.localStorage.getItem(RANGE_STORAGE_KEY);
  return v && VALID.has(v) ? (v as SparklineRange) : "30D";
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === RANGE_STORAGE_KEY) cb(); };
  const onCustom = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(RANGE_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(RANGE_CHANGE_EVENT, onCustom);
  };
}

const getServerRange = (): SparklineRange => "30D";

export function RangeToggle() {
  const range = useSyncExternalStore(subscribe, readStoredRange, getServerRange);

  const setRange = (next: SparklineRange) => {
    try {
      window.localStorage.setItem(RANGE_STORAGE_KEY, next);
      window.dispatchEvent(new Event(RANGE_CHANGE_EVENT));
    } catch {
      // Private mode / storage disabled — runtime falls back to default 30D.
    }
  };

  return (
    <div
      role="group"
      aria-label="Sparkline range"
      className="inline-flex items-center rounded-md border border-border bg-card p-0.5"
    >
      {RANGES.map((r) => {
        const active = r === range;
        return (
          <button
            key={r}
            type="button"
            aria-pressed={active}
            onClick={() => setRange(r)}
            className={`rounded-sm px-2 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test — confirm it passes**

Run: `npx vitest run app/app/portfolio/_components/__tests__/range-toggle.test.tsx 2>&1 | tail -8`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/range-toggle.tsx \
        dividendmapper/app/app/portfolio/_components/__tests__/range-toggle.test.tsx
git commit -m "feat(portfolio): RangeToggle 30D/1Y/5Y with localStorage + custom event"
```

---

## Task 11: DensityToggle component

**Files:**
- Create: `dividendmapper/app/app/portfolio/_components/density-toggle.tsx`
- Create: `dividendmapper/app/app/portfolio/_components/__tests__/density-toggle.test.tsx`

Mirrors the RangeToggle pattern. Two states: `comfortable` | `compact`.

- [ ] **Step 1: Write the failing test**

```tsx
// dividendmapper/app/app/portfolio/_components/__tests__/density-toggle.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { DensityToggle, readStoredDensity, DENSITY_STORAGE_KEY, DENSITY_CHANGE_EVENT } from "../density-toggle";

beforeEach(() => {
  window.localStorage.clear();
});

describe("DensityToggle", () => {
  it("defaults to comfortable", () => {
    expect(readStoredDensity()).toBe("comfortable");
  });

  it("toggles between comfortable and compact on click", () => {
    let fired = 0;
    window.addEventListener(DENSITY_CHANGE_EVENT, () => { fired++; });
    const { getByRole } = render(<DensityToggle />);
    const btn = getByRole("button");
    act(() => { fireEvent.click(btn); });
    expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("compact");
    act(() => { fireEvent.click(btn); });
    expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("comfortable");
    expect(fired).toBe(2);
  });

  it("announces current state via aria-pressed", () => {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, "compact");
    const { getByRole } = render(<DensityToggle />);
    expect(getByRole("button").getAttribute("aria-pressed")).toBe("true");
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

Run: `npx vitest run app/app/portfolio/_components/__tests__/density-toggle.test.tsx 2>&1 | tail -8`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the component**

```tsx
// dividendmapper/app/app/portfolio/_components/density-toggle.tsx
"use client";

import { useSyncExternalStore } from "react";
import { Rows3, Rows4 } from "lucide-react";

export type Density = "comfortable" | "compact";

export const DENSITY_STORAGE_KEY = "dm.holdings-density";
export const DENSITY_CHANGE_EVENT = "dm:holdings-density-change";
const VALID = new Set<string>(["comfortable", "compact"]);

export function readStoredDensity(): Density {
  if (typeof window === "undefined") return "comfortable";
  const v = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  return v && VALID.has(v) ? (v as Density) : "comfortable";
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === DENSITY_STORAGE_KEY) cb(); };
  const onCustom = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(DENSITY_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DENSITY_CHANGE_EVENT, onCustom);
  };
}

const getServerDensity = (): Density => "comfortable";

export function DensityToggle() {
  const density = useSyncExternalStore(subscribe, readStoredDensity, getServerDensity);

  const toggle = () => {
    const next: Density = density === "comfortable" ? "compact" : "comfortable";
    try {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, next);
      window.dispatchEvent(new Event(DENSITY_CHANGE_EVENT));
    } catch {}
  };

  const Icon = density === "compact" ? Rows4 : Rows3;
  return (
    <button
      type="button"
      aria-pressed={density === "compact"}
      aria-label={`Density: ${density} (click to toggle)`}
      title={`Density: ${density}`}
      onClick={toggle}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
```

- [ ] **Step 4: Run test — confirm it passes**

Run: `npx vitest run app/app/portfolio/_components/__tests__/density-toggle.test.tsx 2>&1 | tail -8`
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/density-toggle.tsx \
        dividendmapper/app/app/portfolio/_components/__tests__/density-toggle.test.tsx
git commit -m "feat(portfolio): DensityToggle with comfortable/compact + localStorage"
```

---

## Task 12: WrapperFilterChips component

**Files:**
- Create: `dividendmapper/app/app/portfolio/_components/wrapper-filter-chips.tsx`
- Create: `dividendmapper/app/app/portfolio/_components/__tests__/wrapper-filter-chips.test.tsx`

Filter chips for the wrappers actually present in the user's portfolio. URL-driven (`?wrapper=isa`) so the filtered view is shareable / back-button-able.

- [ ] **Step 1: Write the failing test**

```tsx
// dividendmapper/app/app/portfolio/_components/__tests__/wrapper-filter-chips.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { WrapperFilterChips } from "../wrapper-filter-chips";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/app/portfolio",
}));

describe("WrapperFilterChips", () => {
  it("renders nothing when only one wrapper is present", () => {
    const { container } = render(
      <WrapperFilterChips present={["isa"]} active={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders an All chip + one chip per present wrapper, in known order", () => {
    const { getAllByRole } = render(
      <WrapperFilterChips present={["sipp", "gia", "isa"]} active={null} />,
    );
    const labels = getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(["All", "ISA", "SIPP", "GIA"]);
  });

  it("renders US-style wrappers in their own order", () => {
    const { getAllByRole } = render(
      <WrapperFilterChips present={["brokerage", "401k", "roth_ira"]} active={null} />,
    );
    const labels = getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(["All", "401(k)", "Roth IRA", "Brokerage"]);
  });

  it("highlights the active chip", () => {
    const { getByRole } = render(
      <WrapperFilterChips present={["isa", "gia"]} active="isa" />,
    );
    expect(getByRole("button", { name: "ISA" }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("pushes ?wrapper= on click", () => {
    pushMock.mockClear();
    const { getByRole } = render(
      <WrapperFilterChips present={["isa", "gia"]} active={null} />,
    );
    fireEvent.click(getByRole("button", { name: "ISA" }));
    expect(pushMock).toHaveBeenCalledWith("/app/portfolio?wrapper=isa", { scroll: false });
  });

  it("clears the param when All is clicked", () => {
    pushMock.mockClear();
    const { getByRole } = render(
      <WrapperFilterChips present={["isa", "gia"]} active="isa" />,
    );
    fireEvent.click(getByRole("button", { name: "All" }));
    expect(pushMock).toHaveBeenCalledWith("/app/portfolio", { scroll: false });
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

Run: `npx vitest run app/app/portfolio/_components/__tests__/wrapper-filter-chips.test.tsx 2>&1 | tail -8`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the component**

```tsx
// dividendmapper/app/app/portfolio/_components/wrapper-filter-chips.tsx
"use client";

import { useRouter, usePathname } from "next/navigation";

const WRAPPER_LABEL: Record<string, string> = {
  isa: "ISA",
  sipp: "SIPP",
  gia: "GIA",
  "401k": "401(k)",
  ira: "IRA",
  roth_ira: "Roth IRA",
  brokerage: "Brokerage",
};

// Fixed display order so the chip row doesn't rearrange as holdings change.
const DISPLAY_ORDER = ["isa", "sipp", "gia", "401k", "ira", "roth_ira", "brokerage"];

interface Props {
  /** Distinct wrappers actually present in the user's visible holdings. */
  present: string[];
  /** The currently active wrapper filter, or null for "All". */
  active: string | null;
}

export function WrapperFilterChips({ present, active }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  if (present.length < 2) return null;

  const ordered = DISPLAY_ORDER.filter((w) => present.includes(w));

  const setActive = (wrapper: string | null) => {
    const url = wrapper ? `${pathname}?wrapper=${wrapper}` : pathname;
    router.push(url, { scroll: false });
  };

  return (
    <div role="group" aria-label="Filter by wrapper" className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        aria-pressed={active === null}
        onClick={() => setActive(null)}
        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
          active === null
            ? "border-brand-500/40 bg-brand-50 text-brand-700 dark:border-brand-400/30 dark:bg-brand-900/20 dark:text-brand-300"
            : "border-border bg-card text-muted-foreground hover:text-foreground"
        }`}
      >
        All
      </button>
      {ordered.map((w) => {
        const isActive = active === w;
        return (
          <button
            key={w}
            type="button"
            aria-pressed={isActive}
            onClick={() => setActive(w)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
              isActive
                ? "border-brand-500/40 bg-brand-50 text-brand-700 dark:border-brand-400/30 dark:bg-brand-900/20 dark:text-brand-300"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {WRAPPER_LABEL[w] ?? w}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test — confirm it passes**

Run: `npx vitest run app/app/portfolio/_components/__tests__/wrapper-filter-chips.test.tsx 2>&1 | tail -8`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/wrapper-filter-chips.tsx \
        dividendmapper/app/app/portfolio/_components/__tests__/wrapper-filter-chips.test.tsx
git commit -m "feat(portfolio): WrapperFilterChips URL-driven, dynamic per portfolio"
```

---

## Task 13: PortfolioBar component (inline % of portfolio bar)

**Files:**
- Create: `dividendmapper/app/app/portfolio/_components/portfolio-bar.tsx`
- Create: `dividendmapper/app/app/portfolio/_components/__tests__/portfolio-bar.test.tsx`

A 2px-tall fill behind the Value cell. Width = `value / totalVisibleValue`, capped at 100%.

- [ ] **Step 1: Write the failing test**

```tsx
// dividendmapper/app/app/portfolio/_components/__tests__/portfolio-bar.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PortfolioBar, percentOfPortfolio } from "../portfolio-bar";

describe("percentOfPortfolio", () => {
  it("returns 0 when total is zero", () => {
    expect(percentOfPortfolio(100, 0)).toBe(0);
  });
  it("returns the ratio when total > 0", () => {
    expect(percentOfPortfolio(50, 200)).toBeCloseTo(0.25);
  });
  it("caps at 1 when value exceeds total", () => {
    expect(percentOfPortfolio(300, 200)).toBe(1);
  });
});

describe("PortfolioBar", () => {
  it("renders nothing when totalValue is zero", () => {
    const { container } = render(<PortfolioBar value={100} totalValue={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a positioned div with the right width %", () => {
    const { container } = render(<PortfolioBar value={50} totalValue={200} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("25%");
  });

  it("renders a tooltip showing the rounded percent", () => {
    const { container } = render(<PortfolioBar value={50} totalValue={200} />);
    expect((container.firstChild as HTMLElement).title).toBe("25% of visible portfolio value");
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

Run: `npx vitest run app/app/portfolio/_components/__tests__/portfolio-bar.test.tsx 2>&1 | tail -8`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the component**

```tsx
// dividendmapper/app/app/portfolio/_components/portfolio-bar.tsx
// Inline % of portfolio bar rendered absolutely under the Value cell figure.

export function percentOfPortfolio(value: number, total: number): number {
  if (total <= 0 || !Number.isFinite(total) || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value / total));
}

interface Props {
  value: number;
  totalValue: number;
}

export function PortfolioBar({ value, totalValue }: Props) {
  if (totalValue <= 0) return null;
  const pct = percentOfPortfolio(value, totalValue);
  const widthPct = Math.round(pct * 1000) / 10; // one decimal
  const display = `${Math.round(pct * 100)}% of visible portfolio value`;
  return (
    <span
      aria-hidden="true"
      title={display}
      className="pointer-events-none absolute inset-x-0 bottom-1 mx-3 h-[2px] rounded-full bg-gradient-to-r from-brand-500/30 to-brand-500/0"
      style={{ width: `${widthPct}%` }}
    />
  );
}
```

- [ ] **Step 4: Run test — confirm it passes**

Run: `npx vitest run app/app/portfolio/_components/__tests__/portfolio-bar.test.tsx 2>&1 | tail -8`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/portfolio-bar.tsx \
        dividendmapper/app/app/portfolio/_components/__tests__/portfolio-bar.test.tsx
git commit -m "feat(portfolio): PortfolioBar inline %-of-portfolio fill"
```

---

## Task 14: Extract HoldingRow from holdings-table.tsx (no behaviour change)

**Files:**
- Modify: `dividendmapper/app/app/portfolio/_components/holdings-table.tsx`
- Create: `dividendmapper/app/app/portfolio/_components/holding-row.tsx`

Pure refactor: pull the per-row JSX from `holdings-table.tsx` into its own `<HoldingRow>` so subsequent tasks have a manageable surface to edit. No behaviour or markup change.

- [ ] **Step 1: Extract the row**

In `dividendmapper/app/app/portfolio/_components/holding-row.tsx`, define `<HoldingRow>` accepting the same props the current per-row JSX reads:

```tsx
// dividendmapper/app/app/portfolio/_components/holding-row.tsx
"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { QuoteResult } from "@/lib/market/quote";
import type { HoldingScore } from "@/lib/scoring/portfolio-scores";
import type { ScoreType } from "@/lib/scoring/chip-display";
import { resolveRowIncome } from "@/lib/portfolio/row-income";
import { resolveRowValue, type TickerPrice } from "@/lib/portfolio/row-value";
import { actualKey, type ActualIncome } from "@/lib/portfolio/income";
import { ScoreChip } from "./score-chip";
import { UpgradePill } from "./upgrade-pill";
import { VehicleChip } from "./vehicle-chip";
import type { VehicleChipData } from "./holdings-table";

// ... copy the existing per-row markup verbatim from holdings-table.tsx,
// wrapping it in: export function HoldingRow(props: { ...the row's props })
```

Paste the existing `<tr>` JSX block (lines ~512-587 of the current file) and the helper sub-components it uses (`BrokerCell`, `ScoreChipStack`, `MobileScorePill`, `PendingScorePill`, `IncomeCell`, `ValueCell`, `ReceivedCell`, `formatQuantity`, `formatCost`, `formatIncome`, `WRAPPER_LABEL`, `CURRENCY_PREFIX`) into `holding-row.tsx`. Re-export them only if `holdings-table.tsx` still needs them after the cut.

- [ ] **Step 2: Replace the inline row in holdings-table.tsx with the new component**

Inside the desktop `<tbody>` map, replace the existing `<tr>…</tr>` block with `<HoldingRow row={row} … />`. Pass the same props that the row's JSX previously closed over.

- [ ] **Step 3: Run the existing holdings-table tests**

Run: `npx vitest run app/app/portfolio/_components/__tests__/holdings-table.test.tsx 2>&1 | tail -8`
Expected: all existing tests still pass — no behaviour change.

If any test imports a helper that moved into `holding-row.tsx`, update the import path.

- [ ] **Step 4: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/holding-row.tsx \
        dividendmapper/app/app/portfolio/_components/holdings-table.tsx
git commit -m "refactor(portfolio): extract HoldingRow from holdings-table"
```

---

## Task 15: Drop the Scores + Wrapper columns and prepare new column slots

**Files:**
- Modify: `dividendmapper/app/app/portfolio/_components/holdings-table.tsx`
- Modify: `dividendmapper/app/app/portfolio/_components/holding-row.tsx`
- Modify: `dividendmapper/app/app/portfolio/_components/__tests__/holdings-table.test.tsx`

- [ ] **Step 1: Update the existing tests to reflect the new column set**

Open `dividendmapper/app/app/portfolio/_components/__tests__/holdings-table.test.tsx`. Any test asserting on the presence of a "Scores" or "Wrapper" `<th>` should be flipped to assert *absence*. Any test asserting on the Vehicle resilience chip should be removed (chip moves out of the table).

Add a new test:

```ts
it("does not render Scores or Wrapper column headers on /app/portfolio", () => {
  const { queryByRole } = renderWithProps({ /* baseline */ });
  expect(queryByRole("columnheader", { name: /scores/i })).toBeNull();
  expect(queryByRole("columnheader", { name: /^wrapper$/i })).toBeNull();
});

it("renders the Sparkline column header (visually hidden)", () => {
  const { getAllByRole } = renderWithProps({ /* baseline */ });
  // The header may be visually-hidden with sr-only; the role still exists.
  const headers = getAllByRole("columnheader").map((h) => h.textContent?.toLowerCase());
  expect(headers).toContain("sparkline");
});
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `npx vitest run app/app/portfolio/_components/__tests__/holdings-table.test.tsx 2>&1 | tail -10`
Expected: the two new tests fail; previous Scores / Wrapper tests now also fail (they assert positives we no longer want).

- [ ] **Step 3: Remove Wrapper + Scores from the desktop `<thead>`**

In `holdings-table.tsx`, delete the `<th>Wrapper</th>` and the `{showScoresColumn && <th>Scores</th>}` blocks. Insert a new visually-hidden Sparkline header right after the Ticker header:

```tsx
<th scope="col" className="w-[140px] px-2 py-3">
  <span className="sr-only">Sparkline</span>
</th>
```

- [ ] **Step 4: Remove Wrapper + Scores cells from `<HoldingRow>`**

In `holding-row.tsx`, delete the two `<td>` blocks (Wrapper pill, Scores cell). Insert an empty Sparkline cell in the same position:

```tsx
<td className="w-[140px] px-2 py-3">
  {/* Sparkline lands in Task 17 */}
</td>
```

Drop the `vehicle`, `score`, `vehicleScoresByTicker`, `scoresByTicker`, `showScoresColumn`, `showScores`, `isFree`, `pricingPublic`, `isBeta`, `handleOpenScore`, `handleOpenVehicleScore` props from `<HoldingRow>` — and propagate the removal up to `<HoldingsTable>`.

Also remove the now-unused imports (`ScoreChip`, `VehicleChip`, `UpgradePill`, `ScoreChipStack`, `PendingScorePill`, score drawer state, ScoreDrawer JSX block) from `holdings-table.tsx`.

- [ ] **Step 5: Run tests — confirm they pass**

Run: `npx vitest run app/app/portfolio/_components/__tests__/holdings-table.test.tsx 2>&1 | tail -10`
Expected: all tests pass (including the two new assertions about absent Scores/Wrapper columns and a present Sparkline slot).

- [ ] **Step 6: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/holdings-table.tsx \
        dividendmapper/app/app/portfolio/_components/holding-row.tsx \
        dividendmapper/app/app/portfolio/_components/__tests__/holdings-table.test.tsx
git commit -m "feat(portfolio): drop Scores+Wrapper columns, reserve Sparkline slot"
```

---

## Task 16: HoldingLogo + ticker cell composition (the doorway)

**Files:**
- Modify: `dividendmapper/app/app/portfolio/_components/holding-row.tsx`
- Modify: `dividendmapper/app/app/portfolio/_components/__tests__/holdings-table.test.tsx`

- [ ] **Step 1: Extend the test**

Add to `__tests__/holdings-table.test.tsx`:

```ts
it("renders a HoldingLogo at the start of each row, followed by ticker + name + wrapper line", () => {
  const { container } = renderWithProps({
    rows: [{
      id: "1", ticker: "AAPL", quantity: 1, avg_cost: 100, cost_currency: "USD",
      wrapper: "isa", broker_label: null, notes: null, created_at: "2026-01-01",
    }],
    nameByTicker: { AAPL: "Apple Inc." },
  });
  const tickerCell = container.querySelector("[data-testid='row-ticker-cell-AAPL']");
  expect(tickerCell).not.toBeNull();
  expect(tickerCell?.textContent).toContain("AAPL");
  expect(tickerCell?.textContent).toContain("Apple Inc.");
  expect(tickerCell?.textContent).toContain("ISA · USD");
  // Logo is rendered before the text content
  expect(tickerCell?.querySelector("img,[role='img']")).not.toBeNull();
});
```

- [ ] **Step 2: Run test — confirm it fails**

Run: `npx vitest run app/app/portfolio/_components/__tests__/holdings-table.test.tsx -t "renders a HoldingLogo" 2>&1 | tail -8`
Expected: FAIL.

- [ ] **Step 3: Wire the logo + ticker block in HoldingRow**

In `holding-row.tsx`, replace the ticker `<td>` body with:

```tsx
<td data-testid={`row-ticker-cell-${row.ticker}`} className="px-4 py-3">
  <div className="flex items-center gap-3">
    <HoldingLogo ticker={row.ticker} name={nameByTicker?.[row.ticker]} />
    <div className="min-w-0">
      <span className="block font-mono text-sm font-medium text-foreground">
        {row.ticker}
      </span>
      {nameByTicker?.[row.ticker] && (
        <span className="mt-0.5 block max-w-[14rem] truncate text-xs text-muted-foreground">
          {nameByTicker[row.ticker]}
        </span>
      )}
      <span className="mt-0.5 block text-[11px] uppercase tracking-wider text-muted-foreground/80">
        {WRAPPER_LABEL[row.wrapper] ?? row.wrapper} · {row.cost_currency}
      </span>
    </div>
  </div>
</td>
```

Add the import at the top:
```tsx
import { HoldingLogo } from "./holding-logo";
```

- [ ] **Step 4: Run test — confirm it passes**

Run: `npx vitest run app/app/portfolio/_components/__tests__/holdings-table.test.tsx 2>&1 | tail -8`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/holding-row.tsx \
        dividendmapper/app/app/portfolio/_components/__tests__/holdings-table.test.tsx
git commit -m "feat(portfolio): render HoldingLogo + name + wrapper-line in ticker cell"
```

---

## Task 17: Wire RowSparkline into HoldingRow

**Files:**
- Modify: `dividendmapper/app/app/portfolio/_components/holdings-table.tsx`
- Modify: `dividendmapper/app/app/portfolio/_components/holding-row.tsx`
- Modify: `dividendmapper/app/app/portfolio/_components/__tests__/holdings-table.test.tsx`

- [ ] **Step 1: Extend the test**

Add to the existing holdings-table test:

```ts
it("renders the RowSparkline in the sparkline cell when series data is present", () => {
  const points = Array.from({ length: 30 }, (_, i) => 100 + i);
  const { container } = renderWithProps({
    rows: [{ id: "1", ticker: "AAPL", quantity: 1, avg_cost: 100, cost_currency: "USD",
            wrapper: "isa", broker_label: null, notes: null, created_at: "2026-01-01" }],
    sparklineByTicker: new Map([["AAPL", { points, firstClose: 100, lastClose: 129, currency: "USD" }]]),
  });
  expect(container.querySelector("svg")).not.toBeNull();
});

it("renders the Collecting pill when a row has no sparkline series", () => {
  const { container } = renderWithProps({
    rows: [{ id: "1", ticker: "AAPL", quantity: 1, avg_cost: 100, cost_currency: "USD",
            wrapper: "isa", broker_label: null, notes: null, created_at: "2026-01-01" }],
    sparklineByTicker: new Map(),
  });
  expect(container.textContent).toContain("Collecting");
});
```

- [ ] **Step 2: Run test — confirm it fails**

Run: `npx vitest run app/app/portfolio/_components/__tests__/holdings-table.test.tsx 2>&1 | tail -10`
Expected: FAIL.

- [ ] **Step 3: Add `sparklineByTicker` + `sparklineRange` plumbing**

Open `holdings-table.tsx`. Extend `HoldingsTableProps`:

```ts
import type { SparklineRange, SparklineSeries } from "@/lib/portfolio/load-sparkline-series";
// ...
sparklineByTicker?: Map<string, SparklineSeries>;
```

Inside `HoldingsTable`, read the active range from localStorage with the existing `useSyncExternalStore` pattern — copy the `RANGE_STORAGE_KEY` / `RANGE_CHANGE_EVENT` constants from `range-toggle.tsx`. Pass `range` + the per-row series down to `<HoldingRow>`.

In `holding-row.tsx`, swap the empty Sparkline cell for:

```tsx
import { RowSparkline } from "./row-sparkline";
// ...
<td className="w-[140px] px-2 py-3">
  <RowSparkline
    ticker={row.ticker}
    name={nameByTicker?.[row.ticker]}
    range={sparklineRange}
    series={sparklineSeries ?? null}
  />
</td>
```

- [ ] **Step 4: Run test — confirm it passes**

Run: `npx vitest run app/app/portfolio/_components/__tests__/holdings-table.test.tsx 2>&1 | tail -10`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/holdings-table.tsx \
        dividendmapper/app/app/portfolio/_components/holding-row.tsx \
        dividendmapper/app/app/portfolio/_components/__tests__/holdings-table.test.tsx
git commit -m "feat(portfolio): wire RowSparkline + sparklineByTicker into holdings table"
```

---

## Task 18: 2dp quantity & cost + PortfolioBar in Value cell

**Files:**
- Modify: `dividendmapper/lib/portfolio/format-money.ts`
- Modify: `dividendmapper/lib/portfolio/__tests__/format-money.test.ts` (extend or create)
- Modify: `dividendmapper/app/app/portfolio/_components/holding-row.tsx`
- Modify: `dividendmapper/app/app/portfolio/_components/holdings-table.tsx`
- Modify: `dividendmapper/app/app/portfolio/_components/__tests__/holdings-table.test.tsx`

- [ ] **Step 1: Extend formatMoney to accept an optional dp**

The current `formatMoney(amount, currency)` rounds to the nearest whole number. We need a 2dp variant for Avg cost and a 2dp variant for `Quantity` (formatted via a new helper).

Add (or replace, if a `format-money.test.ts` already exists) a test:

```ts
// dividendmapper/lib/portfolio/__tests__/format-money.test.ts
import { describe, it, expect } from "vitest";
import { formatMoney } from "../format-money";

describe("formatMoney", () => {
  it("rounds to whole units when no dp option", () => {
    expect(formatMoney(1727.49, "USD")).toBe("$1,727");
  });
  it("formats with dp when supplied", () => {
    expect(formatMoney(54.9031, "USD", { dp: 2 })).toBe("$54.90");
    expect(formatMoney(2.138, "GBP", { dp: 2 })).toBe("£2.14");
  });
  it("falls back to trailing ISO for unknown currency", () => {
    expect(formatMoney(100.5, "ZAR", { dp: 2 })).toBe("100.50 ZAR");
  });
});
```

Update `format-money.ts`:

```ts
const CURRENCY_PREFIX: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
};

export function formatMoney(amount: number, currency: string, opts?: { dp?: number }): string {
  const prefix = CURRENCY_PREFIX[currency] ?? "";
  if (opts?.dp != null) {
    const formatted = amount.toLocaleString("en-GB", {
      minimumFractionDigits: opts.dp,
      maximumFractionDigits: opts.dp,
    });
    return prefix ? `${prefix}${formatted}` : `${formatted} ${currency}`;
  }
  const formatted = Math.round(amount).toLocaleString("en-GB");
  return prefix ? `${prefix}${formatted}` : `${formatted} ${currency}`;
}
```

Run: `npx vitest run lib/portfolio/__tests__/format-money.test.ts 2>&1 | tail -8`
Expected: all pass.

- [ ] **Step 2: Extend the holdings-table test for 2dp + bar**

Add:

```ts
it("renders Quantity to 2dp with full-precision title", () => {
  const { container } = renderWithProps({
    rows: [{ id: "1", ticker: "TW.L", quantity: 994.790201, avg_cost: 0.9968,
            cost_currency: "GBP", wrapper: "isa", broker_label: null, notes: null, created_at: "2026-01-01" }],
  });
  const cell = container.querySelector("[data-testid='row-quantity-1']") as HTMLElement;
  expect(cell.textContent).toBe("994.79");
  expect(cell.title).toContain("994.790201");
});

it("renders Avg cost to 2dp", () => {
  const { container } = renderWithProps({
    rows: [{ id: "1", ticker: "TW.L", quantity: 1, avg_cost: 0.9968,
            cost_currency: "GBP", wrapper: "isa", broker_label: null, notes: null, created_at: "2026-01-01" }],
  });
  expect(container.querySelector("[data-testid='row-cost-1']")?.textContent).toBe("£1.00");
});

it("renders the PortfolioBar inside the Value cell when totals are present", () => {
  const { container } = renderWithProps({
    rows: [
      { id: "1", ticker: "AAPL", quantity: 10, avg_cost: 100, cost_currency: "USD",
        wrapper: "isa", broker_label: null, notes: null, created_at: "2026-01-01" },
    ],
    priceByTicker: { AAPL: { displayPrice: 200, currency: "USD" } },
  });
  const valueCell = container.querySelector("[data-testid='row-value-1']") as HTMLElement;
  expect(valueCell.querySelector("[aria-hidden='true']")).not.toBeNull();
});
```

Run the tests — confirm they fail with the current row rendering.

- [ ] **Step 3: Round Quantity + Avg cost in HoldingRow**

Replace `formatQuantity(...)` + `formatCost(...)` calls in `holding-row.tsx` with:

```tsx
<td
  data-testid={`row-quantity-${row.id}`}
  title={String(row.quantity)}
  className="w-px whitespace-nowrap px-3 py-3 text-right font-mono text-foreground"
>
  {Number(row.quantity).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
</td>
<td
  data-testid={`row-cost-${row.id}`}
  title={String(row.avg_cost)}
  className="w-px whitespace-nowrap px-3 py-3 text-right font-mono text-foreground"
>
  {formatMoney(Number(row.avg_cost), row.cost_currency, { dp: 2 })}
</td>
```

Remove the now-unused `formatQuantity` and `formatCost` helpers from `holding-row.tsx`.

- [ ] **Step 4: Compute totalValue in HoldingsTable and inject PortfolioBar into the Value cell**

In `holdings-table.tsx`, after `sortedRows` is computed, also derive:

```ts
const totalVisibleValue = useMemo(() => {
  let sum = 0;
  for (const r of sortedRows) {
    const v = resolveRowValue(r, priceByTicker ?? {});
    if (v.kind === "ok") sum += v.amount;
  }
  return sum;
}, [sortedRows, priceByTicker]);
```

Pass `totalVisibleValue` into `<HoldingRow>`. In `holding-row.tsx`, wrap the Value cell:

```tsx
<td data-testid={`row-value-${row.id}`} className="relative w-px whitespace-nowrap px-3 py-3 text-right text-sm">
  <ValueCell status={valueStatus} />
  {valueStatus.kind === "ok" && (
    <PortfolioBar value={valueStatus.amount} totalValue={totalVisibleValue} />
  )}
</td>
```

Import `PortfolioBar` at the top.

- [ ] **Step 5: Run tests — confirm they pass**

Run: `npx vitest run app/app/portfolio/_components/__tests__/holdings-table.test.tsx 2>&1 | tail -10`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add dividendmapper/lib/portfolio/format-money.ts \
        dividendmapper/lib/portfolio/__tests__/format-money.test.ts \
        dividendmapper/app/app/portfolio/_components/holding-row.tsx \
        dividendmapper/app/app/portfolio/_components/holdings-table.tsx \
        dividendmapper/app/app/portfolio/_components/__tests__/holdings-table.test.tsx
git commit -m "feat(portfolio): 2dp quantity & cost + PortfolioBar inside Value cell"
```

---

## Task 19: Whole-row click + text-selection guard + Edit placeholder

**Files:**
- Modify: `dividendmapper/app/app/portfolio/_components/holding-row.tsx`
- Modify: `dividendmapper/app/app/portfolio/_components/__tests__/holdings-table.test.tsx`

We use the programmatic-push pattern (the spec calls this out as the fallback that is actually safe under any Next 16 `<Link>`/`<tr>` constraint).

- [ ] **Step 1: Extend the test**

```ts
it("navigates to /app/portfolio/[ticker] when a row body is clicked", async () => {
  const pushMock = vi.fn();
  vi.mocked(useRouter).mockReturnValue({ push: pushMock, refresh: vi.fn() } as never);
  const { getByText } = renderWithProps({
    rows: [{ id: "1", ticker: "AAPL", quantity: 1, avg_cost: 100, cost_currency: "USD",
            wrapper: "isa", broker_label: null, notes: null, created_at: "2026-01-01" }],
  });
  fireEvent.click(getByText("AAPL"));
  expect(pushMock).toHaveBeenCalledWith("/app/portfolio/AAPL");
});

it("does NOT navigate when an action button is clicked", async () => {
  const pushMock = vi.fn();
  vi.mocked(useRouter).mockReturnValue({ push: pushMock, refresh: vi.fn() } as never);
  const { getByLabelText } = renderWithProps({
    rows: [{ id: "1", ticker: "AAPL", quantity: 1, avg_cost: 100, cost_currency: "USD",
            wrapper: "isa", broker_label: null, notes: null, created_at: "2026-01-01" }],
  });
  fireEvent.click(getByLabelText("Delete AAPL"));
  expect(pushMock).not.toHaveBeenCalled();
});

it("does NOT navigate when there is an active text selection inside the row", async () => {
  const pushMock = vi.fn();
  vi.mocked(useRouter).mockReturnValue({ push: pushMock, refresh: vi.fn() } as never);
  const { container } = renderWithProps({
    rows: [{ id: "1", ticker: "AAPL", quantity: 1, avg_cost: 100, cost_currency: "USD",
            wrapper: "isa", broker_label: null, notes: null, created_at: "2026-01-01" }],
  });
  const row = container.querySelector("tr[role='link']")!;
  // Simulate an active selection via mock
  const realGetSelection = window.getSelection;
  window.getSelection = () => ({
    toString: () => "$100",
    anchorNode: row,
  }) as never;
  fireEvent.click(row);
  expect(pushMock).not.toHaveBeenCalled();
  window.getSelection = realGetSelection;
});

it("renders an Edit placeholder that is disabled with title='Edit coming soon'", () => {
  const { getByLabelText } = renderWithProps({
    rows: [{ id: "1", ticker: "AAPL", quantity: 1, avg_cost: 100, cost_currency: "USD",
            wrapper: "isa", broker_label: null, notes: null, created_at: "2026-01-01" }],
  });
  const edit = getByLabelText("Edit AAPL") as HTMLButtonElement;
  expect(edit.getAttribute("aria-disabled")).toBe("true");
  expect(edit.title).toBe("Edit coming soon");
});
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `npx vitest run app/app/portfolio/_components/__tests__/holdings-table.test.tsx 2>&1 | tail -10`
Expected: FAIL on all four new tests.

- [ ] **Step 3: Convert `<tr>` to a row-link with selection guard + Edit slot**

In `holding-row.tsx`, hoist the router hook:

```tsx
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

const router = useRouter();

function handleRowClick(e: React.MouseEvent<HTMLTableRowElement>) {
  // Ignore clicks that originated from a button or link inside the row.
  const target = e.target as HTMLElement;
  if (target.closest("button, a, input")) return;
  // Ignore if the user is selecting text inside this row.
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  if (sel && sel.toString().length > 0 && e.currentTarget.contains(sel.anchorNode as Node)) return;
  router.push(`/app/portfolio/${row.ticker}`);
}

function handleRowKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    router.push(`/app/portfolio/${row.ticker}`);
  }
}
```

Update the `<tr>` opening tag:

```tsx
<tr
  role="link"
  tabIndex={0}
  onClick={handleRowClick}
  onKeyDown={handleRowKeyDown}
  aria-label={`Open ${row.ticker} details`}
  className={`group cursor-pointer border-b border-border last:border-b-0 transition-all hover:bg-secondary/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset ${pending ? "opacity-50" : ""}`}
>
```

Replace the ticker `<span>` (which was a Link) with a plain `<span>` (now that the whole row navigates):

```tsx
<span className="block font-mono text-sm font-medium text-foreground">{row.ticker}</span>
```

Add the Edit placeholder in the actions cell (before the existing Delete button):

```tsx
<td className="w-px whitespace-nowrap px-3 py-3 text-right">
  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
    <button
      type="button"
      aria-disabled="true"
      aria-label={`Edit ${row.ticker}`}
      title="Edit coming soon"
      onClick={(e) => { e.stopPropagation(); }}
      className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground opacity-50"
    >
      <Pencil className="h-4 w-4" aria-hidden="true" />
    </button>
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
      disabled={pending}
      aria-label={`Delete ${row.ticker}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
</td>
```

- [ ] **Step 4: Run tests — confirm they pass**

Run: `npx vitest run app/app/portfolio/_components/__tests__/holdings-table.test.tsx 2>&1 | tail -10`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/holding-row.tsx \
        dividendmapper/app/app/portfolio/_components/__tests__/holdings-table.test.tsx
git commit -m "feat(portfolio): whole-row click with selection guard + Edit placeholder slot"
```

---

## Task 20: Sortable column headers + sticky thead + bevel CSS

**Files:**
- Modify: `dividendmapper/app/app/portfolio/_components/holdings-table.tsx`
- Modify: `dividendmapper/app/app/portfolio/_components/holding-row.tsx`
- Modify: `dividendmapper/app/app/portfolio/_components/__tests__/holdings-table.test.tsx`
- Modify: `dividendmapper/app/app/portfolio/page.tsx` (only to remove the now-orphaned SortSelect import path on desktop)

- [ ] **Step 1: Extend the test**

```ts
it("clicking a sortable column header cycles its sort direction", async () => {
  const { getByRole } = renderWithProps({ /* baseline 3-row fixture */ });
  const valueHeader = getByRole("button", { name: /sort by value/i });
  fireEvent.click(valueHeader);
  expect(window.localStorage.getItem("dm.holdings-sort")).toBe("value");
});

it("does NOT render the standalone Sort dropdown on desktop", () => {
  const { queryByLabelText } = renderWithProps({});
  // The desktop control should be gone; the mobile SortSelect renders only via md:hidden.
  // Simplest check: the desktop label "Sort" is no longer in the document.
  expect(queryByLabelText("Sort")).toBeNull();
});
```

- [ ] **Step 2: Replace `<th>` text with sort-toggle buttons**

In `holdings-table.tsx`, for each sortable column (Quantity, Avg cost, Value, Income, Received), replace the plain text header with:

```tsx
<th scope="col" className="w-px whitespace-nowrap px-3 py-3 text-right">
  <button
    type="button"
    onClick={() => changeSort("value")}
    aria-label="Sort by Value"
    className="inline-flex items-center gap-1 text-[12px] font-medium leading-[16px] text-muted-foreground hover:text-foreground"
  >
    Value
    {sortKey === "value" && <ArrowDown className="h-3 w-3" aria-hidden="true" />}
  </button>
</th>
```

Import `ArrowDown` from `lucide-react`. Repeat the pattern for Quantity / Avg cost / Income / Received using the matching `SortKey`. Ticker header reuses `sortKey === "ticker"`.

- [ ] **Step 3: Remove the standalone desktop SortSelect**

Above the desktop table, delete the `<div className="mb-3 flex items-center justify-end gap-2">…</div>` block that wraps `<SortSelect …>`. Keep the same block inside the mobile `md:hidden` branch (cards have no header to click).

- [ ] **Step 4: Add sticky thead + inverted-bevel CSS**

Add a Tailwind utility class on the `<thead>`:

```tsx
<thead className="sticky top-[var(--app-shell-topbar-height,0px)] z-[5] border-b border-border bg-secondary/95 backdrop-blur supports-[backdrop-filter]:bg-secondary/80 [box-shadow:inset_0_-1px_0_rgb(255_255_255/0.04),inset_0_1px_0_rgb(0_0_0/0.20)]">
```

If `--app-shell-topbar-height` isn't published as a CSS variable anywhere, fall back to a hardcoded `top-[56px]` (current shell height). Confirm in `dividendmapper/app/app/_components/shell/topbar.tsx` whether the variable is set; if not, declare it on the shell root in this task.

Replace the desktop table's outer wrapper:

```tsx
<div className="hidden overflow-clip rounded-xl border border-border bg-card md:block">
```

The change from `overflow-hidden` to `overflow-clip` preserves the sticky descendant (a known issue called out in the spec).

- [ ] **Step 5: Apply the inset bevel to body rows**

In `holding-row.tsx`, on the `<tr>` className, add the inset shadow utility (in addition to the existing classes):

```tsx
"[box-shadow:inset_0_1px_0_rgb(255_255_255/0.04),inset_0_-1px_0_rgb(0_0_0/0.15)] hover:[box-shadow:inset_0_1px_0_rgb(255_255_255/0.07),inset_0_-1px_0_rgb(0_0_0/0.25)]"
```

(Tailwind v4 allows arbitrary `box-shadow:` values in className arbitrary-value form.) The hover lift uses the existing `transition-all` already on the row.

- [ ] **Step 6: Run tests — confirm they pass**

Run: `npx vitest run app/app/portfolio/_components/__tests__/holdings-table.test.tsx 2>&1 | tail -10`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/holdings-table.tsx \
        dividendmapper/app/app/portfolio/_components/holding-row.tsx \
        dividendmapper/app/app/portfolio/_components/__tests__/holdings-table.test.tsx
git commit -m "feat(portfolio): sortable headers, sticky thead, beveled rows"
```

---

## Task 21: Wire RangeToggle + DensityToggle + WrapperFilterChips above the table

**Files:**
- Modify: `dividendmapper/app/app/portfolio/_components/holdings-table.tsx`

- [ ] **Step 1: Add the controls row above the desktop table**

Before the `<div className="hidden …md:block">` desktop wrapper, render the controls row. On mobile, the same wrappers render above the card list:

```tsx
<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
  <WrapperFilterChips present={presentWrappers} active={activeWrapper} />
  <div className="flex items-center gap-2">
    <RangeToggle />
    <DensityToggle />
  </div>
</div>
```

- [ ] **Step 2: Compute `presentWrappers` + read `activeWrapper`**

Take `presentWrappers` + `activeWrapper` as props on `<HoldingsTable>`; `page.tsx` will compute them and pass them down. For now, derive them inside the component temporarily so this task is shippable on its own:

```ts
const presentWrappers = useMemo(
  () => Array.from(new Set(sortedRows.map((r) => r.wrapper))),
  [sortedRows],
);
const activeWrapper: string | null = null; // page.tsx will pass the real value in Task 23
```

Page.tsx will plumb both in Task 23.

- [ ] **Step 3: Subscribe to density changes + apply to `<tr>` padding**

In `holdings-table.tsx`, with the same `useSyncExternalStore` pattern as the sort hook, read the current density. Pass `density` into `<HoldingRow>`. In `holding-row.tsx`, use it to swap the `<td>` padding:

```tsx
const cellPad = density === "compact" ? "py-2" : "py-3";
// ...
className={`… ${cellPad} …`}
```

- [ ] **Step 4: Manual smoke check**

Run `npm run dev`, sign in, visit `/app/portfolio`. Confirm:
- Range pills show; clicking 1Y / 5Y reflows every row's sparkline.
- Density toggle alternates row height.
- Wrapper chips appear when 2+ wrappers exist; click an `ISA` chip and verify the URL becomes `?wrapper=isa` (filtering kicks in once Task 23 lands; until then chips visually highlight but rows don't filter).

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/holdings-table.tsx \
        dividendmapper/app/app/portfolio/_components/holding-row.tsx
git commit -m "feat(portfolio): wire range/density toggles + wrapper filter chips above table"
```

---

## Task 22: Mobile card refresh

**Files:**
- Modify: `dividendmapper/app/app/portfolio/_components/holdings-table.tsx`

The mobile `<ul>` of `<li>` cards needs the same Glow Up: logo, sparkline, 2dp formatting, wrapper-as-text line, whole-card click, Edit placeholder, no in-card score chip.

- [ ] **Step 1: Update mobile card markup**

Replace the mobile `<li>` block with the new card structure. Convert the outer `<li>` to a clickable surface (button or div with `role="link"`). Reuse `<HoldingLogo>`, `<RowSparkline>`, 2dp formatting, and the inset bevel utility. The Score/Vehicle pill is removed; Edit/Delete cluster stays always-visible on touch.

```tsx
{sortedRows.map((row) => {
  const incomeStatus = resolveRowIncome(row, quotes, actualsByKey);
  const valueStatus = resolveRowValue(row, priceByTicker ?? {});
  const received = actualsByKey?.[actualKey(row.ticker, row.wrapper)];
  const series = sparklineByTicker?.get(row.ticker) ?? null;
  const pending = pendingIds.has(row.id);
  return (
    <li
      key={row.id}
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/app/portfolio/${row.ticker}`)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/app/portfolio/${row.ticker}`); } }}
      className={`cursor-pointer rounded-xl border border-border bg-card p-4 transition-all hover:bg-secondary/40 focus:outline-none focus:ring-2 focus:ring-ring ${pending ? "opacity-50" : ""}`}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.15)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <HoldingLogo ticker={row.ticker} name={nameByTicker?.[row.ticker]} size={40} />
          <div className="min-w-0">
            <span className="block font-mono text-base font-semibold text-foreground">{row.ticker}</span>
            {nameByTicker?.[row.ticker] && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{nameByTicker[row.ticker]}</p>
            )}
            <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground/80">
              {WRAPPER_LABEL[row.wrapper] ?? row.wrapper} · {row.cost_currency}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-disabled="true"
            aria-label={`Edit ${row.ticker}`}
            title="Edit coming soon"
            onClick={(e) => { e.stopPropagation(); }}
            className="inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground opacity-50"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
            disabled={pending}
            aria-label={`Delete ${row.ticker}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <RowSparkline
          ticker={row.ticker}
          name={nameByTicker?.[row.ticker]}
          range={sparklineRange}
          series={series}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quantity</dt>
          <dd className="mt-0.5 font-mono text-foreground" title={String(row.quantity)}>
            {Number(row.quantity).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg cost</dt>
          <dd className="mt-0.5 font-mono text-foreground" title={String(row.avg_cost)}>
            {formatMoney(Number(row.avg_cost), row.cost_currency, { dp: 2 })}
          </dd>
        </div>
        <div className="relative">
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Value</dt>
          <dd className="mt-0.5 text-sm">
            <ValueCell status={valueStatus} />
            {valueStatus.kind === "ok" && (
              <PortfolioBar value={valueStatus.amount} totalValue={totalVisibleValue} />
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Income</dt>
          <dd className="mt-0.5 text-sm">
            <IncomeCell status={incomeStatus} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Received (12m)</dt>
          <dd className="mt-0.5 text-sm">
            <ReceivedCell actual={received} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Broker</dt>
          <dd className="mt-0.5 text-foreground">
            <BrokerCell row={row} />
          </dd>
        </div>
      </dl>
    </li>
  );
})}
```

The mobile branch keeps the existing standalone `<SortSelect>` above the list (sortable column headers are desktop-only).

- [ ] **Step 2: Manual smoke check at mobile width**

Run `npm run dev`, open dev tools, resize to 375px. Confirm cards now show logo + sparkline + 2dp formatting + Edit/Delete cluster.

- [ ] **Step 3: Run holdings-table tests**

Run: `npx vitest run app/app/portfolio/_components/__tests__/holdings-table.test.tsx 2>&1 | tail -10`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add dividendmapper/app/app/portfolio/_components/holdings-table.tsx
git commit -m "feat(portfolio): mobile cards inherit logo + sparkline + 2dp + bevel + whole-card click"
```

---

## Task 23: Page-level wiring — filter ?wrapper=, pass sparkline data, drop vehicle plumbing

**Files:**
- Modify: `dividendmapper/app/app/portfolio/page.tsx`
- Modify: `dividendmapper/lib/portfolio/load-priced-holdings.ts`

- [ ] **Step 1: Add `loadSparklineSeriesByTicker` to the page's data load**

In `page.tsx`, import the new helper:

```ts
import { loadSparklineSeriesByTicker, readStoredRange } from "@/lib/portfolio/load-sparkline-series";
```

Note: server can't read localStorage. The page renders for the *default* range (`30D`); the client re-renders the sparkline cell when the user changes range. This means we need to load *all three* ranges' data or load only `30D` server-side and trigger a lazy client fetch for `1Y` / `5Y`.

Simpler: load all 3 windows in one query (the 5Y query already includes 30D + 1Y as subsets), then slice client-side per the active range.

Implement that: add a server-side helper that returns 5Y of points per ticker, then in `<RowSparkline>` slice to the active range based on `RANGE_DAYS[range]` indexes from the end.

For this task, take the simplest path: load 5Y server-side; pass the full series in; `<HoldingsTable>` slices to the active range before passing to `<RowSparkline>`.

Add to `loadPricedHoldings`:

```ts
const distinctTickers = [...new Set(visibleRows.map((h) => h.ticker))];
const sparklineByTicker = await loadSparklineSeriesByTicker(
  await createSupabaseServerClient(),
  distinctTickers,
  "5Y",
);
return { ..., sparklineByTicker };
```

In `page.tsx`, pass `sparklineByTicker` into `<HoldingsTable>`.

- [ ] **Step 2: Slice the series in HoldingsTable based on the active range**

In `holdings-table.tsx`, where each row's series is built for `<HoldingRow>`:

```ts
function sliceSeries(full: SparklineSeries | undefined, range: SparklineRange): SparklineSeries | null {
  if (!full) return null;
  const days = RANGE_DAYS[range];
  // Approx-trading-days = days * (252/365). Slice from the end.
  const tradingDays = Math.ceil(days * (252 / 365));
  const sliced = full.points.slice(-tradingDays);
  if (sliced.length === 0) return null;
  return {
    points: range === "5Y" ? downsampleSeries(sliced, 100) : sliced,
    firstClose: sliced[0],
    lastClose: sliced.at(-1)!,
    currency: full.currency,
  };
}
```

Pass `sliceSeries(sparklineByTicker?.get(row.ticker), sparklineRange)` to each `<HoldingRow>`.

- [ ] **Step 3: Filter rows by `?wrapper=` server-side**

In `page.tsx`:

```ts
const wrapperParam = typeof searchParams?.wrapper === "string" ? searchParams.wrapper : null;
const filteredVisibleRows = wrapperParam
  ? visibleRows.filter((r) => r.wrapper === wrapperParam)
  : visibleRows;
const presentWrappers = Array.from(new Set(visibleRows.map((r) => r.wrapper)));
```

Pass `filteredVisibleRows`, `presentWrappers`, `activeWrapper={wrapperParam}` into `<HoldingsTable>`. Make sure the page function signature accepts `searchParams`.

- [ ] **Step 4: Drop the vehicle-score plumbing on the portfolio page (only)**

`page.tsx` currently loads `vehicleScoresByTicker` and passes it to `<HoldingsTable>`. Delete that block + the prop. `vehicleScoresByTicker` is still loaded on `/app/portfolio/scoring` — no change there.

- [ ] **Step 5: Run all portfolio tests**

Run: `npx vitest run app/app/portfolio 2>&1 | tail -10`
Expected: pass.

- [ ] **Step 6: Manual smoke**

`npm run dev`, sign in, visit `/app/portfolio`. Confirm:
- Sparklines render for every holding that has data; "Collecting…" for ones that don't.
- Range toggle reflows every line.
- Wrapper filter chips show only when 2+ wrappers present; clicking ISA filters rows AND updates URL.
- Back button restores the unfiltered view.

- [ ] **Step 7: Commit**

```bash
git add dividendmapper/app/app/portfolio/page.tsx \
        dividendmapper/app/app/portfolio/_components/holdings-table.tsx \
        dividendmapper/lib/portfolio/load-priced-holdings.ts
git commit -m "feat(portfolio): wire sparklineByTicker + ?wrapper= filter + drop vehicle chip plumbing"
```

---

## Task 24: Logos via logo.dev attribution + final polish + PR

**Files:**
- Modify: `dividendmapper/app/app/portfolio/page.tsx`

- [ ] **Step 1: Add the attribution footer**

In `page.tsx`, after the `<PortfolioIncomeChart>` block (so it sits under the table data, above the archived section):

```tsx
<p className="mt-3 text-[11px] text-muted-foreground/70">
  Logos via{" "}
  <a
    href="https://www.logo.dev"
    target="_blank"
    rel="noopener noreferrer"
    className="underline-offset-2 hover:underline"
  >
    logo.dev
  </a>
</p>
```

- [ ] **Step 2: Run lint + typecheck + build**

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Expected: each clean. The `next build` step is non-negotiable per memory `feedback_supabase_promiselike_chain` — Vercel can fail when local vitest passes.

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run --no-file-parallelism 2>&1 | tail -5
```

Expected: pass count = baseline + (~38) new tests across all the new components.

- [ ] **Step 4: Final smoke run against a populated portfolio**

`npm run dev`, sign in as Glenn's account. Walk through:
- Every row shows a logo OR an initials tile.
- Every row shows a sparkline OR "Collecting…".
- 30D → 1Y → 5Y reflows all lines.
- Density toggle reduces row height.
- ISA / GIA / SIPP filter chips work, URL updates, back button restores.
- Click a row body → navigates to `/app/portfolio/<ticker>`.
- Select numeric text inside a row, release mouse → no navigation.
- Hover a row → bevel deepens, Edit + Delete reveal.
- Click Edit → no-op (placeholder tooltip).
- Click Delete → confirm → row disappears (existing behaviour preserved).
- Quantity / Avg cost show 2dp; full-precision visible on hover (`title`).
- Value cells carry a tinted % bar; total % across visible rows sums to ~100%.
- Sticky thead floats with the inverted bevel on scroll.
- Mobile (375px): cards inherit logo + sparkline + 2dp + bevel + whole-card click.
- "Logos via logo.dev" attribution shows in the footer.

- [ ] **Step 5: Push + open PR**

```bash
git push -u origin feature/portfolio-glow-up
gh pr create --title "feat(portfolio): /app/portfolio glow-up — logos, sparklines, bevel, whole-row click" --body "$(cat <<'EOF'
## Summary

- Logos via logo.dev with a deterministic initials fallback
- Per-row server-rendered sparkline (`30D · 1Y · 5Y` global toggle) backed by new `ticker_price_history` table + FMP backfill + nightly cron append
- Whole-row click → `/app/portfolio/[ticker]` with text-selection guard
- Wrapper demoted from column to filter chips + secondary line under company name
- Sortable sticky headers (desktop) with inverted-bevel float
- Density toggle (`comfortable` / `compact`)
- Inline % of portfolio bar behind the Value cell
- 2 dp quantity & avg cost with full-precision tooltips
- Inset bevel + hover-lift on every row
- Edit slot reserved (placeholder button) for the upcoming Edit modal
- Mobile cards inherit the same Glow Up
- "Logos via logo.dev" attribution in the footer

Drops: in-row Scores column on `/app/portfolio` (vehicle resilience moves to detail pages only), standalone desktop SortSelect, in-row Upgrade pill (existing banner / wizard nudges carry the upgrade story).

Spec: planning/specs/2026-06-27-portfolio-view-glow-up-design.md
Plan: planning/plans/2026-06-27-portfolio-view-glow-up.md

## Test plan

- [ ] Open `/app/portfolio` on a populated Pro account; verify every row has a logo or initials tile and a sparkline or "Collecting…" pill.
- [ ] Toggle `30D / 1Y / 5Y`; confirm all lines redraw.
- [ ] Toggle density; confirm row heights change.
- [ ] Verify wrapper-filter chips behave correctly when only one wrapper present (no chips) vs multiple (chips appear, URL updates).
- [ ] Click a row body → navigates to detail page.
- [ ] Select numeric text → no navigation.
- [ ] Hover row → bevel deepens, Edit + Delete reveal.
- [ ] Click Edit → tooltip "Edit coming soon", no-op.
- [ ] Click Delete → confirm dialog → row disappears.
- [ ] Quantity & cost show 2 dp; hover title shows full precision.
- [ ] Sortable column headers reorder + persist across reloads.
- [ ] Sticky thead floats with inverted bevel when scrolling.
- [ ] Mobile (375 px): cards inherit logo + sparkline + 2 dp + bevel + whole-card click.
- [ ] Free user: same glow-up applies (no Upgrade pill in the row).
- [ ] Backfill script + nightly cron extension verified against `ticker_price_history` row counts.
EOF
)"
```

- [ ] **Step 6: Verify the PR build is green and request review**

Wait for CI. If green, this work is shippable.

---

## Self-review checklist

Run through the spec one section at a time and confirm each line item has a task:

| Spec section | Covered by |
|---|---|
| 1. Anatomy of a row | Tasks 14, 15, 16, 17, 18, 19, 20 |
| 2. Above-table controls | Tasks 10, 11, 12, 21, 23 |
| 3. Sparkline subsystem (table, backfill, cron, render) | Tasks 2, 3, 4, 5, 9 |
| 4. Logos + initials | Tasks 6, 7, 8, 24 |
| 5. Row interaction model | Tasks 19, 20 |
| 6. Free vs Pro parity | Implicit — every UI task ships for both tiers; Task 15 drops the Upgrade pill |
| 7. Mobile | Task 22 |
| 8. Component changes (all new files) | Tasks 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14 |
| 9. Testing | Each Task has a TDD red/green pair |
| 10. Out of scope | Not implemented — covered by explicit absence |
| 11. Risks | Task 20 (sticky + overflow-clip), Task 5 (cron path discovery), Task 4 (GBp + fund-logo smoke), Task 19 (programmatic-push fallback for Next 16 `<Link>`/`<tr>` constraint) |

All spec requirements covered.
