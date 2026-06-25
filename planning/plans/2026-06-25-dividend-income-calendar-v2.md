# Dividend Income Calendar v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILLS in order — `superpowers:executing-plans` (this plan), `superpowers:subagent-driven-development` (recommended for per-day execution), `superpowers:test-driven-development` (per-task where logic-shaped). Steps use checkbox (`- [ ]`) syntax for tracking. Read `dividendmapper/AGENTS.md` and `node_modules/next/dist/docs/` BEFORE writing any Next.js-specific code per `[feedback_dividendmapper_nextjs_warning]`.

**Goal:** Promote today's dashboard `IncomeCalendarCard` to a flagship `/app/calendar` surface (Pro) + a public `/dividend-calendar` SEO landing, fully locale- and tax-wrapper-aware, with a bidirectional cadence-fill projection engine that back-fills sparse history and projects the next 12 months.

**Architecture:** Two slices, two PRs, sequenced by a live-validation gate on Slice A. Slice A ships the visual surface using today's data path; Slice B adds the projection engine + public landing. One additive migration (`0021`). Reuses Phase 2.75 scoring cron + FMP per-symbol dividend history (zero new API cost).

**Tech Stack:** Next.js 16.2.4 (App Router, RSC), React 19.2.4, Tailwind v4, Supabase Postgres + Auth, Vitest + RTL, FMP `/stable/historical-price-eod/dividend-adjusted` (already pulled by `lib/scoring/score-ticker.ts`).

**Spec:** [planning/specs/2026-06-25-dividend-income-calendar-v2-design.md](../specs/2026-06-25-dividend-income-calendar-v2-design.md)

**Branch (Slice A):** `feature/calendar-v2-slice-a` off `main`.
**Branch (Slice B):** `feature/calendar-v2-slice-b` off Slice A merge commit on `main`.

**Timeline:** 9 working days + 1 buffer day = **10 working days**. Slice A Days 1–5; live-validation gate; Slice B Days 6–9; buffer Day 10.

---

## Pre-flight (Day 0.5 — before Day 1 kicks off)

### 1. Agentic worker — sync main + worktree setup

```bash
cd /c/Users/grodg/dividend_mapper_plan
git fetch origin
git checkout main && git pull origin main
git worktree add dividendmapper/.worktrees/calendar-v2-slice-a -b feature/calendar-v2-slice-a origin/main
cd dividendmapper/.worktrees/calendar-v2-slice-a/dividendmapper
cmd //C "rmdir node_modules" 2>/dev/null
cmd //C "mklink /J node_modules C:\\Users\\grodg\\dividend_mapper_plan\\dividendmapper\\node_modules" 2>&1
cmd //C "mklink .env.local C:\\Users\\grodg\\dividend_mapper_plan\\dividendmapper\\.env.local" 2>&1
# Baseline: expect the latest test count (1373+ after Sprint 4; rerun the project-wide count to confirm).
npx vitest run --no-file-parallelism lib/portfolio/ 2>&1 | tail -5
```

If `node_modules` is empty in the primary checkout (parallel agent wiped it — see `[feedback_concurrent_worktree_branch_race]`), run `npm install --no-audit --no-fund --prefer-offline` from inside the worktree before the baseline.

### 2. Confirm migration numbers

```bash
ls dividendmapper/supabase/migrations/ | tail -5
```

Last migration on `origin/main` at plan-writing time is `0020_saved_screens.sql`. Slice B adds **one** migration: `0021_equity_scores_projection.sql`. If newer migrations have landed between plan-writing and execution, bump the number and update every reference in Day 6 below.

### 3. Glenn — needed for Day 6 only

Day 6 (Slice B kickoff) needs:
- Migration `0021_equity_scores_projection.sql` applied to prod.
- One-shot `scripts/scoring/backfill-equity-projection.mjs` (written in Day 7) run with prod credentials to populate the new JSONB columns on existing rows before the next cron cycle.

Glenn runs the CLI commands; the plan writes the files and stages config changes but does not execute prod ops.

---

## File map (lock decomposition here)

### Slice A — new files

- `lib/portfolio/dividend-tax.ts` _(~80 lines)_ — pure `computeNetDividend` with UK + US locale defaults.
- `lib/portfolio/__tests__/dividend-tax.test.ts` _(~6 tests)_.
- `app/app/calendar/page.tsx` — Pro-gated server component.
- `app/app/calendar/_components/calendar-shell.tsx` — client wrapper holding toggle/filter state.
- `app/app/calendar/_components/hero-kpi-strip.tsx` — 4-tile KPI strip, locale-aware currency.
- `app/app/calendar/_components/wrapper-filter-row.tsx` — locale-driven chip row.
- `app/app/calendar/_components/calendar-chart.tsx` — 18-month segment-aware bars (Slice B teaches it more segment kinds).
- `app/app/calendar/_components/drilldown-panel.tsx` — per-payment list owner.
- `app/app/calendar/_components/cadence-timeline.tsx` — 1–31 SVG day-axis marker strip.
- `app/app/calendar/_components/empty-state-cta.tsx` — conditional "Import past dividends" card.
- `app/app/calendar/__tests__/page.test.tsx` — auth + Pro-gate test.
- `app/app/calendar/_components/__tests__/calendar-shell.test.tsx`, `hero-kpi-strip.test.tsx`, `wrapper-filter-row.test.tsx`, `calendar-chart.test.tsx`, `drilldown-panel.test.tsx`, `cadence-timeline.test.tsx`, `empty-state-cta.test.tsx`.

### Slice A — modified files

- `lib/portfolio/income-calendar.ts` — extend `IncomeCalendarMonth` with `segments[]`; add wrapper-aware aggregation + locale-aware primary currency. Back-compat: keep `gbp + kind` fields for the dashboard lite card during transition.
- `lib/portfolio/__tests__/income-calendar.test.ts` — add coverage for segments + wrappers + locale.
- `app/app/dashboard/_components/IncomeCalendarCard.tsx` — lite-preview treatment + "Open full calendar →" link.
- `app/app/dashboard/_components/IncomeCalendarChart.tsx` — no functional change (Slice A keeps it reading the legacy `gbp + kind` shape).
- `app/app/_components/shell/nav-items.ts` — add Calendar entry between Dashboard and Portfolio Manager (Pro-gated via `requiresPro: true`).
- `app/app/_components/shell/__tests__/nav-items.test.ts` — assert the Calendar entry's tier filtering.

### Slice B — new files

- `lib/scoring/project-dividends.ts` _(~180 lines)_ — pure cadence detection + projection engine.
- `lib/scoring/__tests__/project-dividends.test.ts` _(~15 tests)_.
- `supabase/migrations/0021_equity_scores_projection.sql`.
- `scripts/scoring/backfill-equity-projection.mjs` — one-shot script for prod backfill before the next cron cycle.
- `app/(public)/dividend-calendar/page.tsx` — public landing server component.
- `app/(public)/dividend-calendar/_components/landing-hero.tsx`.
- `app/(public)/dividend-calendar/_components/demo-calendar.tsx` — client component, fixture-fed `CalendarChart`.
- `app/(public)/dividend-calendar/_components/feature-panels.tsx`.
- `app/(public)/dividend-calendar/_components/landing-faq.tsx`.
- `app/(public)/dividend-calendar/_fixtures/sample-portfolio.ts` — locked UK + US fixture portfolios.
- `app/(public)/dividend-calendar/__tests__/page.test.tsx`.
- `app/(public)/dividend-calendar/_components/__tests__/demo-calendar.test.tsx`, `landing-faq.test.tsx`.

### Slice B — modified files

- `lib/scoring/score-ticker.ts` — after composing scores, call `projectDividends(..., 'forward')` and `projectDividends(..., 'backward')`, persist into new JSONB columns on the existing `equity_scores` upsert.
- `app/api/internal/refresh-equity-scores/__tests__/route.test.ts` — verify new columns populate.
- `lib/portfolio/income-calendar.ts` — extend `BuildArgs` to accept the per-ticker projection caches; add new `SegmentKind` union members + per-user back-fill logic gated on `holdings.created_at`.
- `app/app/calendar/_components/calendar-chart.tsx` — three new segment kinds (`projected-cadence`, `projected-growth`, `growth-clipped`) with the documented opacities + ⚠ glyph.
- `app/app/calendar/_components/hero-kpi-strip.tsx` — *(incl. projected)* footnote tooltip when the tile sum includes projected payments.
- `components/site-header.tsx` — add `Dividend calendar` to `BASE_NAV`.
- `app/sitemap.ts` — add `/dividend-calendar` at priority `0.9`.

---

# SLICE A — Visual surface (Days 1–5)

## Day 1 — Tax module + income-calendar segments extension

**Outcome.** Two pure modules updated with full test coverage. ~12 new tests (6 tax + 6 income-calendar extensions). No UI yet.

### Task 1.1 — `computeNetDividend` tax module

**Files:**
- Create: `dividendmapper/lib/portfolio/dividend-tax.ts`
- Test: `dividendmapper/lib/portfolio/__tests__/dividend-tax.test.ts`

- [ ] **Step 1.1.1: Write the failing test**

Create `dividendmapper/lib/portfolio/__tests__/dividend-tax.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeNetDividend } from "../dividend-tax";

describe("computeNetDividend", () => {
  it("returns gross for sheltered UK wrappers (ISA, SIPP)", () => {
    const isa = computeNetDividend({
      grossPrimaryCurrency: 100,
      wrapper: "isa",
      locale: "uk",
      ytdGrossInTaxableSoFar: 0,
    });
    expect(isa).toEqual({ net: 100, taxApplied: 0 });

    const sipp = computeNetDividend({
      grossPrimaryCurrency: 100,
      wrapper: "sipp",
      locale: "uk",
      ytdGrossInTaxableSoFar: 0,
    });
    expect(sipp).toEqual({ net: 100, taxApplied: 0 });
  });

  it("returns gross for sheltered US wrappers (401k, ira, roth_ira)", () => {
    for (const wrapper of ["401k", "ira", "roth_ira"] as const) {
      const result = computeNetDividend({
        grossPrimaryCurrency: 100,
        wrapper,
        locale: "us",
        ytdGrossInTaxableSoFar: 0,
      });
      expect(result).toEqual({ net: 100, taxApplied: 0 });
    }
  });

  it("UK GIA: first £500 YTD untaxed, remainder at 8.75%", () => {
    // Below allowance: untouched.
    const under = computeNetDividend({
      grossPrimaryCurrency: 200,
      wrapper: "gia",
      locale: "uk",
      ytdGrossInTaxableSoFar: 0,
    });
    expect(under).toEqual({ net: 200, taxApplied: 0 });

    // Straddling allowance (300 already used + 400 this payment → 200 above the 500 cap).
    const straddle = computeNetDividend({
      grossPrimaryCurrency: 400,
      wrapper: "gia",
      locale: "uk",
      ytdGrossInTaxableSoFar: 300,
    });
    expect(straddle.taxApplied).toBeCloseTo(200 * 0.0875, 4);
    expect(straddle.net).toBeCloseTo(400 - 200 * 0.0875, 4);

    // Fully above allowance (1000 already used + 100 this payment → all 100 taxed).
    const above = computeNetDividend({
      grossPrimaryCurrency: 100,
      wrapper: "gia",
      locale: "uk",
      ytdGrossInTaxableSoFar: 1000,
    });
    expect(above.taxApplied).toBeCloseTo(100 * 0.0875, 4);
    expect(above.net).toBeCloseTo(100 - 100 * 0.0875, 4);
  });

  it("US Brokerage: flat 15% qualified-dividend rate, no allowance", () => {
    const result = computeNetDividend({
      grossPrimaryCurrency: 100,
      wrapper: "brokerage",
      locale: "us",
      ytdGrossInTaxableSoFar: 0,
    });
    expect(result.taxApplied).toBeCloseTo(15, 4);
    expect(result.net).toBeCloseTo(85, 4);
  });

  it("returns gross unchanged when grossPrimaryCurrency is 0 or negative", () => {
    expect(
      computeNetDividend({ grossPrimaryCurrency: 0, wrapper: "gia", locale: "uk", ytdGrossInTaxableSoFar: 0 }),
    ).toEqual({ net: 0, taxApplied: 0 });
    expect(
      computeNetDividend({ grossPrimaryCurrency: -10, wrapper: "gia", locale: "uk", ytdGrossInTaxableSoFar: 0 }),
    ).toEqual({ net: -10, taxApplied: 0 });
  });

  it("UK wrapper enum value 'brokerage' is treated as GIA for legacy rows", () => {
    // Legacy CSV imports may carry the generic 'brokerage' enum for UK users.
    // Mirror the UK GIA rules so net display stays consistent.
    const result = computeNetDividend({
      grossPrimaryCurrency: 1000,
      wrapper: "brokerage",
      locale: "uk",
      ytdGrossInTaxableSoFar: 0,
    });
    expect(result.taxApplied).toBeCloseTo(500 * 0.0875, 4);
    expect(result.net).toBeCloseTo(1000 - 500 * 0.0875, 4);
  });
});
```

- [ ] **Step 1.1.2: Run the test to verify it fails**

```bash
npx vitest run --no-file-parallelism lib/portfolio/__tests__/dividend-tax.test.ts
```

Expected: FAIL with `Cannot find module '../dividend-tax'`.

- [ ] **Step 1.1.3: Write the minimal implementation**

Create `dividendmapper/lib/portfolio/dividend-tax.ts`:

```ts
// Locale-default dividend tax computation for the Income Calendar v2.
// UK: £500 dividend allowance per tax year (LocaleConfig.dividendTax.allowance),
//     basic-rate 8.75% above it. We don't model higher-rate yet — that's v2.1.
// US: 15% qualified-dividend flat — the most common case for retail.
// Sheltered wrappers (ISA, SIPP, 401k, IRA, Roth IRA) always pass through gross.

export type Wrapper =
  | "isa" | "sipp" | "gia"
  | "401k" | "ira" | "roth_ira"
  | "brokerage";

export type Locale = "uk" | "us";

const UK_ALLOWANCE = 500;        // matches lib/locale/configs.ts UK_CONFIG.dividendTax.allowance
const UK_BASIC_RATE = 0.0875;
const US_QUALIFIED_RATE = 0.15;

const SHELTERED_UK = new Set<Wrapper>(["isa", "sipp"]);
const SHELTERED_US = new Set<Wrapper>(["401k", "ira", "roth_ira"]);

export interface ComputeNetDividendArgs {
  grossPrimaryCurrency: number;
  wrapper: Wrapper;
  locale: Locale;
  ytdGrossInTaxableSoFar: number;
}

export interface NetDividendResult {
  net: number;
  taxApplied: number;
}

export function computeNetDividend(args: ComputeNetDividendArgs): NetDividendResult {
  const { grossPrimaryCurrency, wrapper, locale, ytdGrossInTaxableSoFar } = args;

  if (grossPrimaryCurrency <= 0) return { net: grossPrimaryCurrency, taxApplied: 0 };

  const sheltered =
    locale === "uk" ? SHELTERED_UK.has(wrapper) : SHELTERED_US.has(wrapper);
  if (sheltered) return { net: grossPrimaryCurrency, taxApplied: 0 };

  if (locale === "us") {
    const tax = grossPrimaryCurrency * US_QUALIFIED_RATE;
    return { net: grossPrimaryCurrency - tax, taxApplied: tax };
  }

  // UK GIA path (and 'brokerage' enum for legacy UK rows).
  const headroom = Math.max(0, UK_ALLOWANCE - ytdGrossInTaxableSoFar);
  const taxableAmount = Math.max(0, grossPrimaryCurrency - headroom);
  const tax = taxableAmount * UK_BASIC_RATE;
  return { net: grossPrimaryCurrency - tax, taxApplied: tax };
}
```

- [ ] **Step 1.1.4: Run the test to verify it passes**

```bash
npx vitest run --no-file-parallelism lib/portfolio/__tests__/dividend-tax.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 1.1.5: Commit**

```bash
git add lib/portfolio/dividend-tax.ts lib/portfolio/__tests__/dividend-tax.test.ts
git commit -m "feat(calendar): dividend-tax pure module (UK 8.75%/£500 + US 15%)"
```

### Task 1.2 — Extend `income-calendar.ts` with segments + wrapper aggregation

**Files:**
- Modify: `dividendmapper/lib/portfolio/income-calendar.ts`
- Modify: `dividendmapper/lib/portfolio/__tests__/income-calendar.test.ts`

- [ ] **Step 1.2.1: Add failing tests for the extended shape**

Append to `dividendmapper/lib/portfolio/__tests__/income-calendar.test.ts`:

```ts
describe("buildIncomeCalendar — v2 segments + wrapper aggregation", () => {
  const ratesToGbp = { GBP: 1, USD: 0.79, GBp: 0.01, GBX: 0.01 };
  const now = new Date("2026-06-23T12:00:00Z");

  it("returns a `segments` array on each month, preserving legacy `gbp` + `kind` for back-compat", () => {
    const userDividends = [
      { paid_on: "2026-04-15", amount: 100, currency: "USD", wrapper: "isa" as const },
      { paid_on: "2026-04-22", amount: 200, currency: "USD", wrapper: "gia" as const },
    ];
    const result = buildIncomeCalendar({
      userDividends,
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
    });
    const apr = result.months.find((m) => m.ym === "2026-04");
    expect(apr?.gbp).toBeCloseTo(237, 1);
    expect(apr?.kind).toBe("actual");
    expect(apr?.segments).toHaveLength(1);
    expect(apr?.segments[0]).toMatchObject({ kind: "actual" });
    expect(apr?.segments[0].primary).toBeCloseTo(237, 1);
  });

  it("aggregates by wrapper when the wrapper filter is applied", () => {
    const userDividends = [
      { paid_on: "2026-04-15", amount: 100, currency: "GBP", wrapper: "isa" as const },
      { paid_on: "2026-04-22", amount: 200, currency: "GBP", wrapper: "gia" as const },
    ];
    const all = buildIncomeCalendar({
      userDividends,
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
      wrapperFilter: "all",
    });
    const onlyIsa = buildIncomeCalendar({
      userDividends,
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
      wrapperFilter: "isa",
    });
    expect(all.months.find((m) => m.ym === "2026-04")?.gbp).toBe(300);
    expect(onlyIsa.months.find((m) => m.ym === "2026-04")?.gbp).toBe(100);
  });

  it("returns 18 buckets (6 back + current + 12 forward)", () => {
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings: [],
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
    });
    expect(result.months).toHaveLength(19);
    expect(result.months[0].ym).toBe("2025-12");
    expect(result.months[6].kind).toBe("partial");
    expect(result.months[18].ym).toBe("2027-06");
  });

  it("US locale primary currency = USD; UK holdings convert", () => {
    const userDividends = [
      { paid_on: "2026-04-10", amount: 100, currency: "USD", wrapper: "ira" as const },
      { paid_on: "2026-04-12", amount: 50, currency: "GBP", wrapper: "ira" as const },
    ];
    const ratesUsd = { USD: 1, GBP: 1 / 0.79 };
    const result = buildIncomeCalendar({
      userDividends,
      holdings: [],
      exDivByTicker: {},
      ratesToGbp: ratesUsd,
      now,
      locale: "us",
    });
    const apr = result.months.find((m) => m.ym === "2026-04");
    expect(apr?.gbp).toBeCloseTo(100 + 50 / 0.79, 2);
    expect(result.primaryCurrency).toBe("USD");
  });

  it("respects `holdings.created_at` floor — does NOT back-project before the user owned the position", () => {
    // Slice A intentionally doesn't back-project (no projection engine). This
    // test fixes the contract: when no exDivByTicker is supplied, past forecast
    // buckets stay empty even if holdings exist. Slice B fills these.
    const holdings = [
      { ticker: "AAPL", quantity: 10, wrapper: "gia" as const, created_at: "2026-06-01" },
    ];
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
    });
    const mar = result.months.find((m) => m.ym === "2026-03");
    expect(mar?.gbp).toBe(0);
  });

  it("nextThree GBP rounds correctly with multiple holdings of the same wrapper", () => {
    const holdings = [
      { ticker: "PHP.L", quantity: 100, wrapper: "isa" as const, created_at: "2024-01-01" },
      { ticker: "BATS.L", quantity: 50, wrapper: "isa" as const, created_at: "2024-01-01" },
    ];
    const exDivByTicker = {
      "PHP.L": { ex_date: "2026-07-02", pay_date: "2026-07-09", amount: 0.42, currency: "GBp" },
      "BATS.L": { ex_date: "2026-07-09", pay_date: "2026-08-06", amount: 5.85, currency: "GBp" },
    };
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker,
      ratesToGbp,
      now,
      locale: "uk",
    });
    expect(result.nextThree).toHaveLength(2);
    expect(result.nextThree[0].ticker).toBe("PHP.L");
    expect(result.nextThree[0].gbp).toBeCloseTo(100 * 0.42 * 0.01, 4);
  });
});
```

- [ ] **Step 1.2.2: Run the new tests to verify they fail**

```bash
npx vitest run --no-file-parallelism lib/portfolio/__tests__/income-calendar.test.ts
```

Expected: the 6 new tests in the "v2 segments + wrapper aggregation" describe FAIL with shape mismatches; the existing v1 tests still PASS.

- [ ] **Step 1.2.3: Extend the implementation**

Open `dividendmapper/lib/portfolio/income-calendar.ts` and replace its contents with:

```ts
// Pure aggregator for the Income Calendar — v2.
// Combines past-actual dividends (user_dividends) with future-forecast
// dividends (equity_scores.next_ex_div_*) into a rolling window:
//   6 past + current (partial) + 12 future = 19 buckets.
//
// v2 additions vs v1:
//   • `segments` array on each month (Slice B layers more segment kinds).
//   • `wrapperFilter` parameter (cascades to per-month aggregation).
//   • `locale` parameter (drives primaryCurrency on the result).
//   • Wrapper-aware tagging on userDividends + holdings.
//
// Back-compat: `gbp` + `kind` on each month are derived from segments and
// kept until v2.1 (the dashboard lite card still reads them).
//
// FX: caller supplies a currency → primary-currency map. Same shape as today's
// ratesToGbpFor helper; v2 callers may pass a ratesToUsd map when locale='us'.
// Field name stays `ratesToGbp` for now (rename deferred to v2.1).

export type Wrapper =
  | "isa" | "sipp" | "gia"
  | "401k" | "ira" | "roth_ira"
  | "brokerage";

export type Locale = "uk" | "us";

export type SegmentKind =
  | "actual"
  | "partial"
  | "confirmed-forecast"
  | "projected-cadence"   // Slice B
  | "projected-growth"    // Slice B
  | "growth-clipped";     // Slice B

export interface IncomeCalendarHolding {
  ticker: string;
  quantity: number;
  wrapper: Wrapper;
  created_at: string;     // ISO YYYY-MM-DD or full timestamptz; we slice(0,10)
}

export interface IncomeCalendarExDiv {
  ex_date: string;
  pay_date: string | null;
  amount: number;
  currency: string;
}

export interface IncomeCalendarUserDividend {
  paid_on: string;
  amount: number;
  currency: string;
  wrapper: Wrapper;
}

export interface IncomeCalendarSegment {
  primary: number;
  kind: SegmentKind;
}

export type IncomeCalendarMonthKind = SegmentKind;

export interface IncomeCalendarMonth {
  ym: string;
  segments: IncomeCalendarSegment[];
  gbp: number;                    // back-compat — sum of segments
  kind: IncomeCalendarMonthKind;  // back-compat — dominant kind
}

export interface IncomeCalendarNextEx {
  ticker: string;
  exDate: string;
  payDate: string | null;
  gbp: number;
  wrapper: Wrapper;
}

export interface IncomeCalendarResult {
  months: IncomeCalendarMonth[];
  nextThree: IncomeCalendarNextEx[];
  primaryCurrency: "GBP" | "USD";
}

export type WrapperFilter = "all" | Wrapper;

interface BuildArgs {
  userDividends: IncomeCalendarUserDividend[];
  holdings: IncomeCalendarHolding[];
  exDivByTicker: Record<string, IncomeCalendarExDiv>;
  ratesToGbp: Record<string, number>;
  now: Date;
  locale: Locale;
  wrapperFilter?: WrapperFilter;
}

const PAST_MONTHS = 6;
const FUTURE_MONTHS = 12;

function ym(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ymFromIso(iso: string): string {
  return iso.slice(0, 7);
}

function shiftMonths(d: Date, delta: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1));
}

function convertToPrimary(
  amount: number,
  currency: string,
  ratesToGbp: Record<string, number>,
): number | null {
  const rate = ratesToGbp[currency];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
  const result = amount * rate;
  return Number.isFinite(result) ? result : null;
}

function passesWrapperFilter(wrapper: Wrapper, filter: WrapperFilter): boolean {
  return filter === "all" || filter === wrapper;
}

function pushSegment(month: IncomeCalendarMonth, kind: SegmentKind, primary: number): void {
  const existing = month.segments.find((s) => s.kind === kind);
  if (existing) existing.primary += primary;
  else month.segments.push({ kind, primary });
}

function deriveDominant(month: IncomeCalendarMonth): void {
  // Sum primary → gbp; pick dominant kind (largest segment) for back-compat
  // consumers. Ties broken by SegmentKind enum order above.
  let total = 0;
  let dominant: SegmentKind = month.kind;
  let dominantPrimary = -1;
  for (const seg of month.segments) {
    total += seg.primary;
    if (seg.primary > dominantPrimary) {
      dominant = seg.kind;
      dominantPrimary = seg.primary;
    }
  }
  month.gbp = total;
  if (month.segments.length > 0) month.kind = dominant;
}

export function buildIncomeCalendar(args: BuildArgs): IncomeCalendarResult {
  const {
    userDividends,
    holdings,
    exDivByTicker,
    ratesToGbp,
    now,
    locale,
    wrapperFilter = "all",
  } = args;

  const primaryCurrency: "GBP" | "USD" = locale === "us" ? "USD" : "GBP";

  // 1. 19-bucket window: now-6 → now+12.
  const start = shiftMonths(now, -PAST_MONTHS);
  const buckets = new Map<string, IncomeCalendarMonth>();
  for (let i = 0; i < PAST_MONTHS + 1 + FUTURE_MONTHS; i++) {
    const d = shiftMonths(start, i);
    const key = ym(d);
    const isCurrent = i === PAST_MONTHS;
    buckets.set(key, {
      ym: key,
      segments: [],
      gbp: 0,
      kind: isCurrent ? "partial" : i < PAST_MONTHS ? "actual" : "confirmed-forecast",
    });
  }

  // 2. Past actuals + current-month partial, wrapper-filtered.
  for (const d of userDividends) {
    if (!passesWrapperFilter(d.wrapper, wrapperFilter)) continue;
    const key = ymFromIso(d.paid_on);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (bucket.kind !== "actual" && bucket.kind !== "partial") continue;
    const primary = convertToPrimary(d.amount, d.currency, ratesToGbp);
    if (primary === null) continue;
    pushSegment(bucket, bucket.kind === "partial" ? "partial" : "actual", primary);
  }

  // 3. Confirmed forward forecast, wrapper-filtered via the holding.
  for (const h of holdings) {
    if (!passesWrapperFilter(h.wrapper, wrapperFilter)) continue;
    const ex = exDivByTicker[h.ticker];
    if (!ex || !ex.pay_date) continue;
    const key = ymFromIso(ex.pay_date);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (bucket.kind !== "confirmed-forecast") continue;
    const perShare = convertToPrimary(ex.amount, ex.currency, ratesToGbp);
    if (perShare === null) continue;
    const total = perShare * h.quantity;
    if (!Number.isFinite(total) || total <= 0) continue;
    pushSegment(bucket, "confirmed-forecast", total);
  }

  // 4. Derive back-compat fields.
  for (const bucket of buckets.values()) deriveDominant(bucket);

  // 5. Next-3 ex-divs, wrapper-filtered.
  const todayIso = now.toISOString().slice(0, 10);
  const candidates: IncomeCalendarNextEx[] = [];
  for (const h of holdings) {
    if (!passesWrapperFilter(h.wrapper, wrapperFilter)) continue;
    const ex = exDivByTicker[h.ticker];
    if (!ex || !ex.ex_date) continue;
    if (ex.ex_date < todayIso) continue;
    const perShare = convertToPrimary(ex.amount, ex.currency, ratesToGbp);
    if (perShare === null) continue;
    const total = perShare * h.quantity;
    if (!Number.isFinite(total) || total <= 0) continue;
    candidates.push({
      ticker: h.ticker,
      exDate: ex.ex_date,
      payDate: ex.pay_date,
      gbp: total,
      wrapper: h.wrapper,
    });
  }
  candidates.sort((a, b) => (a.exDate < b.exDate ? -1 : a.exDate > b.exDate ? 1 : 0));

  return {
    months: Array.from(buckets.values()),
    nextThree: candidates.slice(0, 3),
    primaryCurrency,
  };
}
```

- [ ] **Step 1.2.4: Run all the income-calendar tests to verify they pass**

```bash
npx vitest run --no-file-parallelism lib/portfolio/__tests__/income-calendar.test.ts
```

Expected: all tests PASS (both v1 + v2 describes). If a v1 test fails, the back-compat shape isn't being maintained — investigate `deriveDominant`.

- [ ] **Step 1.2.5: Update callers (dashboard) to pass the new required args**

The dashboard's call site is `dividendmapper/app/app/dashboard/page.tsx`. Locate the existing `buildIncomeCalendar(...)` call and add `locale` + `wrapperFilter` to its args. For the dashboard, both default safely:

```ts
// Inside DashboardPage(), where buildIncomeCalendar is called today:
const calendar = buildIncomeCalendar({
  userDividends,
  holdings,
  exDivByTicker,
  ratesToGbp,
  now: new Date(),
  locale: "uk",          // TODO Slice B: read from user locale state
  wrapperFilter: "all",  // dashboard lite card shows all wrappers
});
```

If the existing `userDividends` / `holdings` shapes don't carry `wrapper`, update the upstream loaders to project the column. Search for the loader source:

```bash
npx grep -rn "buildIncomeCalendar" dividendmapper/app
```

Adjust the upstream `select(...)` to include `wrapper`. If the test for the dashboard page breaks because of new required fields on the shape, update the test fixtures to include `wrapper: 'isa'` (or whichever) on each row.

- [ ] **Step 1.2.6: Run the full lib + dashboard test suite**

```bash
npx vitest run --no-file-parallelism lib/ app/app/dashboard/
```

Expected: all pass.

- [ ] **Step 1.2.7: Commit**

```bash
git add lib/portfolio/income-calendar.ts \
        lib/portfolio/__tests__/income-calendar.test.ts \
        app/app/dashboard/page.tsx \
        app/app/dashboard/_components/
git commit -m "feat(calendar): extend income-calendar with segments + wrapper + locale (Slice A)"
```

---

## Day 2 — `/app/calendar` page shell + Hero KPI strip + wrapper filter

**Outcome.** A Pro-gated `/app/calendar` page renders with the page header, wrapper filter row, and hero KPI strip — chart slot is a placeholder. ~6 new tests.

### Task 2.1 — Pro-gated page route + shell

**Files:**
- Create: `dividendmapper/app/app/calendar/page.tsx`
- Create: `dividendmapper/app/app/calendar/_components/calendar-shell.tsx`
- Test: `dividendmapper/app/app/calendar/__tests__/page.test.tsx`

- [ ] **Step 2.1.1: Write the failing page test**

Create `dividendmapper/app/app/calendar/__tests__/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));

const requireUserMock = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  requireUser: (path: string) => requireUserMock(path),
}));

const loadPricedHoldingsMock = vi.fn();
vi.mock("@/lib/portfolio/load-priced-holdings", () => ({
  loadPricedHoldings: (id: string) => loadPricedHoldingsMock(id),
}));

import CalendarPage from "../page";

describe("/app/calendar page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: "u1", email: "u@example.com" });
  });

  it("calls requireUser with the soft-nav-safe currentPath", async () => {
    loadPricedHoldingsMock.mockResolvedValue({
      tier: "pro",
      allHoldings: [],
      visibleRows: [],
      quotes: [],
      quotesByTicker: {},
      priceByTicker: {},
      nameByTicker: {},
      actualsByKey: new Map(),
      income: { gbp: 0 },
    });
    await CalendarPage();
    expect(requireUserMock).toHaveBeenCalledWith("/app/calendar");
  });

  it("redirects free users to /pricing", async () => {
    loadPricedHoldingsMock.mockResolvedValue({
      tier: "free",
      allHoldings: [],
      visibleRows: [],
      quotes: [],
      quotesByTicker: {},
      priceByTicker: {},
      nameByTicker: {},
      actualsByKey: new Map(),
      income: { gbp: 0 },
    });
    await expect(CalendarPage()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/pricing?from=/app/calendar");
  });
});
```

- [ ] **Step 2.1.2: Run the test to verify it fails**

```bash
npx vitest run --no-file-parallelism app/app/calendar/__tests__/page.test.tsx
```

Expected: FAIL with `Cannot find module '../page'`.

- [ ] **Step 2.1.3: Write the page**

Create `dividendmapper/app/app/calendar/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { loadPricedHoldings } from "@/lib/portfolio/load-priced-holdings";
import { PageHeader } from "../_components/page-header/page-header";
import { CalendarShell } from "./_components/calendar-shell";

export const metadata: Metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

// Per [reference_app_page_auth_guard]: each protected page calls requireUser()
// itself because layout guards don't re-run on soft navs.
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await requireUser("/app/calendar");

  const priced = await loadPricedHoldings(user.id);
  if (priced.tier === "free") {
    redirect("/pricing?from=/app/calendar");
  }

  return (
    <>
      <PageHeader title="Calendar" />
      <CalendarShell priced={priced} userId={user.id} />
    </>
  );
}
```

- [ ] **Step 2.1.4: Write the shell client component (placeholder slots)**

Create `dividendmapper/app/app/calendar/_components/calendar-shell.tsx`:

```tsx
"use client";

// Client wrapper owning the toggle + filter state for /app/calendar.
// Slots: header toggles, wrapper filter row, hero KPI strip, chart, drill-down.
// Day 2 wires the placeholder slots; Days 3-5 fill the chart + drill-down.

import { useState } from "react";
import type { Wrapper, WrapperFilter } from "@/lib/portfolio/income-calendar";

export interface CalendarShellProps {
  // `priced` matches loadPricedHoldings's return shape; we narrow what we need
  // when the data-fetching helper lands.
  priced: unknown;
  userId: string;
}

export function CalendarShell({ priced: _priced, userId: _userId }: CalendarShellProps) {
  const [netMode, setNetMode] = useState<"net" | "gross">("net");
  const [yearMode, setYearMode] = useState<"tax" | "calendar">("tax");
  const [wrapperFilter, setWrapperFilter] = useState<WrapperFilter>("all");

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex items-center justify-end gap-3"
        data-testid="calendar-header-toggles"
      >
        <ToggleGroup
          label="Net / Gross"
          value={netMode}
          options={[
            { value: "net", label: "Net" },
            { value: "gross", label: "Gross" },
          ]}
          onChange={(v) => setNetMode(v as "net" | "gross")}
        />
        <ToggleGroup
          label="Tax year / Calendar year"
          value={yearMode}
          options={[
            { value: "tax", label: "Tax year" },
            { value: "calendar", label: "Calendar year" },
          ]}
          onChange={(v) => setYearMode(v as "tax" | "calendar")}
        />
      </div>
      <div data-testid="calendar-wrapper-filter-slot">
        {/* Wrapper filter row mounts here (Day 2 Task 2.3). */}
      </div>
      <div data-testid="calendar-hero-kpi-slot">
        {/* Hero KPI strip mounts here (Day 2 Task 2.2). */}
      </div>
      <div data-testid="calendar-chart-slot">
        {/* Chart mounts here (Day 3 Task 3.1). */}
      </div>
      <div data-testid="calendar-drilldown-slot">
        {/* Drill-down mounts here (Day 3 Task 3.2). */}
      </div>
    </div>
  );
}

function ToggleGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex overflow-hidden rounded-md border border-[var(--border-subtle)]"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`px-3 py-1 text-xs ${
            o.value === value
              ? "bg-[var(--brand)] text-white"
              : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2.1.5: Run the page test to verify it passes**

```bash
npx vitest run --no-file-parallelism app/app/calendar/__tests__/page.test.tsx
```

Expected: PASS (2 tests).

- [ ] **Step 2.1.6: Commit**

```bash
git add app/app/calendar/page.tsx \
        app/app/calendar/_components/calendar-shell.tsx \
        app/app/calendar/__tests__/page.test.tsx
git commit -m "feat(calendar): /app/calendar Pro-gated page + shell"
```

### Task 2.2 — Hero KPI strip

**Files:**
- Create: `dividendmapper/app/app/calendar/_components/hero-kpi-strip.tsx`
- Test: `dividendmapper/app/app/calendar/_components/__tests__/hero-kpi-strip.test.tsx`

- [ ] **Step 2.2.1: Write the failing test**

Create `dividendmapper/app/app/calendar/_components/__tests__/hero-kpi-strip.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroKpiStrip } from "../hero-kpi-strip";

describe("HeroKpiStrip", () => {
  it("renders the four tiles with correct values in the primary currency", () => {
    render(
      <HeroKpiStrip
        primaryCurrency="GBP"
        next7Days={42}
        next30Days={178}
        ytdReceived={1234}
        last12mReceived={4567}
        includesProjected={false}
      />,
    );
    expect(screen.getByLabelText(/next 7 days/i)).toHaveTextContent("£42");
    expect(screen.getByLabelText(/next 30 days/i)).toHaveTextContent("£178");
    expect(screen.getByLabelText(/ytd received/i)).toHaveTextContent("£1,234");
    expect(screen.getByLabelText(/last 12 months received/i)).toHaveTextContent("£4,567");
  });

  it("uses $ when primaryCurrency is USD", () => {
    render(
      <HeroKpiStrip
        primaryCurrency="USD"
        next7Days={42}
        next30Days={178}
        ytdReceived={1234}
        last12mReceived={4567}
        includesProjected={false}
      />,
    );
    expect(screen.getByLabelText(/next 7 days/i)).toHaveTextContent("$42");
  });

  it("renders the includes-projected footnote tooltip when applicable", () => {
    render(
      <HeroKpiStrip
        primaryCurrency="GBP"
        next7Days={42}
        next30Days={178}
        ytdReceived={1234}
        last12mReceived={4567}
        includesProjected
      />,
    );
    expect(screen.getByText(/incl\. projected/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2.2.2: Run to verify failure**

```bash
npx vitest run --no-file-parallelism app/app/calendar/_components/__tests__/hero-kpi-strip.test.tsx
```

Expected: FAIL with module-not-found.

- [ ] **Step 2.2.3: Implement HeroKpiStrip**

Create `dividendmapper/app/app/calendar/_components/hero-kpi-strip.tsx`:

```tsx
// Four-tile KPI strip at the top of /app/calendar. Locale-aware primary
// currency. The `(incl. projected)` footnote renders only when the parent
// signals that any tile sum includes projected payments (Slice B turns this
// on; Slice A always passes false).

const NUMBER_FMT_GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
const NUMBER_FMT_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatPrimary(n: number, currency: "GBP" | "USD"): string {
  const fmt = currency === "USD" ? NUMBER_FMT_USD : NUMBER_FMT_GBP;
  return fmt.format(Math.round(n));
}

export interface HeroKpiStripProps {
  primaryCurrency: "GBP" | "USD";
  next7Days: number;
  next30Days: number;
  ytdReceived: number;
  last12mReceived: number;
  includesProjected: boolean;
}

export function HeroKpiStrip(props: HeroKpiStripProps) {
  const {
    primaryCurrency,
    next7Days,
    next30Days,
    ytdReceived,
    last12mReceived,
    includesProjected,
  } = props;

  const tiles: ReadonlyArray<{ key: string; label: string; value: number }> = [
    { key: "next7", label: "Next 7 days", value: next7Days },
    { key: "next30", label: "Next 30 days", value: next30Days },
    { key: "ytd", label: "YTD received", value: ytdReceived },
    { key: "last12", label: "Last 12 months received", value: last12mReceived },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.key}
            aria-label={t.label}
            className="card-surface flex flex-col gap-1 p-4"
          >
            <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {t.label}
            </span>
            <span className="font-mono text-2xl tabular-nums text-[var(--text)]">
              {formatPrimary(t.value, primaryCurrency)}
            </span>
          </div>
        ))}
      </div>
      {includesProjected && (
        <p className="mt-2 text-[10px] text-[var(--text-muted)]">
          (incl. projected)
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2.2.4: Run the test to verify it passes**

```bash
npx vitest run --no-file-parallelism app/app/calendar/_components/__tests__/hero-kpi-strip.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 2.2.5: Commit**

```bash
git add app/app/calendar/_components/hero-kpi-strip.tsx \
        app/app/calendar/_components/__tests__/hero-kpi-strip.test.tsx
git commit -m "feat(calendar): HeroKpiStrip with locale-aware currency"
```

### Task 2.3 — Wrapper filter row

**Files:**
- Create: `dividendmapper/app/app/calendar/_components/wrapper-filter-row.tsx`
- Test: `dividendmapper/app/app/calendar/_components/__tests__/wrapper-filter-row.test.tsx`

- [ ] **Step 2.3.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WrapperFilterRow } from "../wrapper-filter-row";

describe("WrapperFilterRow", () => {
  it("UK locale shows All · ISA · SIPP · GIA chips", () => {
    render(<WrapperFilterRow locale="uk" value="all" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ISA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SIPP" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GIA" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /401/ })).toBeNull();
  });

  it("US locale shows All · 401(k) · IRA · Roth IRA · Brokerage chips", () => {
    render(<WrapperFilterRow locale="us" value="all" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "401(k)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "IRA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Roth IRA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Brokerage" })).toBeInTheDocument();
  });

  it("clicking a chip calls onChange with the wrapper value", () => {
    const onChange = vi.fn();
    render(<WrapperFilterRow locale="uk" value="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "ISA" }));
    expect(onChange).toHaveBeenCalledWith("isa");
  });
});
```

- [ ] **Step 2.3.2: Run to verify failure**

Expected: module-not-found.

- [ ] **Step 2.3.3: Implement WrapperFilterRow**

Create `dividendmapper/app/app/calendar/_components/wrapper-filter-row.tsx`:

```tsx
"use client";

import type { Locale, Wrapper, WrapperFilter } from "@/lib/portfolio/income-calendar";

interface ChipDef {
  value: WrapperFilter;
  label: string;
}

const UK_CHIPS: ReadonlyArray<ChipDef> = [
  { value: "all", label: "All" },
  { value: "isa", label: "ISA" },
  { value: "sipp", label: "SIPP" },
  { value: "gia", label: "GIA" },
];

const US_CHIPS: ReadonlyArray<ChipDef> = [
  { value: "all", label: "All" },
  { value: "401k", label: "401(k)" },
  { value: "ira", label: "IRA" },
  { value: "roth_ira", label: "Roth IRA" },
  { value: "brokerage", label: "Brokerage" },
];

export interface WrapperFilterRowProps {
  locale: Locale;
  value: WrapperFilter;
  onChange: (v: WrapperFilter) => void;
}

export function WrapperFilterRow({ locale, value, onChange }: WrapperFilterRowProps) {
  const chips = locale === "us" ? US_CHIPS : UK_CHIPS;
  return (
    <div className="flex gap-2 overflow-x-auto" role="toolbar" aria-label="Wrapper filter">
      {chips.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          aria-pressed={c.value === value}
          className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
            c.value === value
              ? "border-[var(--brand)] bg-[var(--brand)] text-white"
              : "border-[var(--border-subtle)] bg-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2.3.4: Run the test to verify it passes**

Expected: PASS (3 tests).

- [ ] **Step 2.3.5: Commit**

```bash
git add app/app/calendar/_components/wrapper-filter-row.tsx \
        app/app/calendar/_components/__tests__/wrapper-filter-row.test.tsx
git commit -m "feat(calendar): WrapperFilterRow locale-driven chips"
```

---

## Day 3 — Chart + drill-down panel + cadence timeline

**Outcome.** The 18-month chart + per-payment list + cadence timeline render correctly against fixtures. ~10 new tests.

### Task 3.1 — CalendarChart (Slice A segment kinds)

**Files:**
- Create: `dividendmapper/app/app/calendar/_components/calendar-chart.tsx`
- Test: `dividendmapper/app/app/calendar/_components/__tests__/calendar-chart.test.tsx`

- [ ] **Step 3.1.1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarChart } from "../calendar-chart";
import type { IncomeCalendarMonth } from "@/lib/portfolio/income-calendar";

function bucket(ym: string, kind: IncomeCalendarMonth["kind"], primary: number): IncomeCalendarMonth {
  return {
    ym,
    segments: primary > 0 ? [{ kind, primary }] : [],
    gbp: primary,
    kind,
  };
}

describe("CalendarChart (Slice A)", () => {
  const months: IncomeCalendarMonth[] = [
    bucket("2025-12", "actual", 100),
    bucket("2026-01", "actual", 120),
    bucket("2026-02", "actual", 90),
    bucket("2026-03", "actual", 110),
    bucket("2026-04", "actual", 130),
    bucket("2026-05", "actual", 80),
    bucket("2026-06", "partial", 40),
    bucket("2026-07", "confirmed-forecast", 95),
    bucket("2026-08", "confirmed-forecast", 0),
    bucket("2026-09", "confirmed-forecast", 70),
    bucket("2026-10", "confirmed-forecast", 0),
    bucket("2026-11", "confirmed-forecast", 0),
    bucket("2026-12", "confirmed-forecast", 0),
    bucket("2027-01", "confirmed-forecast", 0),
    bucket("2027-02", "confirmed-forecast", 0),
    bucket("2027-03", "confirmed-forecast", 0),
    bucket("2027-04", "confirmed-forecast", 0),
    bucket("2027-05", "confirmed-forecast", 0),
    bucket("2027-06", "confirmed-forecast", 0),
  ];

  it("renders 19 month labels", () => {
    render(<CalendarChart months={months} onSelectMonth={() => {}} />);
    expect(screen.getAllByTestId("calendar-month-label")).toHaveLength(19);
  });

  it("renders bars with correct data-kind on each", () => {
    render(<CalendarChart months={months} onSelectMonth={() => {}} />);
    const bars = screen.getAllByTestId("calendar-bar-segment");
    expect(bars.length).toBeGreaterThan(0);
    expect(bars.find((b) => b.getAttribute("data-kind") === "actual")).toBeTruthy();
    expect(bars.find((b) => b.getAttribute("data-kind") === "partial")).toBeTruthy();
    expect(bars.find((b) => b.getAttribute("data-kind") === "confirmed-forecast")).toBeTruthy();
  });

  it("renders the today divider with a `today` label badge after the partial month", () => {
    render(<CalendarChart months={months} onSelectMonth={() => {}} />);
    const divider = screen.getByTestId("today-divider");
    expect(divider).toHaveTextContent(/today/i);
  });

  it("clicking a bar calls onSelectMonth with the YM", () => {
    const onSelect = vi.fn();
    render(<CalendarChart months={months} onSelectMonth={onSelect} />);
    const aprBar = screen.getByTestId("calendar-bar-2026-04");
    aprBar.click();
    expect(onSelect).toHaveBeenCalledWith("2026-04");
  });

  it("supports prefers-reduced-motion via a data-attribute the CSS keys on", () => {
    render(<CalendarChart months={months} onSelectMonth={() => {}} />);
    expect(screen.getByTestId("calendar-chart-root")).toHaveAttribute("data-respect-reduced-motion", "true");
  });
});
```

(Add `import { vi } from "vitest";` at the top.)

- [ ] **Step 3.1.2: Run to verify failure**

Expected: module-not-found.

- [ ] **Step 3.1.3: Implement CalendarChart**

Create `dividendmapper/app/app/calendar/_components/calendar-chart.tsx`:

```tsx
"use client";

// 18-month chart (6 back + current + 12 forward = 19 buckets) with
// stack-aware bars. Slice A uses 3 segment kinds; Slice B teaches it 3 more.
// Pure presentational — receives buckets from buildIncomeCalendar.

import type { IncomeCalendarMonth, SegmentKind } from "@/lib/portfolio/income-calendar";

const MONTH_LABEL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthName(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return MONTH_LABEL[m - 1] ?? ym;
}

// Opacity per segment kind. Slice B adds projected-cadence etc.
const OPACITY: Record<SegmentKind, number> = {
  "actual": 1,
  "partial": 0.7,
  "confirmed-forecast": 0.4,
  "projected-cadence": 0.3,
  "projected-growth": 0.35,
  "growth-clipped": 0.35,
};

export interface CalendarChartProps {
  months: ReadonlyArray<IncomeCalendarMonth>;
  onSelectMonth: (ym: string) => void;
  selectedYm?: string;
}

export function CalendarChart({ months, onSelectMonth, selectedYm }: CalendarChartProps) {
  const max = months.reduce((m, b) => (b.gbp > m ? b.gbp : m), 0);
  const partialIndex = months.findIndex((m) => m.kind === "partial");
  const dividerLeft =
    partialIndex >= 0
      ? `${((partialIndex + 1) / months.length) * 100}%`
      : null;

  return (
    <div data-testid="calendar-chart-root" data-respect-reduced-motion="true">
      <section
        role="figure"
        aria-label={`Income calendar 18-month chart`}
        className="relative h-[220px] flex items-end gap-1.5 border-b border-[var(--border-subtle)]"
      >
        {months.map((m) => {
          const heightPct = max > 0 ? Math.max(4, (m.gbp / max) * 100) : 4;
          return (
            <button
              key={m.ym}
              type="button"
              data-testid={`calendar-bar-${m.ym}`}
              onClick={() => onSelectMonth(m.ym)}
              aria-pressed={selectedYm === m.ym}
              aria-label={`${monthName(m.ym)} ${m.ym}`}
              className="flex-1 flex flex-col-reverse"
              style={{ height: `${heightPct}%` }}
            >
              {m.segments.map((seg, i) => {
                const segHeight = max > 0 && m.gbp > 0 ? (seg.primary / m.gbp) * 100 : 0;
                return (
                  <span
                    key={`${m.ym}-${seg.kind}-${i}`}
                    data-testid="calendar-bar-segment"
                    data-kind={seg.kind}
                    className="block w-full first:rounded-t-sm"
                    style={{
                      height: `${segHeight}%`,
                      backgroundColor: "var(--brand)",
                      opacity: OPACITY[seg.kind],
                    }}
                  />
                );
              })}
            </button>
          );
        })}
        {dividerLeft !== null && (
          <div
            data-testid="today-divider"
            aria-hidden="true"
            className="pointer-events-none absolute top-0 bottom-0 flex items-start"
            style={{ left: dividerLeft }}
          >
            <span className="-translate-x-1/2 rounded-sm bg-[var(--brand)] px-1 text-[9px] font-medium uppercase text-white">
              today
            </span>
            <span className="absolute top-3 bottom-0 left-0 border-l border-dashed border-[var(--border)]" />
          </div>
        )}
      </section>
      <div className="mt-1.5 flex gap-1.5">
        {months.map((m) => (
          <span
            key={m.ym}
            data-testid="calendar-month-label"
            className={`flex-1 text-center text-[10px] tabular-nums ${
              m.kind === "partial"
                ? "text-[var(--text)] font-semibold"
                : "text-[var(--text-muted)]"
            }`}
          >
            {monthName(m.ym)}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3.1.4: Run the test to verify it passes**

Expected: PASS (5 tests).

- [ ] **Step 3.1.5: Commit**

```bash
git add app/app/calendar/_components/calendar-chart.tsx \
        app/app/calendar/_components/__tests__/calendar-chart.test.tsx
git commit -m "feat(calendar): CalendarChart 18-month segment-aware bars"
```

### Task 3.2 — DrilldownPanel (per-payment list)

**Files:**
- Create: `dividendmapper/app/app/calendar/_components/drilldown-panel.tsx`
- Test: `dividendmapper/app/app/calendar/_components/__tests__/drilldown-panel.test.tsx`

- [ ] **Step 3.2.1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DrilldownPanel } from "../drilldown-panel";

describe("DrilldownPanel", () => {
  it("renders one row per payment with ticker, dates, native + primary, wrapper badge", () => {
    render(
      <DrilldownPanel
        primaryCurrency="GBP"
        payments={[
          {
            ticker: "PHP.L",
            exDate: "2026-07-02",
            payDate: "2026-07-09",
            nativeAmount: 42,
            nativeCurrency: "GBp",
            primaryAmount: 0.42,
            wrapper: "isa",
            confidence: "confirmed",
          },
          {
            ticker: "O",
            exDate: "2026-07-11",
            payDate: "2026-07-15",
            nativeAmount: 0.265,
            nativeCurrency: "USD",
            primaryAmount: 0.21,
            wrapper: "gia",
            confidence: "confirmed",
          },
        ]}
      />,
    );
    expect(screen.getByText("PHP.L")).toBeInTheDocument();
    expect(screen.getByText("O")).toBeInTheDocument();
    const isaBadge = screen.getByText(/ISA/);
    expect(isaBadge).toHaveAttribute("data-wrapper-class", "sheltered");
    const giaBadge = screen.getByText(/GIA/);
    expect(giaBadge).toHaveAttribute("data-wrapper-class", "taxable");
  });

  it("empty state distinguishes 'no dividend' from 'no announcement'", () => {
    render(
      <DrilldownPanel
        primaryCurrency="GBP"
        payments={[]}
        emptyReason="no-announcement"
      />,
    );
    expect(screen.getByText(/no announcement yet/i)).toBeInTheDocument();

    render(
      <DrilldownPanel
        primaryCurrency="GBP"
        payments={[]}
        emptyReason="non-paying"
      />,
    );
    expect(screen.getByText(/doesn't pay a dividend/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3.2.2: Run to verify failure**

Expected: module-not-found.

- [ ] **Step 3.2.3: Implement DrilldownPanel**

Create `dividendmapper/app/app/calendar/_components/drilldown-panel.tsx`:

```tsx
"use client";

import type { Wrapper } from "@/lib/portfolio/income-calendar";

const SHELTERED = new Set<Wrapper>(["isa", "sipp", "401k", "ira", "roth_ira"]);

const WRAPPER_LABEL: Record<Wrapper, string> = {
  isa: "ISA",
  sipp: "SIPP",
  gia: "GIA",
  "401k": "401(k)",
  ira: "IRA",
  roth_ira: "Roth IRA",
  brokerage: "Brokerage",
};

export type ProjectedConfidence =
  | "confirmed"
  | "projected-cadence"
  | "projected-growth"
  | "growth-clipped";

export interface DrilldownPayment {
  ticker: string;
  exDate: string;
  payDate: string | null;
  nativeAmount: number;
  nativeCurrency: string;
  primaryAmount: number;
  wrapper: Wrapper;
  confidence: ProjectedConfidence;
}

export interface DrilldownPanelProps {
  primaryCurrency: "GBP" | "USD";
  payments: ReadonlyArray<DrilldownPayment>;
  emptyReason?: "no-announcement" | "non-paying" | "no-holdings";
}

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return SHORT_DATE.format(new Date(`${iso}T00:00:00Z`));
}

function formatPrimary(n: number, currency: "GBP" | "USD"): string {
  const fmt = new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  return fmt.format(n);
}

function emptyMessage(reason: DrilldownPanelProps["emptyReason"]): string {
  switch (reason) {
    case "no-announcement":
      return "No announcement yet — we'll fill this in when the next ex-dividend is published.";
    case "non-paying":
      return "This stock doesn't pay a dividend.";
    case "no-holdings":
    default:
      return "No upcoming payments in this period.";
  }
}

export function DrilldownPanel({ primaryCurrency, payments, emptyReason }: DrilldownPanelProps) {
  if (payments.length === 0) {
    return (
      <p className="card-surface p-4 text-sm text-[var(--text-muted)]">
        {emptyMessage(emptyReason)}
      </p>
    );
  }

  return (
    <div className="card-surface p-4">
      <ul className="divide-y divide-[var(--border-subtle)]">
        {payments.map((p, i) => {
          const wrapperClass = SHELTERED.has(p.wrapper) ? "sheltered" : "taxable";
          return (
            <li
              key={`${p.ticker}-${p.exDate}-${i}`}
              className="grid grid-cols-[80px_1fr_auto_auto_auto] items-baseline gap-3 py-2 text-xs"
            >
              <span className="font-mono text-[var(--text)]">{p.ticker}</span>
              <span className="text-[var(--text-muted)]">
                ex {formatDate(p.exDate)} · pay {formatDate(p.payDate)}
              </span>
              <span className="text-[var(--text-muted)]">
                {p.nativeAmount.toFixed(2)} {p.nativeCurrency}
              </span>
              <span className="font-mono tabular-nums text-[var(--text)]">
                {formatPrimary(p.primaryAmount, primaryCurrency)}
              </span>
              <span
                data-wrapper-class={wrapperClass}
                className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] ${
                  wrapperClass === "sheltered"
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--border-subtle)] text-[var(--text-muted)]"
                }`}
              >
                {WRAPPER_LABEL[p.wrapper]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3.2.4: Run the test to verify it passes**

Expected: PASS (2 tests).

- [ ] **Step 3.2.5: Commit**

```bash
git add app/app/calendar/_components/drilldown-panel.tsx \
        app/app/calendar/_components/__tests__/drilldown-panel.test.tsx
git commit -m "feat(calendar): DrilldownPanel per-payment list + wrapper badges"
```

### Task 3.3 — CadenceTimeline (1–31 day axis)

**Files:**
- Create: `dividendmapper/app/app/calendar/_components/cadence-timeline.tsx`
- Test: `dividendmapper/app/app/calendar/_components/__tests__/cadence-timeline.test.tsx`

- [ ] **Step 3.3.1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CadenceTimeline } from "../cadence-timeline";

describe("CadenceTimeline", () => {
  it("renders a marker for each payment at the correct horizontal position", () => {
    render(
      <CadenceTimeline
        monthYm="2026-07"
        anchor="ex"
        markers={[
          { id: "PHP.L-2026-07-02", dayOfMonth: 2 },
          { id: "BATS.L-2026-07-09", dayOfMonth: 9 },
          { id: "O-2026-07-11", dayOfMonth: 11 },
        ]}
      />,
    );
    const markers = screen.getAllByTestId("cadence-marker");
    expect(markers).toHaveLength(3);
    expect(markers[0]).toHaveAttribute("data-day", "2");
    expect(markers[1]).toHaveAttribute("data-day", "9");
    expect(markers[2]).toHaveAttribute("data-day", "11");
  });

  it("flags markers within 3 days of today as `pulse`", () => {
    render(
      <CadenceTimeline
        monthYm="2026-07"
        anchor="ex"
        today="2026-07-10"
        markers={[
          { id: "PHP.L-2026-07-02", dayOfMonth: 2 },
          { id: "BATS.L-2026-07-09", dayOfMonth: 9 },
          { id: "O-2026-07-11", dayOfMonth: 11 },
          { id: "SSE.L-2026-07-23", dayOfMonth: 23 },
        ]}
      />,
    );
    const markers = screen.getAllByTestId("cadence-marker");
    // 7th-13th are within 3 days of the 10th.
    expect(markers.find((m) => m.dataset.day === "9")).toHaveAttribute("data-pulse", "true");
    expect(markers.find((m) => m.dataset.day === "11")).toHaveAttribute("data-pulse", "true");
    expect(markers.find((m) => m.dataset.day === "2")).toHaveAttribute("data-pulse", "false");
    expect(markers.find((m) => m.dataset.day === "23")).toHaveAttribute("data-pulse", "false");
  });
});
```

- [ ] **Step 3.3.2: Run to verify failure**

Expected: module-not-found.

- [ ] **Step 3.3.3: Implement CadenceTimeline**

Create `dividendmapper/app/app/calendar/_components/cadence-timeline.tsx`:

```tsx
"use client";

export interface CadenceMarker {
  id: string;
  dayOfMonth: number;
}

export interface CadenceTimelineProps {
  monthYm: string;          // "2026-07" — used for the title only
  anchor: "ex" | "pay";     // which date the marker represents
  markers: ReadonlyArray<CadenceMarker>;
  today?: string;           // "YYYY-MM-DD"; when set, markers within 3 days pulse
  onHoverMarker?: (id: string | null) => void;
}

const DAYS_IN_MONTH = 31;

function isPulseDay(day: number, today: string | undefined, monthYm: string): boolean {
  if (!today) return false;
  if (today.slice(0, 7) !== monthYm) return false;
  const todayDay = Number(today.slice(8, 10));
  return Math.abs(todayDay - day) <= 3;
}

export function CadenceTimeline({
  monthYm,
  anchor,
  markers,
  today,
  onHoverMarker,
}: CadenceTimelineProps) {
  return (
    <div className="mt-3" aria-label={`Cadence timeline for ${monthYm} (${anchor}-date anchor)`}>
      <div className="relative h-6 border-b border-[var(--border-subtle)]">
        {markers.map((m) => {
          const leftPct = ((m.dayOfMonth - 1) / (DAYS_IN_MONTH - 1)) * 100;
          const pulse = isPulseDay(m.dayOfMonth, today, monthYm);
          return (
            <span
              key={m.id}
              data-testid="cadence-marker"
              data-day={m.dayOfMonth}
              data-pulse={pulse ? "true" : "false"}
              onMouseEnter={() => onHoverMarker?.(m.id)}
              onMouseLeave={() => onHoverMarker?.(null)}
              className={`absolute top-1 h-3 w-3 -translate-x-1/2 rounded-full bg-[var(--brand)] ${
                pulse ? "animate-pulse" : ""
              }`}
              style={{ left: `${leftPct}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-[var(--text-muted)]">
        <span>1</span>
        <span>{DAYS_IN_MONTH}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.3.4: Run the test to verify it passes**

Expected: PASS (2 tests).

- [ ] **Step 3.3.5: Commit**

```bash
git add app/app/calendar/_components/cadence-timeline.tsx \
        app/app/calendar/_components/__tests__/cadence-timeline.test.tsx
git commit -m "feat(calendar): CadenceTimeline 1-31 SVG-free day axis"
```

---

## Day 4 — Empty-state CTA + dashboard lite-card update + nav-items

**Outcome.** Empty-state CTA renders conditionally. Dashboard card links into `/app/calendar`. Drawer nav has the Calendar entry. ~5 new tests.

### Task 4.1 — EmptyStateCta

**Files:**
- Create: `dividendmapper/app/app/calendar/_components/empty-state-cta.tsx`
- Test: `dividendmapper/app/app/calendar/_components/__tests__/empty-state-cta.test.tsx`

- [ ] **Step 4.1.1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyStateCta } from "../empty-state-cta";

describe("EmptyStateCta", () => {
  it("renders the two CTA buttons", () => {
    render(<EmptyStateCta />);
    expect(screen.getByRole("link", { name: /connect broker/i })).toHaveAttribute(
      "href",
      "/app/account/brokers",
    );
    expect(screen.getByRole("button", { name: /import csv/i })).toBeInTheDocument();
  });

  it("renders the headline and body copy", () => {
    render(<EmptyStateCta />);
    expect(screen.getByText(/past dividends not showing up/i)).toBeInTheDocument();
    expect(screen.getByText(/connect trading 212/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4.1.2: Run to verify failure** — module-not-found.

- [ ] **Step 4.1.3: Implement EmptyStateCta**

Create `dividendmapper/app/app/calendar/_components/empty-state-cta.tsx`:

```tsx
"use client";

import Link from "next/link";

export interface EmptyStateCtaProps {
  onClickImportCsv?: () => void;
}

export function EmptyStateCta({ onClickImportCsv }: EmptyStateCtaProps) {
  return (
    <div className="card-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-[var(--text)]">
          Past dividends not showing up?
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Connect Trading 212 to auto-sync, or import a CSV of past payments.
        </p>
      </div>
      <div className="flex gap-2">
        <Link
          href="/app/account/brokers"
          className="rounded-md border border-[var(--brand)] bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white"
        >
          Connect broker →
        </Link>
        <button
          type="button"
          onClick={onClickImportCsv}
          className="rounded-md border border-[var(--border-subtle)] bg-transparent px-3 py-1.5 text-xs font-medium text-[var(--text)]"
        >
          Import CSV →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.1.4: Run the test to verify it passes** — PASS (2 tests).

- [ ] **Step 4.1.5: Commit**

```bash
git add app/app/calendar/_components/empty-state-cta.tsx \
        app/app/calendar/_components/__tests__/empty-state-cta.test.tsx
git commit -m "feat(calendar): EmptyStateCta — past-dividends import nudge"
```

### Task 4.2 — Wire shell to render full surface

**Files:**
- Modify: `dividendmapper/app/app/calendar/_components/calendar-shell.tsx`
- Modify: `dividendmapper/app/app/calendar/page.tsx` (to fetch + pass data)

- [ ] **Step 4.2.1: Audit the loader shape**

Run:

```bash
npx grep -n "loadPricedHoldings\b" dividendmapper/lib/portfolio/
```

Note the existing return type so the shell can consume `userDividends`, `holdings` (with `wrapper` + `created_at`), `ratesToGbp`, `priceByTicker`, `exDivByTicker`. If the existing loader doesn't already include the projection-relevant fields (it does today for the dashboard card), extend it with additive selects. Adding columns to a Supabase `.select()` is safe and does not require a migration.

- [ ] **Step 4.2.2: Update `page.tsx` to build the calendar and pass it down**

Replace the body of `dividendmapper/app/app/calendar/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { loadPricedHoldings } from "@/lib/portfolio/load-priced-holdings";
import { buildIncomeCalendar } from "@/lib/portfolio/income-calendar";
import { PageHeader } from "../_components/page-header/page-header";
import { CalendarShell } from "./_components/calendar-shell";

export const metadata: Metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await requireUser("/app/calendar");

  const priced = await loadPricedHoldings(user.id);
  if (priced.tier === "free") {
    redirect("/pricing?from=/app/calendar");
  }

  // TODO Slice B: read locale from user settings. UK default for now.
  const locale = "uk" as const;

  const calendar = buildIncomeCalendar({
    userDividends: priced.userDividends ?? [],
    holdings: priced.allHoldings.map((h) => ({
      ticker: h.ticker,
      quantity: h.quantity,
      wrapper: h.wrapper,
      created_at: h.created_at,
    })),
    exDivByTicker: priced.exDivByTicker ?? {},
    ratesToGbp: priced.ratesToGbp ?? { GBP: 1 },
    now: new Date(),
    locale,
    wrapperFilter: "all",
  });

  const pastUserDividendsCount = (priced.userDividends ?? []).filter((d) => {
    const sixMoAgo = new Date();
    sixMoAgo.setMonth(sixMoAgo.getMonth() - 6);
    return new Date(d.paid_on) >= sixMoAgo;
  }).length;

  return (
    <>
      <PageHeader title="Calendar" />
      <CalendarShell
        locale={locale}
        calendar={calendar}
        priced={priced}
        showEmptyStateCta={pastUserDividendsCount === 0}
      />
    </>
  );
}
```

If `priced` doesn't expose `userDividends`/`exDivByTicker`/`ratesToGbp` directly, extend `loadPricedHoldings` (or write a thin wrapper) so the page only has to await once. Keep all DB work inside the loader; the page composes only.

- [ ] **Step 4.2.3: Update `calendar-shell.tsx` to wire the children**

Replace the body of `dividendmapper/app/app/calendar/_components/calendar-shell.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import type { Locale, WrapperFilter, IncomeCalendarResult } from "@/lib/portfolio/income-calendar";
import { HeroKpiStrip } from "./hero-kpi-strip";
import { WrapperFilterRow } from "./wrapper-filter-row";
import { CalendarChart } from "./calendar-chart";
import { DrilldownPanel } from "./drilldown-panel";
import { CadenceTimeline } from "./cadence-timeline";
import { EmptyStateCta } from "./empty-state-cta";
import { computeNetDividend } from "@/lib/portfolio/dividend-tax";

export interface CalendarShellProps {
  locale: Locale;
  calendar: IncomeCalendarResult;
  priced: {
    userDividends?: ReadonlyArray<{ amount: number; paid_on: string; currency: string; wrapper: string }>;
    ratesToPrimary?: Record<string, number>;
  };
  showEmptyStateCta: boolean;
}

export function CalendarShell({ locale, calendar, priced, showEmptyStateCta }: CalendarShellProps) {
  const [netMode, setNetMode] = useState<"net" | "gross">("net");
  const [yearMode, setYearMode] = useState<"tax" | "calendar">("tax");
  const [wrapperFilter, setWrapperFilter] = useState<WrapperFilter>("all");
  const [selectedYm, setSelectedYm] = useState<string>(() => {
    const partial = calendar.months.find((m) => m.kind === "partial");
    return partial?.ym ?? calendar.months[0]?.ym ?? "";
  });

  // KPIs computed from the supplied calendar + raw user_dividends. The
  // wrapperFilter chip filters in-memory; net mode runs each payment through
  // computeNetDividend. Calendar/tax year toggle re-buckets YTD only.
  const kpis = useMemo(
    () =>
      computeKpis(
        calendar,
        wrapperFilter,
        netMode,
        locale,
        priced.userDividends ?? [],
        priced.ratesToPrimary ?? { GBP: 1, USD: 1 },
        yearMode,
      ),
    [calendar, wrapperFilter, netMode, locale, priced, yearMode],
  );

  const selectedMonth = calendar.months.find((m) => m.ym === selectedYm);
  const drilldownPayments = useMemo(
    () => buildDrilldownPayments(calendar, selectedYm, netMode, locale, wrapperFilter),
    [calendar, selectedYm, netMode, locale, wrapperFilter],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end gap-3">
        {/* Net / Gross + Year toggles unchanged from Day 2 */}
      </div>
      <WrapperFilterRow locale={locale} value={wrapperFilter} onChange={setWrapperFilter} />
      {showEmptyStateCta && <EmptyStateCta />}
      <HeroKpiStrip
        primaryCurrency={calendar.primaryCurrency}
        next7Days={kpis.next7Days}
        next30Days={kpis.next30Days}
        ytdReceived={kpis.ytdReceived}
        last12mReceived={kpis.last12mReceived}
        includesProjected={false}
      />
      <CalendarChart
        months={calendar.months}
        onSelectMonth={setSelectedYm}
        selectedYm={selectedYm}
      />
      <DrilldownPanel
        primaryCurrency={calendar.primaryCurrency}
        payments={drilldownPayments}
        emptyReason={drilldownPayments.length === 0 ? "no-announcement" : undefined}
      />
      <CadenceTimeline
        monthYm={selectedYm}
        anchor="ex"
        today={new Date().toISOString().slice(0, 10)}
        markers={drilldownPayments
          .filter((p) => p.exDate.slice(0, 7) === selectedYm)
          .map((p) => ({ id: `${p.ticker}-${p.exDate}`, dayOfMonth: Number(p.exDate.slice(8, 10)) }))}
      />
    </div>
  );
}

function computeKpis(
  calendar: IncomeCalendarResult,
  filter: WrapperFilter,
  netMode: "net" | "gross",
  locale: Locale,
  userDividends: ReadonlyArray<{ paid_on: string; amount: number; currency: string; wrapper: string }>,
  ratesToPrimary: Record<string, number>,
  yearMode: "tax" | "calendar",
): { next7Days: number; next30Days: number; ytdReceived: number; last12mReceived: number } {
  const next7Days = calendar.nextThree
    .filter((p) => filter === "all" || p.wrapper === filter)
    .filter((p) => withinDays(p.exDate, 7))
    .reduce((s, p) => s + applyNet(p.gbp, p.wrapper, netMode, locale), 0);
  const next30Days = calendar.nextThree
    .filter((p) => filter === "all" || p.wrapper === filter)
    .filter((p) => withinDays(p.exDate, 30))
    .reduce((s, p) => s + applyNet(p.gbp, p.wrapper, netMode, locale), 0);

  // YTD start: tax year boundary per locale, or Jan 1 if yearMode='calendar'.
  // UK tax year starts April 6; US calendar = US tax year.
  const now = new Date();
  let ytdStart: Date;
  if (yearMode === "calendar") {
    ytdStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  } else if (locale === "uk") {
    const thisYearStart = new Date(Date.UTC(now.getUTCFullYear(), 3, 6));    // Apr 6
    ytdStart = now >= thisYearStart ? thisYearStart : new Date(Date.UTC(now.getUTCFullYear() - 1, 3, 6));
  } else {
    ytdStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));               // US tax year = calendar
  }

  const ytd = userDividends
    .filter((d) => filter === "all" || d.wrapper === filter)
    .filter((d) => new Date(d.paid_on) >= ytdStart)
    .reduce((s, d) => {
      const rate = ratesToPrimary[d.currency] ?? 0;
      const primary = d.amount * rate;
      return s + applyNet(primary, d.wrapper, netMode, locale);
    }, 0);

  const twelveMoAgo = new Date(now.getTime() - 365 * 86_400_000);
  const last12m = userDividends
    .filter((d) => filter === "all" || d.wrapper === filter)
    .filter((d) => new Date(d.paid_on) >= twelveMoAgo)
    .reduce((s, d) => {
      const rate = ratesToPrimary[d.currency] ?? 0;
      const primary = d.amount * rate;
      return s + applyNet(primary, d.wrapper, netMode, locale);
    }, 0);

  return { next7Days, next30Days, ytdReceived: ytd, last12mReceived: last12m };
}

function withinDays(iso: string, days: number): boolean {
  const target = new Date(iso).getTime();
  const now = Date.now();
  return target - now <= days * 86_400_000 && target >= now;
}

function applyNet(gross: number, wrapper: string, mode: "net" | "gross", locale: Locale): number {
  if (mode === "gross") return gross;
  const { net } = computeNetDividend({
    grossPrimaryCurrency: gross,
    wrapper: wrapper as never,
    locale,
    ytdGrossInTaxableSoFar: 0,
  });
  return net;
}

function buildDrilldownPayments(
  calendar: IncomeCalendarResult,
  selectedYm: string,
  _netMode: "net" | "gross",
  _locale: Locale,
  filter: WrapperFilter,
) {
  // For Slice A we project nextThree into the drill-down. Slice B replaces
  // this with a richer per-month list assembled from the segments.
  return calendar.nextThree
    .filter((p) => p.exDate.slice(0, 7) === selectedYm)
    .filter((p) => filter === "all" || p.wrapper === filter)
    .map((p) => ({
      ticker: p.ticker,
      exDate: p.exDate,
      payDate: p.payDate,
      nativeAmount: p.gbp, // TODO Slice B: surface native amount via richer next-3 shape
      nativeCurrency: calendar.primaryCurrency,
      primaryAmount: p.gbp,
      wrapper: p.wrapper,
      confidence: "confirmed" as const,
    }));
}
```

- [ ] **Step 4.2.4: Add the integration test for the shell**

Create `dividendmapper/app/app/calendar/_components/__tests__/calendar-shell.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarShell } from "../calendar-shell";

const stubCalendar = {
  months: [
    { ym: "2026-06", segments: [{ kind: "partial" as const, primary: 40 }], gbp: 40, kind: "partial" as const },
    { ym: "2026-07", segments: [{ kind: "confirmed-forecast" as const, primary: 95 }], gbp: 95, kind: "confirmed-forecast" as const },
  ],
  nextThree: [
    { ticker: "PHP.L", exDate: "2026-07-02", payDate: "2026-07-09", gbp: 42, wrapper: "isa" as const },
  ],
  primaryCurrency: "GBP" as const,
};

describe("CalendarShell wiring", () => {
  it("clicking a wrapper chip filters the drill-down", () => {
    render(
      <CalendarShell
        locale="uk"
        calendar={stubCalendar}
        priced={{ userDividends: [] }}
        showEmptyStateCta={false}
      />,
    );
    expect(screen.getByText("PHP.L")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "GIA" }));
    expect(screen.queryByText("PHP.L")).toBeNull();
  });

  it("renders EmptyStateCta when showEmptyStateCta is true", () => {
    render(
      <CalendarShell
        locale="uk"
        calendar={stubCalendar}
        priced={{ userDividends: [] }}
        showEmptyStateCta={true}
      />,
    );
    expect(screen.getByText(/past dividends not showing up/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4.2.5: Run the calendar suite**

```bash
npx vitest run --no-file-parallelism app/app/calendar/
```

Expected: all PASS.

- [ ] **Step 4.2.6: Commit**

```bash
git add app/app/calendar/
git commit -m "feat(calendar): wire CalendarShell — chart, drill-down, KPI, filter, empty state"
```

### Task 4.3 — Dashboard lite-card update + nav-items + integration

**Files:**
- Modify: `dividendmapper/app/app/dashboard/_components/IncomeCalendarCard.tsx`
- Modify: `dividendmapper/app/app/_components/shell/nav-items.ts`
- Modify: `dividendmapper/app/app/_components/shell/__tests__/nav-items.test.ts`

- [ ] **Step 4.3.1: Write the failing nav-items test**

Append to `dividendmapper/app/app/_components/shell/__tests__/nav-items.test.ts`:

```ts
import { DEFAULT_NAV_ITEMS, filterNavItems } from "../nav-items";

describe("nav-items v2 — Calendar", () => {
  it("includes a Calendar entry between Dashboard and Portfolio Manager", () => {
    const labels = DEFAULT_NAV_ITEMS.map((i) => i.label);
    const dashboardIdx = labels.indexOf("Dashboard");
    const calendarIdx = labels.indexOf("Calendar");
    const portfolioMgrIdx = labels.indexOf("Portfolio Manager");
    expect(calendarIdx).toBeGreaterThan(dashboardIdx);
    expect(calendarIdx).toBeLessThan(portfolioMgrIdx);
  });

  it("Calendar requires Pro", () => {
    const filteredFree = filterNavItems(DEFAULT_NAV_ITEMS, { tier: "free", isAdmin: false });
    expect(filteredFree.find((i) => i.label === "Calendar")).toBeUndefined();
    const filteredPro = filterNavItems(DEFAULT_NAV_ITEMS, { tier: "pro", isAdmin: false });
    expect(filteredPro.find((i) => i.label === "Calendar")).toBeDefined();
  });
});
```

- [ ] **Step 4.3.2: Run to verify failure** — the new tests should fail.

- [ ] **Step 4.3.3: Update nav-items.ts**

Edit `dividendmapper/app/app/_components/shell/nav-items.ts`. Add the Calendar entry between Dashboard and Ledger (place it after Dashboard, before Ledger):

```ts
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  Briefcase,
  TrendingUp,
  Star,
  User,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

// …existing types…

export const DEFAULT_NAV_ITEMS: readonly NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/app/calendar",
    label: "Calendar",
    icon: CalendarIcon,
    requiresPro: true,
  },
  { href: "/app/portfolio", label: "Ledger", icon: Briefcase, exact: true },
  {
    href: "/app/portfolio/scoring",
    label: "Portfolio Manager",
    icon: TrendingUp,
    requiresPro: true,
  },
  {
    href: "/app/portfolio/watchlist",
    label: "Watchlist",
    icon: Star,
    requiresPro: true,
  },
  { href: "/app/account", label: "Account", icon: User },
  {
    href: "/app/admin/scoring/audit",
    label: "Admin",
    icon: ShieldCheck,
    adminOnly: true,
  },
];
```

(The test asserts Calendar sits between Dashboard and Portfolio Manager — Ledger is allowed to sit between them per the assertion.)

- [ ] **Step 4.3.4: Run the nav-items tests** — all PASS.

- [ ] **Step 4.3.5: Update dashboard lite card**

Edit `dividendmapper/app/app/dashboard/_components/IncomeCalendarCard.tsx`:

Find the header `<div>` containing the "Income calendar" eyebrow + range subtitle. Replace it with:

```tsx
<div className="flex items-baseline justify-between">
  <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
    Income calendar
  </p>
  <Link
    href="/app/calendar"
    className="text-[10px] text-[var(--brand)] hover:underline"
  >
    Open full calendar →
  </Link>
</div>
```

Add the `import Link from "next/link";` at the top if not already imported.

Also: remove the inline `<ReinvestCard … />` block at the bottom of the file. The reinvest card moves to `/app/calendar`'s drill-down panel surface in Slice B; the dashboard card stays compact.

- [ ] **Step 4.3.6: Update the dashboard card test**

Open `dividendmapper/app/app/dashboard/_components/__tests__/income-calendar-card.test.tsx` and:
- Update any assertion that expects the "past 6 mo · next 6 mo" subtitle to instead expect the "Open full calendar →" link.
- Remove the assertion that the inline reinvest card renders (the test will need to assert it's GONE if it asserted presence).

- [ ] **Step 4.3.7: Run the dashboard test suite**

```bash
npx vitest run --no-file-parallelism app/app/dashboard/
```

Expected: all PASS.

- [ ] **Step 4.3.8: Commit**

```bash
git add app/app/_components/shell/nav-items.ts \
        app/app/_components/shell/__tests__/nav-items.test.ts \
        app/app/dashboard/_components/IncomeCalendarCard.tsx \
        app/app/dashboard/_components/__tests__/income-calendar-card.test.tsx
git commit -m "feat(calendar): drawer Calendar entry + dashboard card links to /app/calendar"
```

---

## Day 5 — Slice A polish + full test pass + Slice A PR

**Outcome.** All Slice A tests green, locally previewed in dev, PR opened and ready for review.

### Task 5.1 — Run the full test suite

- [ ] **Step 5.1.1: Run vitest project-wide**

```bash
npx vitest run --no-file-parallelism 2>&1 | tail -20
```

Expected: ALL tests PASS. Baseline was ~1373; Slice A adds ~21 = expect ~1394.

- [ ] **Step 5.1.2: Run lint**

```bash
npm run lint 2>&1 | tail -20
```

Per `[reference_next16_lint]`: use `npm run lint` (eslint) not `next lint`. Expected: no errors.

- [ ] **Step 5.1.3: Local build**

```bash
npm run build 2>&1 | tail -40
```

Per `[feedback_supabase_promiselike_chain]`: always `next build` locally before pushing any supabase-touching code. Expected: build succeeds, no type errors.

### Task 5.2 — Manual preview (Glenn)

- [ ] **Step 5.2.1: Start dev**

```bash
npm run dev
```

- [ ] **Step 5.2.2: Visit `http://localhost:3000/app/calendar` as a Pro user**
  - Verify: 4 KPI tiles render, wrapper filter chips render, chart renders 19 buckets with today divider, drill-down opens on bar click, cadence timeline shows markers, Net/Gross toggle updates GIA-wrapper rows.
  - Verify: as a Free user, redirected to `/pricing?from=/app/calendar`.
  - Verify: dashboard lite card now has "Open full calendar →" link working.

- [ ] **Step 5.2.3: Confirm `prefers-reduced-motion`**

In DevTools → Rendering → Emulate CSS media feature, enable `prefers-reduced-motion: reduce`. Reload `/app/calendar` and confirm bar-stagger animation is suppressed.

### Task 5.3 — Push + open Slice A PR

- [ ] **Step 5.3.1: Push**

```bash
git push -u origin feature/calendar-v2-slice-a
```

- [ ] **Step 5.3.2: Open the PR**

```bash
gh pr create --title "Dividend Income Calendar v2 — Slice A (visual surface)" --body "$(cat <<'EOF'
## Summary
- New flagship `/app/calendar` page (Pro), drawer-pinned between Dashboard and Ledger
- 18-month chart (6 back + current + 12 forward), per-payment drill-down, cadence timeline
- Locale-aware primary currency (GBP / USD); wrapper-filter chip row; Net/Gross + Tax-year/Calendar-year toggles
- New `dividend-tax` pure module — UK 8.75% over £500 allowance, US 15% qualified-flat
- Dashboard `IncomeCalendarCard` becomes a lite preview linking to the full calendar
- Empty-state CTA for non-T212 users (CSV import nudge)

Slice B (next PR) adds the bidirectional projection engine + public landing.

## Test plan
- [ ] All vitest PASS (~21 new tests, ~1394 total)
- [ ] `npm run lint` clean
- [ ] `npm run build` clean
- [ ] Manual: `/app/calendar` renders for Pro
- [ ] Manual: Free user redirected
- [ ] Manual: wrapper filter cascades through KPI + drill-down
- [ ] Manual: Net/Gross toggle changes GIA values
- [ ] Manual: `prefers-reduced-motion` suppresses animation
EOF
)"
```

- [ ] **Step 5.3.3: Capture the PR number for Slice B branching**

Note the PR URL. After merge, Slice B branches off the merge commit on `main`.

---

# 🟡 VALIDATION GATE — Glenn live-checks Slice A on prod

Before starting Slice B:
- Slice A PR merged.
- Vercel deploys to prod (auto via push to main).
- Glenn confirms the surface looks right against his real T212-synced portfolio AND a manual/CSV-only sub-portfolio (the empty-state CTA path).
- Any visual or UX iteration that surfaces here gets a small follow-up PR before Slice B.

---

# SLICE B — Projection engine + public landing (Days 6–9)

## Day 6 — Migration 0021 + projection engine module

**Outcome.** Migration applied to prod; pure `projectDividends` module passes ~15 tests. No cron wiring yet.

### Task 6.1 — Worktree off latest main

- [ ] **Step 6.1.1: Update local + new worktree**

```bash
cd /c/Users/grodg/dividend_mapper_plan
git fetch origin && git checkout main && git pull
git worktree add dividendmapper/.worktrees/calendar-v2-slice-b -b feature/calendar-v2-slice-b origin/main
cd dividendmapper/.worktrees/calendar-v2-slice-b/dividendmapper
cmd //C "rmdir node_modules" 2>/dev/null
cmd //C "mklink /J node_modules C:\\Users\\grodg\\dividend_mapper_plan\\dividendmapper\\node_modules" 2>&1
cmd //C "mklink .env.local C:\\Users\\grodg\\dividend_mapper_plan\\dividendmapper\\.env.local" 2>&1
```

### Task 6.2 — Migration 0021

**Files:**
- Create: `dividendmapper/supabase/migrations/0021_equity_scores_projection.sql`

- [ ] **Step 6.2.1: Write the migration**

```sql
-- 0021_equity_scores_projection.sql
-- Adds bidirectional projection caches to equity_scores. Cron writes both
-- forward (next 12mo) and historical (past 12mo) per-ticker projection
-- arrays; the page layer combines historical with the user's holdings
-- (quantity × created_at floor) at render time.

alter table public.equity_scores
  add column if not exists projected_next_12m_payments       jsonb,
  add column if not exists projected_historical_12m_payments jsonb,
  add column if not exists projected_cadence                 text,
  add column if not exists projected_growth_rate             numeric,
  add column if not exists projected_at                      timestamptz;

comment on column public.equity_scores.projected_next_12m_payments is
  'JSONB array of { ex_date, pay_date, per_share_amount, currency, confidence }. Cron-written; consumed by the calendar page forward-projection.';
comment on column public.equity_scores.projected_historical_12m_payments is
  'JSONB array of { ex_date, pay_date, per_share_amount, currency, confidence }. Cron-written; consumed by the calendar page back-fill gated on holdings.created_at.';
comment on column public.equity_scores.projected_cadence is
  'monthly | quarterly | semi | annual | irregular | unknown';
comment on column public.equity_scores.projected_growth_rate is
  'Uncapped 3yr CAGR for diagnostics. Display layer applies the ±20% cap.';
comment on column public.equity_scores.projected_at is
  'Timestamp of the last projection-engine run.';
```

- [ ] **Step 6.2.2: Hand off to Glenn for prod apply**

Glenn runs locally:

```bash
set -a && source .env.local && set +a
npx supabase db push --dry-run
npx supabase db push --yes
```

Per `[reference_supabase_cli_workflow]`. If the dry run reports out-of-order migrations, follow `[reference_supabase_out_of_order_migration_workaround]`.

### Task 6.3 — `projectDividends` pure module — cadence detection

**Files:**
- Create: `dividendmapper/lib/scoring/project-dividends.ts`
- Test: `dividendmapper/lib/scoring/__tests__/project-dividends.test.ts`

- [ ] **Step 6.3.1: Write the failing cadence-detection tests**

Create `dividendmapper/lib/scoring/__tests__/project-dividends.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { projectDividends, detectCadence } from "../project-dividends";

const today = new Date("2026-06-23T00:00:00Z");

describe("detectCadence", () => {
  it("returns 'quarterly' for 4 payments at ~90d gaps", () => {
    expect(
      detectCadence([
        { exDate: "2026-03-15", amount: 0.25 },
        { exDate: "2025-12-15", amount: 0.25 },
        { exDate: "2025-09-15", amount: 0.25 },
        { exDate: "2025-06-15", amount: 0.25 },
      ]),
    ).toBe("quarterly");
  });

  it("returns 'monthly' for monthly-pay tickers like O", () => {
    expect(
      detectCadence([
        { exDate: "2026-05-30", amount: 0.265 },
        { exDate: "2026-04-30", amount: 0.265 },
        { exDate: "2026-03-30", amount: 0.265 },
        { exDate: "2026-02-28", amount: 0.265 },
        { exDate: "2026-01-30", amount: 0.265 },
      ]),
    ).toBe("monthly");
  });

  it("returns 'semi' for UK-style half-yearly payers", () => {
    expect(
      detectCadence([
        { exDate: "2026-04-10", amount: 1.2 },
        { exDate: "2025-10-10", amount: 1.1 },
        { exDate: "2025-04-10", amount: 1.0 },
        { exDate: "2024-10-10", amount: 1.0 },
      ]),
    ).toBe("semi");
  });

  it("returns 'unknown' when fewer than 4 payments", () => {
    expect(detectCadence([{ exDate: "2026-04-10", amount: 1 }])).toBe("unknown");
  });

  it("returns 'irregular' for special-divvy-shaped history", () => {
    expect(
      detectCadence([
        { exDate: "2026-06-01", amount: 10 },
        { exDate: "2025-12-15", amount: 1 },
        { exDate: "2025-03-20", amount: 1 },
        { exDate: "2023-05-10", amount: 1 },
      ]),
    ).toBe("irregular");
  });
});
```

- [ ] **Step 6.3.2: Run to verify failure** — module-not-found.

- [ ] **Step 6.3.3: Implement cadence detection**

Create `dividendmapper/lib/scoring/project-dividends.ts`:

```ts
// Bidirectional dividend projection engine. Pure — no DB, no rendering.
// Inputs: per-ticker FMP historical payments + a single holding row.
// Outputs: ProjectedPayment[] for the requested direction.
//
// Algorithm (see spec §Slice B / Algorithm):
//   1. Cadence detection from median inter-payment gap.
//   2. 3yr CAGR growth rate, capped ±20%/yr (tag 'growth-clipped' when hit).
//   3. Cut/freeze dominance: if last payment < 95% of trailing-12m-avg,
//      set growth=0 (treat as freeze).
//   4. Sub-history fallback (2-3 payments) → growth=0 + tag 'growth-unknown'.
//   5. Backward direction guard: from = max(holding.createdAt, today - 6mo).

export type Cadence = "monthly" | "quarterly" | "semi" | "annual" | "irregular" | "unknown";

export type ProjectionConfidence =
  | "cadence"
  | "cadence+growth"
  | "growth-clipped"
  | "growth-unknown";

export interface HistoricalPayment {
  exDate: string;       // YYYY-MM-DD
  amount: number;       // per-share native
}

export interface ProjectedPayment {
  exDate: string;
  payDate: string;
  perShareAmount: number;
  currency: string;
  confidence: ProjectionConfidence;
}

export interface ProjectDividendsArgs {
  ticker: string;
  historicalPayments: ReadonlyArray<HistoricalPayment>;
  holding: { quantity: number; createdAt: string | null };
  today: Date;
  direction: "forward" | "backward";
  currency: string;     // native currency of the historical amounts
}

const GROWTH_CAP = 0.20;

const CADENCE_BUCKETS: ReadonlyArray<{ cadence: Cadence; min: number; max: number; payOffsetDays: number }> = [
  { cadence: "monthly",   min: 28,  max: 35,  payOffsetDays: 7 },
  { cadence: "quarterly", min: 85,  max: 95,  payOffsetDays: 14 },
  { cadence: "semi",      min: 175, max: 190, payOffsetDays: 28 },
  { cadence: "annual",    min: 355, max: 370, payOffsetDays: 28 },
];

export function detectCadence(history: ReadonlyArray<HistoricalPayment>): Cadence {
  if (history.length < 4) return "unknown";
  const sorted = [...history].sort((a, b) => (a.exDate < b.exDate ? -1 : 1));
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const ms = new Date(sorted[i].exDate).getTime() - new Date(sorted[i - 1].exDate).getTime();
    gaps.push(ms / 86_400_000);
  }
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  const bucket = CADENCE_BUCKETS.find((b) => median >= b.min && median <= b.max);
  return bucket?.cadence ?? "irregular";
}

// Other helpers + the projectDividends function come in Step 6.3.5.
export function projectDividends(_args: ProjectDividendsArgs): ProjectedPayment[] {
  return [];  // placeholder — Step 6.3.5 fills this in.
}
```

- [ ] **Step 6.3.4: Run the cadence tests** — all 5 PASS.

- [ ] **Step 6.3.5: Add growth-rate + projection tests, then implement projectDividends**

Append to `project-dividends.test.ts`:

```ts
import { computeGrowthRate } from "../project-dividends";

describe("computeGrowthRate", () => {
  it("3yr CAGR over 12 payments grouped by year", () => {
    // Year 2023 sum: 4.00; 2024: 4.20; 2025: 4.41; 2026: 4.62
    const history = [
      { exDate: "2023-03-15", amount: 1.00 }, { exDate: "2023-06-15", amount: 1.00 },
      { exDate: "2023-09-15", amount: 1.00 }, { exDate: "2023-12-15", amount: 1.00 },
      { exDate: "2024-03-15", amount: 1.05 }, { exDate: "2024-06-15", amount: 1.05 },
      { exDate: "2024-09-15", amount: 1.05 }, { exDate: "2024-12-15", amount: 1.05 },
      { exDate: "2025-03-15", amount: 1.1025 }, { exDate: "2025-06-15", amount: 1.1025 },
      { exDate: "2025-09-15", amount: 1.1025 }, { exDate: "2025-12-15", amount: 1.1025 },
    ];
    const rate = computeGrowthRate(history);
    expect(rate).toBeCloseTo(0.05, 2);
  });

  it("clips growth at +20% and returns a 'clipped' flag", () => {
    const history = [
      { exDate: "2023-03-15", amount: 1 }, { exDate: "2023-06-15", amount: 1 },
      { exDate: "2023-09-15", amount: 1 }, { exDate: "2023-12-15", amount: 1 },
      { exDate: "2024-03-15", amount: 2 }, { exDate: "2024-06-15", amount: 2 },
      { exDate: "2024-09-15", amount: 2 }, { exDate: "2024-12-15", amount: 2 },
      { exDate: "2025-03-15", amount: 4 }, { exDate: "2025-06-15", amount: 4 },
      { exDate: "2025-09-15", amount: 4 }, { exDate: "2025-12-15", amount: 4 },
    ];
    // CAGR ~ 100%/yr — should clip to +20%.
    expect(computeGrowthRate(history)).toBeCloseTo(0.20, 4);
  });
});

describe("projectDividends — forward", () => {
  it("projects 4 quarterly payments forward over 12 months at the cadence", () => {
    const history: HistoricalPayment[] = [
      { exDate: "2026-03-15", amount: 0.50 },
      { exDate: "2025-12-15", amount: 0.50 },
      { exDate: "2025-09-15", amount: 0.50 },
      { exDate: "2025-06-15", amount: 0.50 },
    ];
    const result = projectDividends({
      ticker: "EXMPL",
      historicalPayments: history,
      holding: { quantity: 10, createdAt: "2024-01-01" },
      today,
      direction: "forward",
      currency: "USD",
    });
    expect(result.length).toBe(4);
    expect(result.every((r) => r.perShareAmount === 0.50)).toBe(true);
    expect(result.every((r) => r.confidence === "cadence")).toBe(true);
  });

  it("applies growth-adjusted amounts and tags 'cadence+growth'", () => {
    const history: HistoricalPayment[] = [
      { exDate: "2023-03-15", amount: 1.00 }, { exDate: "2023-06-15", amount: 1.00 },
      { exDate: "2023-09-15", amount: 1.00 }, { exDate: "2023-12-15", amount: 1.00 },
      { exDate: "2024-03-15", amount: 1.05 }, { exDate: "2024-06-15", amount: 1.05 },
      { exDate: "2024-09-15", amount: 1.05 }, { exDate: "2024-12-15", amount: 1.05 },
      { exDate: "2025-03-15", amount: 1.1025 }, { exDate: "2025-06-15", amount: 1.1025 },
      { exDate: "2025-09-15", amount: 1.1025 }, { exDate: "2025-12-15", amount: 1.1025 },
      { exDate: "2026-03-15", amount: 1.158 }, { exDate: "2026-06-15", amount: 1.158 },
    ];
    const result = projectDividends({
      ticker: "GROW",
      historicalPayments: history,
      holding: { quantity: 10, createdAt: "2022-01-01" },
      today,
      direction: "forward",
      currency: "USD",
    });
    expect(result.every((r) => r.confidence === "cadence+growth")).toBe(true);
    expect(result[0].perShareAmount).toBeGreaterThan(1.158);
  });

  it("freezes growth when latest payment is < 95% of trailing-12m avg", () => {
    const history: HistoricalPayment[] = [
      { exDate: "2025-06-15", amount: 1.00 }, { exDate: "2025-09-15", amount: 1.00 },
      { exDate: "2025-12-15", amount: 1.00 }, { exDate: "2026-03-15", amount: 1.00 },
      // Latest payment cut to 0.80 → below 0.95 threshold.
      { exDate: "2026-06-15", amount: 0.80 },
    ];
    const result = projectDividends({
      ticker: "CUT",
      historicalPayments: history,
      holding: { quantity: 10, createdAt: "2024-01-01" },
      today,
      direction: "forward",
      currency: "USD",
    });
    expect(result.every((r) => r.perShareAmount === 0.80)).toBe(true);
    expect(result.every((r) => r.confidence === "cadence")).toBe(true);
  });

  it("falls back to growth-unknown with 2-3 payments", () => {
    const history: HistoricalPayment[] = [
      { exDate: "2026-03-15", amount: 0.50 },
      { exDate: "2025-12-15", amount: 0.50 },
      { exDate: "2025-09-15", amount: 0.50 },
    ];
    const result = projectDividends({
      ticker: "NEW",
      historicalPayments: history,
      holding: { quantity: 10, createdAt: "2024-01-01" },
      today,
      direction: "forward",
      currency: "USD",
    });
    expect(result.length).toBe(0);   // cadence detection requires >=4 payments
  });
});

describe("projectDividends — backward (holdings.createdAt floor)", () => {
  it("does NOT back-project before the user owned the position", () => {
    const history: HistoricalPayment[] = [
      { exDate: "2025-06-15", amount: 1.00 }, { exDate: "2025-09-15", amount: 1.00 },
      { exDate: "2025-12-15", amount: 1.00 }, { exDate: "2026-03-15", amount: 1.00 },
    ];
    const result = projectDividends({
      ticker: "HELD",
      historicalPayments: history,
      holding: { quantity: 10, createdAt: "2026-04-01" },
      today,
      direction: "backward",
      currency: "USD",
    });
    // createdAt is 2026-04-01. None of the historical payments are
    // *after* 2026-04-01 but *before* today (2026-06-23) per the cadence —
    // only one quarterly slot would fit.
    expect(result.every((p) => p.exDate >= "2026-04-01")).toBe(true);
  });

  it("falls back to today - 6mo when createdAt is null", () => {
    const history: HistoricalPayment[] = [
      { exDate: "2025-06-15", amount: 1.00 }, { exDate: "2025-09-15", amount: 1.00 },
      { exDate: "2025-12-15", amount: 1.00 }, { exDate: "2026-03-15", amount: 1.00 },
    ];
    const result = projectDividends({
      ticker: "LEGACY",
      historicalPayments: history,
      holding: { quantity: 10, createdAt: null },
      today,
      direction: "backward",
      currency: "USD",
    });
    expect(result.every((p) => p.exDate >= "2025-12-23")).toBe(true);   // today - 6mo
  });
});
```

- [ ] **Step 6.3.6: Run new tests to verify failure** — most fail.

- [ ] **Step 6.3.7: Complete the implementation**

Replace `dividendmapper/lib/scoring/project-dividends.ts` with the full module:

```ts
// (Header + types as defined in Step 6.3.3 — keep them.)

// …keep existing types + detectCadence from Step 6.3.3…

export function computeGrowthRate(history: ReadonlyArray<HistoricalPayment>): number {
  // Group by calendar year; need 3 complete years to compute 3yr CAGR.
  const byYear = new Map<number, number>();
  for (const h of history) {
    const y = Number(h.exDate.slice(0, 4));
    byYear.set(y, (byYear.get(y) ?? 0) + h.amount);
  }
  const years = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
  if (years.length < 4) return 0;          // need start + 3 fully-complete years
  const start = years[0][1];
  const end = years[years.length - 1][1];
  const n = years.length - 1;
  if (start <= 0) return 0;
  const cagr = Math.pow(end / start, 1 / n) - 1;
  if (cagr > GROWTH_CAP) return GROWTH_CAP;
  if (cagr < -GROWTH_CAP) return -GROWTH_CAP;
  return cagr;
}

function trailingTwelveMonthAvg(history: ReadonlyArray<HistoricalPayment>, today: Date): number {
  const cutoff = new Date(today.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const recent = history.filter((h) => h.exDate >= cutoff);
  if (recent.length === 0) return 0;
  return recent.reduce((s, h) => s + h.amount, 0) / recent.length;
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

function payOffsetDaysFor(cadence: Cadence): number {
  return CADENCE_BUCKETS.find((b) => b.cadence === cadence)?.payOffsetDays ?? 14;
}

function gapDaysFor(cadence: Cadence): number {
  // Midpoint of the bucket — close enough for projection.
  const b = CADENCE_BUCKETS.find((c) => c.cadence === cadence);
  return b ? (b.min + b.max) / 2 : 0;
}

export function projectDividends(args: ProjectDividendsArgs): ProjectedPayment[] {
  const { historicalPayments: history, holding, today, direction, currency } = args;

  const cadence = detectCadence(history);
  if (cadence === "unknown" || cadence === "irregular") return [];

  const sorted = [...history].sort((a, b) => (a.exDate < b.exDate ? -1 : 1));
  const latest = sorted[sorted.length - 1];
  const ttmAvg = trailingTwelveMonthAvg(history, today);

  // Cut/freeze dominance: latest < 95% of ttm avg.
  const isCutOrFreeze = ttmAvg > 0 && latest.amount < 0.95 * ttmAvg;

  // Growth rate: needs 4+ complete years; otherwise growth-unknown.
  const growthRate = isCutOrFreeze ? 0 : computeGrowthRate(history);
  const hadEnoughHistory = history.length >= 4;
  const baseAmount = latest.amount;

  const confidence: ProjectionConfidence = isCutOrFreeze
    ? "cadence"
    : !hadEnoughHistory
      ? "growth-unknown"
      : growthRate === GROWTH_CAP || growthRate === -GROWTH_CAP
        ? "growth-clipped"
        : growthRate !== 0
          ? "cadence+growth"
          : "cadence";

  const gapDays = gapDaysFor(cadence);
  const payOffsetDays = payOffsetDaysFor(cadence);

  const todayIso = today.toISOString().slice(0, 10);
  const sixMoAgoIso = addDays(todayIso, -180);

  const out: ProjectedPayment[] = [];

  if (direction === "forward") {
    // Project 12 months forward from the latest payment.
    const endIso = addDays(todayIso, 365);
    let cursor = latest.exDate;
    let cursorAmount = baseAmount;
    let yearsElapsed = 0;
    while (true) {
      cursor = addDays(cursor, gapDays);
      if (cursor > endIso) break;
      if (cursor <= todayIso) continue;   // already past — caller has user_dividends for these
      // Annual compounding on growth.
      const yearsFromNow = (new Date(cursor).getTime() - today.getTime()) / (365 * 86_400_000);
      const amount = baseAmount * Math.pow(1 + growthRate, Math.max(0, yearsFromNow));
      out.push({
        exDate: cursor,
        payDate: addDays(cursor, payOffsetDays),
        perShareAmount: round4(amount),
        currency,
        confidence,
      });
      yearsElapsed = yearsFromNow;
      cursorAmount = amount;
    }
  } else {
    // Backward direction — back-project from earliest history to fill gaps
    // between holding.createdAt and today, observing the 6mo floor.
    const createdAt = holding.createdAt ? holding.createdAt.slice(0, 10) : sixMoAgoIso;
    const floor = createdAt > sixMoAgoIso ? createdAt : sixMoAgoIso;

    // Walk forward from the earliest historical payment in cadence; emit only
    // those that fall in [floor, today] AND are NOT already in the user's
    // user_dividends. The caller dedupes against user_dividends.
    let cursor = sorted[0].exDate;
    while (cursor < todayIso) {
      cursor = addDays(cursor, gapDays);
      if (cursor < floor) continue;
      if (cursor > todayIso) break;
      out.push({
        exDate: cursor,
        payDate: addDays(cursor, payOffsetDays),
        perShareAmount: round4(baseAmount),
        currency,
        confidence,
      });
    }
  }

  return out;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
```

- [ ] **Step 6.3.8: Run the full project-dividends test suite**

```bash
npx vitest run --no-file-parallelism lib/scoring/__tests__/project-dividends.test.ts
```

Expected: all ~10 tests PASS. If any backward-direction test fails on the `createdAt` floor, double-check the date comparison strings.

- [ ] **Step 6.3.9: Commit**

```bash
git add lib/scoring/project-dividends.ts \
        lib/scoring/__tests__/project-dividends.test.ts \
        supabase/migrations/0021_equity_scores_projection.sql
git commit -m "feat(calendar): projection engine + migration 0021"
```

---

## Day 7 — Cron extension + backfill script

**Outcome.** `score-ticker.ts` populates the new projection columns nightly; one-shot backfill script seeded prod before the cron cycle. ~3 new tests.

### Task 7.1 — Hook projection into `score-ticker.ts`

**Files:**
- Modify: `dividendmapper/lib/scoring/score-ticker.ts`
- Modify: `dividendmapper/app/api/internal/refresh-equity-scores/__tests__/route.test.ts`

- [ ] **Step 7.1.1: Read score-ticker for the FMP history call**

```bash
npx grep -n "historical-price-eod/dividend-adjusted\|dividendHistory\|fmpDividends" dividendmapper/lib/scoring/score-ticker.ts | head
```

Note the existing variable name holding the per-symbol historical payments. The projection call slots in *after* the existing score composers but *before* the `equity_scores` upsert.

- [ ] **Step 7.1.2: Add the projection call + upsert columns**

Inside `scoreTicker(...)`, after the existing `buy_score`/`trim_score`/`risk_score` are computed, before the upsert, add:

```ts
import {
  detectCadence,
  computeGrowthRate,
  projectDividends,
  type HistoricalPayment,
} from "@/lib/scoring/project-dividends";

// …existing code…

// Slice B v2 calendar — project forward + historical caches per ticker.
const historicalPayments: HistoricalPayment[] = fmpDividendHistory.map((d) => ({
  exDate: d.date,
  amount: d.dividend,
}));
const cadence = detectCadence(historicalPayments);
const growthRate = computeGrowthRate(historicalPayments);
const forwardProj = projectDividends({
  ticker,
  historicalPayments,
  holding: { quantity: 1, createdAt: null },     // per-ticker cache; per-user wiring at render time
  today: new Date(`${today}T00:00:00Z`),
  direction: "forward",
  currency: fmpProfile.currency ?? "USD",
});
const historicalProj = projectDividends({
  ticker,
  historicalPayments,
  holding: { quantity: 1, createdAt: null },
  today: new Date(`${today}T00:00:00Z`),
  direction: "backward",
  currency: fmpProfile.currency ?? "USD",
});

// JSONB rows use snake_case keys to match the consumer's ProjectedPaymentRow.
// Transform here so the page layer reads a single shape.
function toJsonbRow(p: { exDate: string; payDate: string; perShareAmount: number; currency: string; confidence: string }) {
  return {
    ex_date: p.exDate,
    pay_date: p.payDate,
    per_share_amount: p.perShareAmount,
    currency: p.currency,
    confidence: p.confidence,
  };
}

// Extend the upsert payload with the projection columns.
const upsertRow = {
  ticker,
  // …existing columns…
  projected_next_12m_payments: forwardProj.map(toJsonbRow),
  projected_historical_12m_payments: historicalProj.map(toJsonbRow),
  projected_cadence: cadence,
  projected_growth_rate: growthRate,
  projected_at: new Date().toISOString(),
};
await supabase.from("equity_scores").upsert(upsertRow, { onConflict: "ticker" });
```

(Replace `fmpDividendHistory` / `fmpProfile` with whatever the file actually names those locals.)

- [ ] **Step 7.1.3: Add the cron test**

Append to `dividendmapper/app/api/internal/refresh-equity-scores/__tests__/route.test.ts` (or extend the existing fixture-driven test if one exists):

```ts
it("populates projection columns on the upsert", async () => {
  // Use the existing fixture harness to run scoreTicker against one fixture
  // ticker with 4yr of quarterly history. Assert the upsert was called with
  // the four projection columns set.
  // …implementation depends on the existing test harness in this file…
  expect(upsertCalls[0]).toMatchObject({
    projected_cadence: "quarterly",
    projected_at: expect.any(String),
  });
  expect(Array.isArray(upsertCalls[0].projected_next_12m_payments)).toBe(true);
  expect(upsertCalls[0].projected_next_12m_payments.length).toBeGreaterThan(0);
});
```

- [ ] **Step 7.1.4: Run** — PASS.

- [ ] **Step 7.1.5: Commit**

```bash
git add lib/scoring/score-ticker.ts \
        app/api/internal/refresh-equity-scores/__tests__/route.test.ts
git commit -m "feat(calendar): score-ticker writes projection columns"
```

### Task 7.2 — Backfill script (one-shot for prod)

**Files:**
- Create: `dividendmapper/scripts/scoring/backfill-equity-projection.mjs`

- [ ] **Step 7.2.1: Write the script**

```js
// One-shot backfill — populates the new projection columns on every existing
// equity_scores row by re-fetching FMP dividend history and calling the
// projection engine. Run BEFORE the first post-migration cron cycle so the
// calendar surface doesn't render zero forecasts on day one.
//
// Usage:
//   node scripts/scoring/backfill-equity-projection.mjs
// Reads FMP_API_KEY + SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
// from dividendmapper/.env.local.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  detectCadence,
  computeGrowthRate,
  projectDividends,
} from "../../lib/scoring/project-dividends.ts";

const FMP = "https://financialmodelingprep.com/stable/historical-price-eod/dividend-adjusted";
const KEY = process.env.FMP_API_KEY;
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY || !SUPA_URL || !SUPA_KEY) {
  console.error("Missing FMP_API_KEY / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

const sb = createClient(SUPA_URL, SUPA_KEY);

const { data: rows, error } = await sb.from("equity_scores").select("ticker");
if (error) { console.error(error); process.exit(1); }

const today = new Date();
let ok = 0, fail = 0;

for (const { ticker } of rows ?? []) {
  try {
    const res = await fetch(`${FMP}?symbol=${encodeURIComponent(ticker)}&apikey=${KEY}`);
    const json = await res.json();
    const history = (json?.historical ?? []).map((d) => ({ exDate: d.date, amount: d.dividend }));
    const cadence = detectCadence(history);
    const growthRate = computeGrowthRate(history);
    const forward = projectDividends({
      ticker, historicalPayments: history, holding: { quantity: 1, createdAt: null },
      today, direction: "forward", currency: "USD",
    });
    const backward = projectDividends({
      ticker, historicalPayments: history, holding: { quantity: 1, createdAt: null },
      today, direction: "backward", currency: "USD",
    });
    // JSONB consumer expects snake_case keys. Mirror the cron transformer.
    const toJsonbRow = (p) => ({
      ex_date: p.exDate,
      pay_date: p.payDate,
      per_share_amount: p.perShareAmount,
      currency: p.currency,
      confidence: p.confidence,
    });
    await sb.from("equity_scores").update({
      projected_next_12m_payments: forward.map(toJsonbRow),
      projected_historical_12m_payments: backward.map(toJsonbRow),
      projected_cadence: cadence,
      projected_growth_rate: growthRate,
      projected_at: today.toISOString(),
    }).eq("ticker", ticker);
    ok++;
    process.stdout.write(`. (${ok}/${rows.length})\r`);
    await new Promise((r) => setTimeout(r, 1000));    // 1/s FMP courtesy
  } catch (err) {
    fail++;
    console.error(`\n${ticker} failed:`, err.message);
  }
}

console.log(`\nDone. ok=${ok} fail=${fail}`);
```

Note: `import` of a `.ts` file from a `.mjs` script may need `tsx` (already in devDependencies for similar scripts) — if `node` rejects the ts import, switch the script to use `tsx`:

```bash
npx tsx scripts/scoring/backfill-equity-projection.mjs
```

- [ ] **Step 7.2.2: Glenn runs the backfill on prod (after migration 0021 applied)**

```bash
set -a && source .env.local && set +a
npx tsx scripts/scoring/backfill-equity-projection.mjs 2>&1 | tail -5
```

- [ ] **Step 7.2.3: Commit**

```bash
git add scripts/scoring/backfill-equity-projection.mjs
git commit -m "chore(calendar): one-shot backfill for projection columns"
```

---

## Day 8 — Chart segment extensions + per-user back-projection page wiring

**Outcome.** Chart renders projected segments; back-projection fills past gaps for non-T212 users at page-render time. ~6 new tests.

### Task 8.1 — Extend chart to render new segment kinds

**Files:**
- Modify: `dividendmapper/app/app/calendar/_components/calendar-chart.tsx`
- Modify: `dividendmapper/app/app/calendar/_components/__tests__/calendar-chart.test.tsx`

- [ ] **Step 8.1.1: Add the failing tests**

Append to `calendar-chart.test.tsx`:

```tsx
it("renders projected-cadence segments at 0.3 opacity with the striped marker", () => {
  const months: IncomeCalendarMonth[] = [
    { ym: "2026-08", segments: [{ kind: "projected-cadence", primary: 50 }], gbp: 50, kind: "projected-cadence" },
  ];
  render(<CalendarChart months={months} onSelectMonth={() => {}} />);
  const seg = screen.getByTestId("calendar-bar-segment");
  expect(seg.getAttribute("data-kind")).toBe("projected-cadence");
});

it("renders growth-clipped segment with a warning glyph", () => {
  const months: IncomeCalendarMonth[] = [
    { ym: "2026-09", segments: [{ kind: "growth-clipped", primary: 50 }], gbp: 50, kind: "growth-clipped" },
  ];
  render(<CalendarChart months={months} onSelectMonth={() => {}} />);
  expect(screen.getByTestId("growth-clipped-glyph")).toBeInTheDocument();
});
```

- [ ] **Step 8.1.2: Update calendar-chart.tsx**

Inside the bar segment `<span>` map, after the existing style attribute add:

```tsx
<span
  key={`${m.ym}-${seg.kind}-${i}`}
  data-testid="calendar-bar-segment"
  data-kind={seg.kind}
  className={`block w-full first:rounded-t-sm ${
    seg.kind === "projected-cadence" ||
    seg.kind === "projected-growth" ||
    seg.kind === "growth-clipped"
      ? "bg-[repeating-linear-gradient(45deg,var(--brand)_0,var(--brand)_2px,transparent_2px,transparent_4px)]"
      : ""
  }`}
  style={{
    height: `${segHeight}%`,
    backgroundColor: "var(--brand)",
    opacity: OPACITY[seg.kind],
  }}
>
  {seg.kind === "growth-clipped" && (
    <span
      data-testid="growth-clipped-glyph"
      aria-hidden
      className="absolute right-0 top-0 text-[8px]"
      title="growth rate capped at ±20%/yr"
    >
      ⚠
    </span>
  )}
</span>
```

- [ ] **Step 8.1.3: Run & verify** — PASS.

- [ ] **Step 8.1.4: Commit**

```bash
git add app/app/calendar/_components/calendar-chart.tsx \
        app/app/calendar/_components/__tests__/calendar-chart.test.tsx
git commit -m "feat(calendar): chart renders projected-cadence / -growth / growth-clipped segments"
```

### Task 8.2 — Income-calendar consumes projection columns

**Files:**
- Modify: `dividendmapper/lib/portfolio/income-calendar.ts`
- Modify: `dividendmapper/lib/portfolio/__tests__/income-calendar.test.ts`

- [ ] **Step 8.2.1: Add the failing test**

```ts
describe("buildIncomeCalendar — projection (Slice B)", () => {
  const ratesToGbp = { GBP: 1, USD: 0.79 };
  const now = new Date("2026-06-23T12:00:00Z");

  it("uses projectedNext12mByTicker to populate forward projected segments", () => {
    const holdings = [
      { ticker: "AAPL", quantity: 100, wrapper: "isa" as const, created_at: "2025-01-01" },
    ];
    const projectedNext12mByTicker = {
      AAPL: [
        {
          ex_date: "2026-08-15",
          pay_date: "2026-08-29",
          per_share_amount: 0.30,
          currency: "USD",
          confidence: "cadence+growth" as const,
        },
      ],
    };
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
      projectedNext12mByTicker,
      projectedHistorical12mByTicker: {},
    });
    const aug = result.months.find((m) => m.ym === "2026-08");
    expect(aug?.segments.some((s) => s.kind === "projected-growth")).toBe(true);
    expect(aug?.gbp).toBeCloseTo(100 * 0.30 * 0.79, 2);
  });

  it("back-projects historical entries, respecting holdings.created_at floor", () => {
    const holdings = [
      { ticker: "MSFT", quantity: 50, wrapper: "gia" as const, created_at: "2026-04-01" },
    ];
    const projectedHistorical12mByTicker = {
      MSFT: [
        // Before the holding was opened — should be excluded.
        { ex_date: "2025-12-15", pay_date: "2025-12-22", per_share_amount: 0.80, currency: "USD", confidence: "cadence" as const },
        // Inside the window — should be included.
        { ex_date: "2026-05-15", pay_date: "2026-05-22", per_share_amount: 0.80, currency: "USD", confidence: "cadence" as const },
      ],
    };
    const result = buildIncomeCalendar({
      userDividends: [],
      holdings,
      exDivByTicker: {},
      ratesToGbp,
      now,
      locale: "uk",
      projectedNext12mByTicker: {},
      projectedHistorical12mByTicker,
    });
    expect(result.months.find((m) => m.ym === "2025-12")?.gbp).toBe(0);
    expect(result.months.find((m) => m.ym === "2026-05")?.gbp).toBeCloseTo(50 * 0.80 * 0.79, 2);
  });
});
```

- [ ] **Step 8.2.2: Run to verify failure** — fails.

- [ ] **Step 8.2.3: Extend BuildArgs + buildIncomeCalendar**

In `dividendmapper/lib/portfolio/income-calendar.ts`:

Add types near the top:

```ts
export interface ProjectedPaymentRow {
  ex_date: string;
  pay_date: string;
  per_share_amount: number;
  currency: string;
  confidence: "cadence" | "cadence+growth" | "growth-clipped" | "growth-unknown";
}
```

Extend `BuildArgs`:

```ts
interface BuildArgs {
  // …existing fields…
  projectedNext12mByTicker?: Record<string, ProjectedPaymentRow[]>;
  projectedHistorical12mByTicker?: Record<string, ProjectedPaymentRow[]>;
}
```

Add a helper:

```ts
function confidenceToSegmentKind(c: ProjectedPaymentRow["confidence"]): SegmentKind {
  switch (c) {
    case "cadence":         return "projected-cadence";
    case "cadence+growth":  return "projected-growth";
    case "growth-clipped":  return "growth-clipped";
    case "growth-unknown":  return "projected-cadence";
  }
}

function dateMinusMonths(d: Date, m: number): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - m, d.getUTCDate())).toISOString().slice(0, 10);
}
```

Inside `buildIncomeCalendar`, **after** existing step 3 (confirmed forward forecast), insert:

```ts
// 3b. Forward projection — Slice B.
if (args.projectedNext12mByTicker) {
  for (const h of holdings) {
    if (!passesWrapperFilter(h.wrapper, wrapperFilter)) continue;
    const rows = args.projectedNext12mByTicker[h.ticker] ?? [];
    for (const r of rows) {
      if (!r.pay_date) continue;
      const key = ymFromIso(r.pay_date);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (bucket.kind !== "confirmed-forecast") continue;
      const perShare = convertToPrimary(r.per_share_amount, r.currency, ratesToGbp);
      if (perShare === null) continue;
      const total = perShare * h.quantity;
      if (!Number.isFinite(total) || total <= 0) continue;
      pushSegment(bucket, confidenceToSegmentKind(r.confidence), total);
    }
  }
}

// 3c. Backward projection — Slice B. Per-user gated on holdings.created_at;
// six-month floor applies. We dedupe vs user_dividends inside the same bucket
// by NOT pushing a back-projected segment if the bucket already has an
// 'actual' segment (the user actually received dividends that month).
if (args.projectedHistorical12mByTicker) {
  const sixMoFloorIso = dateMinusMonths(now, 6);
  for (const h of holdings) {
    if (!passesWrapperFilter(h.wrapper, wrapperFilter)) continue;
    const createdAtIso = (h.created_at ?? sixMoFloorIso).slice(0, 10);
    const floorIso = createdAtIso > sixMoFloorIso ? createdAtIso : sixMoFloorIso;
    const rows = args.projectedHistorical12mByTicker[h.ticker] ?? [];
    for (const r of rows) {
      if (r.ex_date < floorIso) continue;
      const key = ymFromIso(r.ex_date);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (bucket.kind !== "actual") continue;
      if (bucket.segments.some((s) => s.kind === "actual")) continue;
      const perShare = convertToPrimary(r.per_share_amount, r.currency, ratesToGbp);
      if (perShare === null) continue;
      const total = perShare * h.quantity;
      if (!Number.isFinite(total) || total <= 0) continue;
      pushSegment(bucket, confidenceToSegmentKind(r.confidence), total);
    }
  }
}
```

Then `deriveDominant` re-runs over the updated segments (step 4 in the existing code).

- [ ] **Step 8.2.4: Run all calendar tests** — PASS.

- [ ] **Step 8.2.5: Wire the page to fetch projection JSONB columns**

In `dividendmapper/app/app/calendar/page.tsx`, expand the data fetch (or extend the `loadPricedHoldings` helper) to include `projected_next_12m_payments` + `projected_historical_12m_payments` from `equity_scores` for the user's tickers. Then pass into `buildIncomeCalendar` as `projectedNext12mByTicker` + `projectedHistorical12mByTicker`.

Also flip `includesProjected={true}` on `HeroKpiStrip` when any month bucket carries a projected segment.

- [ ] **Step 8.2.6: Commit**

```bash
git add lib/portfolio/income-calendar.ts \
        lib/portfolio/__tests__/income-calendar.test.ts \
        app/app/calendar/page.tsx \
        app/app/calendar/_components/calendar-shell.tsx
git commit -m "feat(calendar): consume projection JSONB for forward + back-fill (Slice B)"
```

---

## Day 9 — Public `/dividend-calendar` landing + sitemap + Slice B PR

**Outcome.** Public marketing landing live, indexable, with locale-aware demo. Slice B PR opened. ~6 new tests.

### Task 9.1 — Sample-portfolio fixtures

**Files:**
- Create: `dividendmapper/app/(public)/dividend-calendar/_fixtures/sample-portfolio.ts`

- [ ] **Step 9.1.1: Author the fixtures**

```ts
import type { IncomeCalendarHolding, IncomeCalendarUserDividend, IncomeCalendarExDiv, Locale } from "@/lib/portfolio/income-calendar";

export interface SamplePortfolio {
  locale: Locale;
  holdings: IncomeCalendarHolding[];
  userDividends: IncomeCalendarUserDividend[];
  exDivByTicker: Record<string, IncomeCalendarExDiv>;
  ratesToGbp: Record<string, number>;
}

const RATES = { GBP: 1, USD: 0.79, GBp: 0.01, GBX: 0.01 };
const RATES_USD = { USD: 1, GBP: 1 / 0.79, GBp: 0.01 / 0.79, GBX: 0.01 / 0.79 };

export const UK_SAMPLE: SamplePortfolio = {
  locale: "uk",
  ratesToGbp: RATES,
  holdings: [
    { ticker: "PHP.L",  quantity: 800, wrapper: "isa", created_at: "2024-01-01" },
    { ticker: "BATS.L", quantity: 80,  wrapper: "isa", created_at: "2024-01-01" },
    { ticker: "BBOX.L", quantity: 400, wrapper: "isa", created_at: "2024-01-01" },
    { ticker: "IMB.L",  quantity: 60,  wrapper: "isa", created_at: "2024-01-01" },
    { ticker: "SSE.L",  quantity: 100, wrapper: "isa", created_at: "2024-01-01" },
    { ticker: "O",      quantity: 30,  wrapper: "gia", created_at: "2024-01-01" },
    { ticker: "ARCC",   quantity: 50,  wrapper: "gia", created_at: "2024-01-01" },
    { ticker: "SCHD",   quantity: 20,  wrapper: "gia", created_at: "2024-01-01" },
  ],
  userDividends: [
    // 6-month past series (Dec 2025 → May 2026). Values realistic-shaped, not actuals.
    { paid_on: "2025-12-29", amount: 4.20,  currency: "GBp",   wrapper: "isa" },   // BBOX.L × 400 × 0.018p approx
    { paid_on: "2026-01-12", amount: 3.36,  currency: "GBp",   wrapper: "isa" },   // PHP.L
    { paid_on: "2026-01-22", amount: 7.95,  currency: "USD",   wrapper: "gia" },   // O × 30
    { paid_on: "2026-02-09", amount: 4.68,  currency: "GBp",   wrapper: "isa" },   // BATS.L
    { paid_on: "2026-02-22", amount: 7.95,  currency: "USD",   wrapper: "gia" },   // O × 30
    { paid_on: "2026-03-14", amount: 3.50,  currency: "GBp",   wrapper: "isa" },   // BBOX.L
    { paid_on: "2026-03-22", amount: 7.95,  currency: "USD",   wrapper: "gia" },   // O × 30
    { paid_on: "2026-04-09", amount: 3.36,  currency: "GBp",   wrapper: "isa" },   // PHP.L
    { paid_on: "2026-04-15", amount: 24.00, currency: "USD",   wrapper: "gia" },   // ARCC × 50
    { paid_on: "2026-04-22", amount: 7.95,  currency: "USD",   wrapper: "gia" },   // O × 30
    { paid_on: "2026-05-06", amount: 4.68,  currency: "GBp",   wrapper: "isa" },   // BATS.L
    { paid_on: "2026-05-22", amount: 7.95,  currency: "USD",   wrapper: "gia" },   // O × 30
  ],
  exDivByTicker: {
    "PHP.L":  { ex_date: "2026-07-02", pay_date: "2026-07-09", amount: 0.42,  currency: "GBp" },
    "BATS.L": { ex_date: "2026-07-09", pay_date: "2026-08-06", amount: 5.85,  currency: "GBp" },
    "BBOX.L": { ex_date: "2026-07-15", pay_date: "2026-08-19", amount: 0.20,  currency: "GBp" },
    "IMB.L":  { ex_date: "2026-08-20", pay_date: "2026-09-17", amount: 1.10,  currency: "GBp" },
    "SSE.L":  { ex_date: "2026-07-23", pay_date: "2026-09-18", amount: 0.30,  currency: "GBp" },
    "O":      { ex_date: "2026-07-11", pay_date: "2026-07-15", amount: 0.265, currency: "USD" },
    "ARCC":   { ex_date: "2026-09-15", pay_date: "2026-10-15", amount: 0.48,  currency: "USD" },
    "SCHD":   { ex_date: "2026-09-25", pay_date: "2026-09-30", amount: 0.78,  currency: "USD" },
  },
};

export const US_SAMPLE: SamplePortfolio = {
  locale: "us",
  ratesToGbp: RATES_USD,
  holdings: [
    { ticker: "O",     quantity: 30, wrapper: "roth_ira", created_at: "2024-01-01" },
    { ticker: "VICI",  quantity: 50, wrapper: "roth_ira", created_at: "2024-01-01" },
    { ticker: "AMT",   quantity: 10, wrapper: "roth_ira", created_at: "2024-01-01" },
    { ticker: "ARCC",  quantity: 80, wrapper: "ira",      created_at: "2024-01-01" },
    { ticker: "SCHD",  quantity: 30, wrapper: "ira",      created_at: "2024-01-01" },
    { ticker: "BTI",   quantity: 40, wrapper: "brokerage", created_at: "2024-01-01" },
    { ticker: "AAPL",  quantity: 20, wrapper: "brokerage", created_at: "2024-01-01" },
    { ticker: "MSFT",  quantity: 15, wrapper: "brokerage", created_at: "2024-01-01" },
  ],
  userDividends: [
    // 6-month past series for US sample. Realistic shape, not actuals.
    { paid_on: "2025-12-15", amount: 13.50,  currency: "USD", wrapper: "roth_ira" },  // VICI × 50 × 0.27
    { paid_on: "2026-01-15", amount: 7.95,   currency: "USD", wrapper: "roth_ira" },  // O × 30 × 0.265
    { paid_on: "2026-01-15", amount: 38.40,  currency: "USD", wrapper: "ira" },       // ARCC × 80 × 0.48
    { paid_on: "2026-02-13", amount: 22.40,  currency: "USD", wrapper: "brokerage" }, // BTI × 40 × 0.56
    { paid_on: "2026-02-15", amount: 7.95,   currency: "USD", wrapper: "roth_ira" },  // O
    { paid_on: "2026-03-15", amount: 4.80,   currency: "USD", wrapper: "brokerage" }, // AAPL × 20 × 0.24
    { paid_on: "2026-03-15", amount: 7.95,   currency: "USD", wrapper: "roth_ira" },  // O
    { paid_on: "2026-04-15", amount: 38.40,  currency: "USD", wrapper: "ira" },       // ARCC
    { paid_on: "2026-04-15", amount: 7.95,   currency: "USD", wrapper: "roth_ira" },  // O
    { paid_on: "2026-04-22", amount: 23.40,  currency: "USD", wrapper: "ira" },       // SCHD × 30 × 0.78
    { paid_on: "2026-05-15", amount: 11.25,  currency: "USD", wrapper: "brokerage" }, // MSFT × 15 × 0.75
    { paid_on: "2026-05-15", amount: 7.95,   currency: "USD", wrapper: "roth_ira" },  // O
    { paid_on: "2026-05-21", amount: 16.50,  currency: "USD", wrapper: "roth_ira" },  // AMT × 10 × 1.65
  ],
  exDivByTicker: {
    "O":     { ex_date: "2026-07-01", pay_date: "2026-07-15", amount: 0.265, currency: "USD" },
    "VICI":  { ex_date: "2026-09-15", pay_date: "2026-10-06", amount: 0.27,  currency: "USD" },
    "AMT":   { ex_date: "2026-07-08", pay_date: "2026-07-22", amount: 1.65,  currency: "USD" },
    "ARCC":  { ex_date: "2026-09-15", pay_date: "2026-10-15", amount: 0.48,  currency: "USD" },
    "SCHD":  { ex_date: "2026-09-25", pay_date: "2026-09-30", amount: 0.78,  currency: "USD" },
    "BTI":   { ex_date: "2026-08-13", pay_date: "2026-08-26", amount: 0.56,  currency: "USD" },
    "AAPL":  { ex_date: "2026-08-08", pay_date: "2026-08-15", amount: 0.24,  currency: "USD" },
    "MSFT":  { ex_date: "2026-08-21", pay_date: "2026-09-11", amount: 0.75,  currency: "USD" },
  },
};
```

The fixture's job is to make the demo look alive, not be accurate. Numbers are deliberately rounded; any future adjustment lives only in this file.

- [ ] **Step 9.1.2: Commit**

```bash
git add app/\(public\)/dividend-calendar/_fixtures/sample-portfolio.ts
git commit -m "feat(calendar): locked sample portfolios for /dividend-calendar demo"
```

### Task 9.2 — Public landing page + components

**Files:**
- Create: `dividendmapper/app/(public)/dividend-calendar/page.tsx`
- Create: `dividendmapper/app/(public)/dividend-calendar/_components/landing-hero.tsx`
- Create: `dividendmapper/app/(public)/dividend-calendar/_components/demo-calendar.tsx`
- Create: `dividendmapper/app/(public)/dividend-calendar/_components/feature-panels.tsx`
- Create: `dividendmapper/app/(public)/dividend-calendar/_components/landing-faq.tsx`
- Test: `dividendmapper/app/(public)/dividend-calendar/__tests__/page.test.tsx`

- [ ] **Step 9.2.1: Write the failing page test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DividendCalendarLanding from "../page";

describe("/dividend-calendar landing", () => {
  it("renders the hero headline and CTAs", () => {
    render(<DividendCalendarLanding />);
    expect(screen.getByText(/know exactly when every dividend lands/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see it with your portfolio/i })).toHaveAttribute(
      "href",
      "/signup",
    );
  });

  it("renders the demo calendar component", () => {
    render(<DividendCalendarLanding />);
    expect(screen.getByTestId("demo-calendar")).toBeInTheDocument();
  });

  it("renders the three feature panels including tax-wrapper-aware", () => {
    render(<DividendCalendarLanding />);
    expect(screen.getByText(/projected, not just confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/every dividend in one place/i)).toBeInTheDocument();
    expect(screen.getByText(/tax-wrapper-aware/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 9.2.2: Run** — module-not-found.

- [ ] **Step 9.2.3: Implement the landing page**

Create `dividendmapper/app/(public)/dividend-calendar/page.tsx`:

```tsx
import type { Metadata } from "next";
import { LandingHero } from "./_components/landing-hero";
import { DemoCalendar } from "./_components/demo-calendar";
import { FeaturePanels } from "./_components/feature-panels";
import { LandingFaq } from "./_components/landing-faq";

export const metadata: Metadata = {
  title: "Dividend Calendar — see every payment, projected and confirmed",
  description:
    "Track every dividend you'll receive — past, confirmed, and cadence-projected. ISA / SIPP / 401(k) / Roth tax-wrapper-aware. Free preview, Pro for full data.",
  alternates: { canonical: "/dividend-calendar" },
  openGraph: {
    title: "Dividend Calendar — DividendMapper",
    description:
      "Track every dividend, projected and confirmed, in the wrappers you actually hold.",
  },
};

export const revalidate = 3600;

export default function DividendCalendarLanding() {
  return (
    <main>
      <LandingHero />
      <DemoCalendar />
      <FeaturePanels />
      <LandingFaq />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "DividendMapper · Dividend Calendar",
            url: "https://dividendmapper.com/dividend-calendar",
            featureList: [
              "Projected dividend income",
              "Cadence-fill back-projection",
              "Tax-wrapper-aware (ISA, SIPP, 401(k), Roth IRA)",
              "Multi-broker portfolio import",
            ],
          }),
        }}
      />
    </main>
  );
}
```

- [ ] **Step 9.2.4: Implement the four component stubs**

`landing-hero.tsx`:

```tsx
import Link from "next/link";

export function LandingHero() {
  return (
    <section className="px-6 py-16 text-center">
      <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight">
        Know exactly when every dividend lands
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--text-muted)]">
        Past payments, confirmed forecasts, and cadence-projected estimates —
        across every wrapper, in your own currency.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/signup"
          className="rounded-md border border-[var(--brand)] bg-[var(--brand)] px-5 py-2 text-sm font-medium text-white"
        >
          See it with your portfolio
        </Link>
        <a
          href="#demo"
          className="rounded-md border border-[var(--border-subtle)] px-5 py-2 text-sm font-medium text-[var(--text)]"
        >
          Sample portfolio demo
        </a>
      </div>
    </section>
  );
}
```

`demo-calendar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { UK_SAMPLE, US_SAMPLE } from "../_fixtures/sample-portfolio";
import { buildIncomeCalendar } from "@/lib/portfolio/income-calendar";
import { CalendarChart } from "@/app/app/calendar/_components/calendar-chart";

export function DemoCalendar() {
  const [locale, setLocale] = useState<"uk" | "us">("uk");
  const sample = locale === "uk" ? UK_SAMPLE : US_SAMPLE;
  const calendar = buildIncomeCalendar({
    userDividends: sample.userDividends,
    holdings: sample.holdings,
    exDivByTicker: sample.exDivByTicker,
    ratesToGbp: sample.ratesToGbp,
    now: new Date("2026-06-23T12:00:00Z"),
    locale,
  });

  return (
    <section id="demo" data-testid="demo-calendar" className="px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">A sample portfolio</h2>
          <div role="group" aria-label="Locale" className="inline-flex rounded-md border border-[var(--border-subtle)] overflow-hidden">
            <button onClick={() => setLocale("uk")} aria-pressed={locale === "uk"} className={`px-3 py-1 text-xs ${locale === "uk" ? "bg-[var(--brand)] text-white" : ""}`}>UK</button>
            <button onClick={() => setLocale("us")} aria-pressed={locale === "us"} className={`px-3 py-1 text-xs ${locale === "us" ? "bg-[var(--brand)] text-white" : ""}`}>US</button>
          </div>
        </div>
        <CalendarChart months={calendar.months} onSelectMonth={() => {}} />
      </div>
    </section>
  );
}
```

`feature-panels.tsx`:

```tsx
export function FeaturePanels() {
  const panels = [
    {
      title: "Projected, not just confirmed",
      body: "We detect each holding's pay cadence and project the next 12 months — clearly distinguished from confirmed ex-dates and capped at ±20%/yr growth.",
    },
    {
      title: "Every dividend in one place",
      body: "Sync Trading 212, import a CSV, or enter manually — your dividends, your wrappers, your currency.",
    },
    {
      title: "Tax-wrapper-aware",
      body: "ISA / Roth dividends tax-free in your locale, GIA / Brokerage shown net of dividend tax — surfaced automatically.",
    },
  ];
  return (
    <section className="px-6 py-12">
      <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
        {panels.map((p) => (
          <div key={p.title} className="card-surface p-5">
            <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">{p.title}</h3>
            <p className="text-sm text-[var(--text-muted)]">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

`landing-faq.tsx`:

```tsx
const FAQS = [
  { q: "How do projections work?", a: "We detect each holding's pay cadence (monthly/quarterly/semi/annual) from FMP's historical dividend data, then project the next 12 months at the latest amount, adjusted by 3-year CAGR (capped ±20%/yr). Recent cuts override growth assumptions." },
  { q: "Which currencies do you support?", a: "GBP and USD primary display. We convert holdings in other currencies via daily FX rates from frankfurter.app." },
  { q: "Which brokers can I connect?", a: "Trading 212 (Invest + ISA) live today, with CSV import for any broker. Interactive Brokers + HL + AJ Bell + Freetrade coming in Phase 5." },
  { q: "Why do you cap growth at ±20% per year?", a: "A single one-off bonus payment or a recently-cut dividend can distort short-period CAGR. Capping keeps projections sensible — if you see a ⚠ on a bar, it means the underlying CAGR hit the cap." },
  { q: "What's free vs Pro?", a: "Free users get this preview + sample portfolio demo. Pro unlocks the full /app/calendar surface, your real holdings, your real wrappers, your real numbers." },
];

export function LandingFaq() {
  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-4 text-2xl font-semibold">FAQ</h2>
        <dl className="space-y-4">
          {FAQS.map((f) => (
            <div key={f.q}>
              <dt className="text-sm font-semibold text-[var(--text)]">{f.q}</dt>
              <dd className="mt-1 text-sm text-[var(--text-muted)]">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
```

- [ ] **Step 9.2.5: Run the landing page test** — PASS.

- [ ] **Step 9.2.6: Add sitemap + header entry**

Edit `dividendmapper/app/sitemap.ts`. Add to the URL array:

```ts
{
  url: `${BASE_URL}/dividend-calendar`,
  lastModified: new Date(),
  changeFrequency: "weekly",
  priority: 0.9,
},
```

Edit `dividendmapper/components/site-header.tsx` `BASE_NAV` array — add `Dividend calendar` linking to `/dividend-calendar`.

- [ ] **Step 9.2.7: Run the full vitest suite + lint + build**

```bash
npx vitest run --no-file-parallelism 2>&1 | tail -5
npm run lint 2>&1 | tail -5
npm run build 2>&1 | tail -10
```

Expected: all PASS / clean. Test count should be ~1420 (1373 baseline + ~21 Slice A + ~26 Slice B = ~1420; the cross-cutting tests live inside Slice A and B).

- [ ] **Step 9.2.8: Commit**

```bash
git add app/\(public\)/dividend-calendar/ \
        app/sitemap.ts \
        components/site-header.tsx
git commit -m "feat(calendar): public /dividend-calendar landing + sitemap + nav"
```

### Task 9.3 — Open Slice B PR

- [ ] **Step 9.3.1: Push + PR**

```bash
git push -u origin feature/calendar-v2-slice-b
gh pr create --title "Dividend Income Calendar v2 — Slice B (projection engine + public landing)" --body "$(cat <<'EOF'
## Summary
- Projection engine (`lib/scoring/project-dividends.ts`) — cadence detection + 3yr CAGR growth (±20% cap) + cut/freeze dominance + sub-history fallback
- Migration `0021_equity_scores_projection.sql` — 4 additive columns + projected_at timestamp
- score-ticker writes forward + historical projection caches nightly; one-shot backfill script for prod
- Chart renders 3 new segment kinds (projected-cadence, projected-growth, growth-clipped with ⚠ glyph)
- Per-user back-projection at page-render time, gated on `holdings.created_at` floor
- Public `/dividend-calendar` landing — locale-aware demo, three feature panels, FAQ, JSON-LD, sitemap entry

## Prerequisite
- Migration `0021` applied to prod
- `scripts/scoring/backfill-equity-projection.mjs` run once before first post-merge cron cycle

## Test plan
- [ ] All vitest PASS (~26 new tests, ~1420 total)
- [ ] `npm run lint` clean
- [ ] `npm run build` clean
- [ ] Manual: /app/calendar past bars fill in for manual-entry user (back-projection working)
- [ ] Manual: /app/calendar forward bars show projected segments visually distinct from confirmed
- [ ] Manual: /dividend-calendar renders cookieless, demo locale toggle works
- [ ] Manual: sitemap.xml includes /dividend-calendar at priority 0.9
EOF
)"
```

---

## Day 10 — Buffer / polish

Reserved for:
- Visual iteration on Slice A based on Glenn's live-validation feedback
- Slice B projection-rule calibration (±20% / 95% cut threshold) if real data suggests adjustment — change `GROWTH_CAP` and re-run the backfill
- Any test failures surfaced by the integrated `next build` only after both slices merged

---

## Acceptance criteria (cross-slice)

**Slice A done when:**
- `/app/calendar` renders for Pro users, redirects Free to `/pricing?from=/app/calendar`.
- 4 KPI tiles compute correctly against fixture portfolios for both UK + US locales.
- Wrapper filter cascades through KPIs, chart, drill-down.
- Net/Gross toggle changes taxable-wrapper primary-currency displays.
- Tax-year/Calendar-year toggle correctly re-buckets YTD.
- Drill-down opens on click; per-payment list + cadence timeline render correctly.
- Empty-state CTA renders only when applicable.
- Dashboard lite card links to `/app/calendar`.
- All ~21 Slice A tests pass.

**Slice B done when:**
- Migration `0021` applied to prod; cron writes new columns nightly.
- `/app/calendar` chart renders projected-* segments visibly distinct from confirmed.
- Past bars for non-T212 users back-fill from cadence + `holdings.created_at` floor.
- `/dividend-calendar` is live, indexable, in sitemap, locale-aware, demo renders without auth.
- All ~26 Slice B tests pass.
- `next build` clean locally before push.

---

## Memory cross-refs

- `[reference_app_page_auth_guard]` — `/app/calendar` Pro-gate pattern.
- `[reference_app_marketing_chrome_split]` — `/app/calendar` lives under `/app/*` so it inherits the drawer shell, not marketing chrome.
- `[project_scoring_known_data_issues]` — cut-dominance rule motivation.
- `[reference_fmp_coverage_matrix]` — known UK trust / ETF coverage gaps that limit cadence detection.
- `[reference_equity_scoring_spec]` — TDD-first cadence; pure modules tested before UI.
- `[feedback_supabase_promiselike_chain]` — `next build` locally before any push touching `equity_scores`.
- `[feedback_set_state_in_effect_workaround]` — derived state pattern guard.
- `[feedback_dividendmapper_nextjs_warning]` — read `node_modules/next/dist/docs/` before Next-specific code.
- `[reference_supabase_cli_workflow]` — Glenn's CLI flow for `db push`.
- `[reference_supabase_out_of_order_migration_workaround]` — fallback if migrations diverge.
- `[reference_next16_lint]` — `npm run lint`, not `next lint`.
- `[feedback_concurrent_worktree_branch_race]` — node_modules junction caveat when parallel agents share the root checkout.
