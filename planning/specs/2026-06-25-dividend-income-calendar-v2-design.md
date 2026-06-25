# Dividend Income Calendar v2 — Design Spec

**Date:** 2026-06-25
**Status:** Approved through brainstorming (Glenn, 2026-06-25). Pending implementation plan.
**Sibling planning docs:** [2026-06-23 carry-over findings](../plans/2026-06-23-carry-over-2-ex-div-coverage-findings.md) (the v1 gap analysis that prompted v2), [2026-05-31 Day 6B reinvest plan](../plans/2026-05-31-phase-2.75-day6b-reinvest-plan.md) (the v1 data path).

---

## Goal

Promote today's `IncomeCalendarCard` (a quiet card on `/app/dashboard`) to a flagship surface at `/app/calendar` — the core of the in-app user experience. Add a public marketing landing at `/dividend-calendar` for SEO + acquisition. Honour the project's UK/US locale + tax-wrapper awareness end-to-end. Ship in two slices.

## Non-goals (v2)

Out-of-scope, deferred to v2.1 or later:

- Email alerts (ex-div reminder, monthly income digest) — marketing copy already implies these exist; v2.1.
- iCal `.ics` export + per-user subscription URL — competitor differentiator; v2.1.
- Year-over-year ghost overlay on chart bars — explicitly considered, dropped to keep v2 scope tight.
- Per-source breakdown donut (US REIT / UK REIT / BDC / etc.) — also considered and cut.
- Multi-year history strip (5-year sparkline of annual totals) — captured implicitly by 18-month chart for now.
- A "what's your dividend tax band?" onboarding question — v2 uses locale-default bands; band customisation is v2.1.

---

## Architecture

### Three surfaces, one data layer

| Surface | Route | Tier | Purpose |
|---|---|---|---|
| Public landing | `/dividend-calendar` | Public, cookieless, ISR (`revalidate: 3600`) | SEO + acquisition. Indexable. |
| App calendar (flagship) | `/app/calendar` | Pro (via existing `proOnly` redirect) | The full surface. Drawer-pinned. Soft-nav-safe `requireUser()` per [reference_app_page_auth_guard]. |
| Dashboard lite card | `/app/dashboard` (existing) | Authenticated; Pro for full data, paywalled preview for Free | Today's `IncomeCalendarCard` re-skinned as a preview with "Open the calendar →" link. |

### Nav placement

- App drawer: new "Calendar" entry between `Dashboard` and `Portfolio Manager` in `app/app/_components/shell/nav-items.ts`.
- Public header: add to `components/site-header.tsx`'s `BASE_NAV`.
- Sitemap: `/dividend-calendar` at priority `0.9`.

### Locale awareness

User locale (UK / US) is read from existing locale state. Primary display currency = `LocaleConfig.currency` (`GBP` for UK, `USD` for US). Drives chart Y-axis label, hero KPI symbols, conversion target for non-primary holdings. Drill-down rows always show *native + converted*. FX via existing `ratesToGbpFor` helper, generalised to `ratesToBaseFor(targetCurrency)`.

### Data layer

`lib/portfolio/income-calendar.ts` (the existing pure aggregator) is **extended, not replaced**. Same `BuildArgs` plumbing, additive return shape. The dashboard lite card consumes a subset of the new return shape so Slice A doesn't churn dashboard wiring.

### Data sources (all existing)

- **Past actuals:** `user_dividends` table (populated by T212 sync + CSV import).
- **Confirmed forecast:** `equity_scores.next_ex_div_date`, `next_ex_div_amount`, `next_ex_div_pay_date` (cron-populated since Phase 2.75 Day 6B).
- **Slice B additions:** new projection JSONB columns on `equity_scores` (cron-populated; see Section 4) that drive both forward projection and historical gap-fill.

Zero new external API dependencies. Projection engine reuses the FMP per-symbol dividend history already fetched in `score-equities` for the `R_S1` signal — no incremental API cost.

---

## Slice A — Visual surface (~5 working days)

**Scope.** `/app/calendar` page (Pro) + dashboard lite-card update. Uses today's data path only: `user_dividends` past + `equity_scores.next_ex_div_*` confirmed forward. No projection engine, no public landing. Users with sparse `user_dividends` (manual entry, CSV-only) see honest empty bars + a CSV-import CTA. Slice B layers in projection to fill those gaps bidirectionally.

### Page anatomy (top → bottom)

1. **Header row.** Page title "Calendar". Two toggles: `Net | Gross` (defaults to Net — applies tax to taxable-wrapper sums; see Tax module), `Calendar year | Tax year` for the YTD KPI (defaults to user locale's tax year).
2. **Wrapper filter chip row.** UK locale: *All · ISA · SIPP · GIA*. US locale: *All · 401(k) · IRA · Roth · Brokerage*. Filter cascades to KPIs + chart + drill-down.
3. **Hero KPI strip.** Four equal-width tiles, primary-currency-headlined:
   - *Next 7 days* — sum of confirmed forecasts with `pay_date ≤ today + 7`.
   - *Next 30 days* — same, `≤ today + 30`.
   - *YTD received* — sum of `user_dividends` paid since start of selected period (tax year by default, calendar year per toggle).
   - *Last 12 months received* — rolling sum of `user_dividends`.
   - Numbers animate-count on mount (one-shot, ≤ 800 ms, respects `prefers-reduced-motion`).
   - Partial-data tiles render at lower opacity + hint icon (tooltip explains).
4. **18-month chart.** 6 past months + current + 12 forward = 19 buckets.
   - Bar segments by kind: `actual` (solid brand), `partial` (current month, 70%), `confirmed-forecast` (40%, FMP-announced). Slice B adds `projected-cadence`, `projected-growth`, `growth-clipped`.
   - X-axis: month labels, current month highlighted, dashed "today" divider with small badge.
   - Bar fills use a brand → brand-bright gradient on confirmed forecasts.
   - Bars animate in left-to-right on load (30 ms stagger, cap 600 ms total).
   - Click a bar: opens drill-down panel below (defaults open on current month).
   - Future months with zero confirmed payments render as empty space, not a misleading zero bar.
5. **Drill-down panel** (sticky-ish, below chart).
   - **Per-payment list.** Row = ticker · ex-date · pay-date · native amount · primary-currency equiv · *wrapper badge* (sheltered wrappers in brand-emerald tone, taxable in neutral) · confirmed/projected confidence badge. Sortable by date or amount.
   - **Cadence timeline.** Narrow horizontal SVG strip, 1–31 day axis, markers dropped on each payment's ex-date (toggleable to pay-date). Hover a marker → corresponding list row highlights. Markers within 3 days of today pulse subtly.
   - Empty-state copy distinguishes *"this stock pays no dividend"* from *"no announcement yet"* — addresses [carry-over #1](../plans/2026-06-23-carry-over-2-ex-div-coverage-findings.md).
6. **Empty-state CTA panel** (renders only if user has zero `user_dividends` in past 6 months).
   - Headline: *"Past dividends not showing up?"*
   - Body: *"Connect Trading 212 to auto-sync, or import a CSV of past payments."*
   - Buttons: *Connect broker →* (`/app/account/brokers`), *Import CSV →* (existing dividend CSV modal).
   - Sits above the chart, dismissible per session.

### Dashboard lite-card update

Today's `IncomeCalendarCard` shrinks slightly, gains an "Open full calendar →" link in the header, drops the inline reinvest card (moves to `/app/calendar`'s drill-down panel). Free users see a frosted-glass preview with a Pro CTA.

### Tax module (new pure helper, Slice A)

`lib/portfolio/dividend-tax.ts` + `__tests__/`. Pure function:

```ts
computeNetDividend({
  grossPrimaryCurrency: number,
  wrapper: 'isa'|'sipp'|'gia'|'401k'|'ira'|'roth_ira'|'brokerage',
  locale: 'uk'|'us',
  ytdGrossInTaxableSoFar: number,
}) → { net: number, taxApplied: number }
```

**Rules:**
- Sheltered wrappers (ISA, SIPP, 401(k), IRA, Roth IRA): `net = gross`, `taxApplied = 0`.
- UK GIA: first `LocaleConfig.dividendTax.allowance` (£500) of YTD taxable gross is tax-free; remainder taxed at **8.75% basic-rate default**. Allowance carry-over enforced via `ytdGrossInTaxableSoFar` parameter.
- US Brokerage: **15% qualified-dividend flat rate** (most-common case). No US per-ticker allowance.
- Net/Gross toggle in calendar header flips every primary-currency display through this helper.

Tax module is locale-default only in v2. Per-user tax band customisation is v2.1.

### Visual flourishes (locked)

- Bar gradient (brand → brand-bright) on confirmed forecasts.
- Stagger-in chart bars on mount (30 ms each, ≤ 600 ms total).
- Hero KPI numbers animate-count on mount.
- Cadence-timeline markers within 3 days of today pulse subtly.
- "Today divider" carries a small label badge ("today") rather than bare dashed line.
- All animations respect `prefers-reduced-motion`.

### Files (Slice A)

**New:**
- `app/app/calendar/page.tsx` (Pro-gated server component)
- `app/app/calendar/_components/calendar-shell.tsx` (client wrapper for toggle/filter state)
- `app/app/calendar/_components/hero-kpi-strip.tsx`
- `app/app/calendar/_components/wrapper-filter-row.tsx`
- `app/app/calendar/_components/calendar-chart.tsx` (extends IncomeCalendarChart for segments)
- `app/app/calendar/_components/drilldown-panel.tsx`
- `app/app/calendar/_components/cadence-timeline.tsx`
- `app/app/calendar/_components/empty-state-cta.tsx`
- `lib/portfolio/dividend-tax.ts` + tests
- `lib/portfolio/income-calendar.ts` — extended return shape (segments)

**Modified:**
- `app/app/dashboard/_components/IncomeCalendarCard.tsx` — lite-preview treatment + link
- `app/app/dashboard/_components/IncomeCalendarChart.tsx` — segment-aware bars (back-compat to flat `gbp` retained for v2)
- `app/app/_components/shell/nav-items.ts` — add Calendar entry

### Tests (Slice A)

~21 new tests (15 visual + 6 tax module):
- `dividend-tax.test.ts`: sheltered wrappers, UK allowance carry-over, US flat rate, locale switching (~6 tests).
- Hero KPI strip: tile calculations from fixtures, partial-data hint render (~3 tests).
- Chart: segment provenance tagging, today-divider position, animation guard for reduced motion (~3 tests).
- Drill-down: per-payment list render, wrapper-badge tonal class, cadence-timeline marker positioning + coordinated hover (~4 tests).
- Empty-state-CTA render condition (~1 test).
- Wrapper filter cascade test (~1 test).
- Tax-year vs calendar-year YTD toggle test (~2 tests).
- Soft-nav `requireUser()` guard on the page (~1 test).

---

## Slice B — Projection engine + public landing (~4 working days)

**Scope.** Bidirectional projection engine, cron extension to populate forward + historical projection caches nightly, chart update to render projected segments in both directions (back-fills the past for non-T212 users; fills the forward for any holding without an FMP announcement), public `/dividend-calendar` marketing landing.

### Projection engine

**Home.** `lib/scoring/project-dividends.ts` + `__tests__/`. Pure module; no DB writes, no rendering.

**Signature.**

```ts
projectDividends({
  ticker,
  historicalPayments: HistoricalDividend[],   // from FMP per-symbol history
  holding: { quantity, createdAt },
  today: Date,
  direction: 'forward' | 'backward',
}) → ProjectedPayment[]
```

```ts
type ProjectionConfidence =
  | 'cadence'         // cadence-fill, no growth assumption
  | 'cadence+growth'  // cadence-fill with 3yr-CAGR adjustment
  | 'growth-clipped'  // growth rate hit the ±20%/yr cap
  | 'growth-unknown'; // sub-history fallback (2-3 payments)

interface ProjectedPayment {
  exDate: string; payDate: string;
  perShareAmount: number; currency: string;
  confidence: ProjectionConfidence;
}
```

### Algorithm

1. **Cadence detection.** Median inter-payment gap of the last 4–8 ex-dates. Bucket: `monthly` (28–35d), `quarterly` (85–95d), `semi` (175–190d), `annual` (355–370d), `irregular` (anything else). If `historicalPayments.length < 4`, abort with `[]` and tag the ticker `cadence-unknown`.
2. **Last-known amount.** Most recent payment amount.
3. **Growth rate.** 3-year CAGR of last 12 payments' annualised totals (sum-by-year ÷ prior-year sum, geometric over 3 years). **Capped at ±20%/yr** — outside-band rates clip to the cap and the result is tagged `growth-clipped`.
4. **Cut/freeze dominance.** If the most recent payment is < 95% of the trailing-12m-average payment, set growth to 0 (treat as freeze) until the next confirmed payment lands. Per [project_scoring_known_data_issues], cuts are the dominant signal — projecting growth through one is misleading.
5. **Sub-history fallback.** If `historicalPayments.length` is 2–3, project last-known-amount at `growth = 0`. Tag `growth-unknown`.
6. **Direction = `backward` extra guard.** `from = max(holding.createdAt, today − 6 months)`. Don't back-project before the user owned the position. If `holding.createdAt` is null (legacy rows), default to `today − 6 months`.
7. **Output.** Array of `ProjectedPayment` for each projected ex-date in range.

### Cron extension

`score-equities/run.ts` already loops per-ticker fetching FMP history. After computing existing scores, additionally:
- Call `projectDividends(..., direction: 'forward')` for next 12 months.
- Call `projectDividends(..., direction: 'backward')` for past 12 months *without* a holding-specific `createdAt` floor (page-time logic re-applies the floor per user).
- Persist into new `equity_scores` columns (see Section 4).

Per-user back-projection runs at *page-render time* (not cron — depends on `holdings.created_at`). Page combines cron-cached per-ticker historical projection with the user's `holdings.quantity` and `created_at` floor. Cron stays user-stateless; page-load stays fast.

### Chart extension (Slice B)

`CalendarChart` learns three new bar-segment kinds:
- `projected-cadence` — striped fill at 30% opacity (cadence-fill, no growth).
- `projected-growth` — striped fill + brand-bright top edge at 35% opacity (growth-adjusted).
- `growth-clipped` — same as `projected-growth` plus a small ⚠ corner glyph (hover: *"growth rate capped at ±20%/yr"*).

Past bars stack `actual + projected-cadence` segments (confirmed user_dividends + cadence gap-fill). Future bars stack `confirmed-forecast + projected-cadence + projected-growth`. Chart accessibility label extends to read each segment's kind.

Hero KPI tiles gain a *"(incl. projected)"* footnote tooltip wherever the underlying number includes projected payments.

### Public landing `/dividend-calendar`

Single page, indexable, cookieless, ISR `revalidate: 3600`. Locale-aware (UK / US toggle reused from Phase 1).

1. **Hero.** Headline *"Know exactly when every dividend lands"*, subhead, two CTAs (*See it with your portfolio* → `/signup`, *Sample portfolio demo* → anchors to demo). Hero image: a static, well-staged screenshot of `/app/calendar` rendered with fixture portfolio.
2. **Demo.** Embedded read-only mini calendar pre-loaded with a curated fixture portfolio (locked at `app/(public)/dividend-calendar/_fixtures/sample-portfolio.ts`):
   - UK locale: 8 tickers in mixed wrappers (5 ISA: PHP.L, BATS.L, BBOX.L, IMB.L, SSE.L; 3 GIA: O, ARCC, SCHD). Demonstrates projection + cadence + multi-currency + wrapper diversity.
   - US locale: 8 tickers (3 Roth: O, VICI, AMT; 2 IRA: ARCC, SCHD; 3 Brokerage: BTI (BAT ADR), AAPL, MSFT). Locale toggle swaps.
   - Same `CalendarChart` component, props-fed from static fixture, no auth, no Supabase calls.
3. **Three feature panels.**
   - *Projected, not just confirmed* — explains cadence-fill + the ±20% clip in plain English.
   - *Every dividend in one place* — multi-broker + CSV.
   - *Tax-wrapper-aware* — *"ISA / Roth dividends tax-free in your locale — surfaced automatically."*
4. **FAQ.** 4–6 entries: how projections work, currency handling, what brokers are supported, what happens on a cut, Pro vs Free, why we cap growth at ±20%.
5. **Footer CTA.** Sign-up.

**SEO.** Metadata targets *"dividend calendar UK"*, *"dividend income forecast"*, *"dividend schedule tracker"*. JSON-LD `WebApplication` schema with `featureList`. Added to `app/sitemap.ts` at priority `0.9`.

### Files (Slice B)

**New:**
- `lib/scoring/project-dividends.ts` + tests
- `app/(public)/dividend-calendar/page.tsx`
- `app/(public)/dividend-calendar/_components/landing-hero.tsx`
- `app/(public)/dividend-calendar/_components/demo-calendar.tsx`
- `app/(public)/dividend-calendar/_components/feature-panels.tsx`
- `app/(public)/dividend-calendar/_components/landing-faq.tsx`
- `app/(public)/dividend-calendar/_fixtures/sample-portfolio.ts`
- `supabase/migrations/0021_equity_scores_projection.sql`
- `lib/portfolio/income-calendar.ts` — extend with projection-aware build

**Modified:**
- `scripts/scoring/score-equities/run.ts` — write new projection columns
- `app/app/calendar/_components/calendar-chart.tsx` — learn new segment kinds
- `app/app/calendar/_components/hero-kpi-strip.tsx` — `(incl. projected)` footnote
- `components/site-header.tsx` — add `/dividend-calendar` to `BASE_NAV`
- `app/sitemap.ts` — add `/dividend-calendar`

### Tests (Slice B)

~26 new tests:
- `project-dividends.test.ts`: cadence detection bucketing, growth-rate computation, ±20% clip, cut-dominance freeze, sub-history fallback, backward `createdAt` floor (~15 tests).
- score-equities cron: new projection columns populate end-to-end from fixture symbol history (~3 tests).
- Chart: new segment kinds render with correct opacity + test-ids + accessibility label (~5 tests).
- Public landing: renders without auth, demo component hydrates with fixture, sitemap includes route, JSON-LD present (~3 tests).

---

## Section 4 — Data model

**One migration: `0021_equity_scores_projection.sql`** (Slice B). Five additive columns on existing `equity_scores`. No new tables. No RLS changes.

```sql
ALTER TABLE equity_scores
  ADD COLUMN projected_next_12m_payments        JSONB,
  ADD COLUMN projected_historical_12m_payments  JSONB,
  ADD COLUMN projected_cadence                  TEXT,
  ADD COLUMN projected_growth_rate              NUMERIC,
  ADD COLUMN projected_at                       TIMESTAMPTZ;
```

Each JSONB column is an array of `{ ex_date, pay_date, per_share_amount, currency, confidence }` rows. Forward and historical kept distinct so back-projection can be re-applied per-user without re-running cadence detection.

**No table needed for back-projection.** Per-user back-fill is derived at render time by combining `projected_historical_12m_payments` (cron-written) with the user's `holdings.quantity` and `holdings.created_at` floor. Stateless w.r.t. users; trivially cache-invalidatable.

### Existing schema relied on (no changes)

- `equity_scores.next_ex_div_date`, `next_ex_div_amount`, `next_ex_div_pay_date` — Slice A consumes directly (confirmed forecast).
- `holdings.wrapper` enum (`isa`, `sipp`, `gia`, `401k`, `ira`, `roth_ira`, `brokerage`) — wrapper aggregation + filtering. Phase 2 models holdings *per wrapper* — same ticker in ISA + GIA = two rows.
- `holdings.created_at` — Slice B back-projection floor. Assumed non-null for new rows; legacy rows fall back to `today − 6 months`.
- `holdings.quantity`, `holdings.currency` — per-row position data.
- `user_dividends.paid_on`, `amount`, `currency`, `wrapper` — Slice A actuals + wrapper attribution.
- `LocaleConfig` from `lib/locale/configs.ts` — currency, tax year, dividend allowance, wrapper labels.

### Type contracts (additive)

```ts
// lib/scoring/project-dividends.ts (Slice B)
export type ProjectionConfidence =
  | 'cadence' | 'cadence+growth' | 'growth-clipped' | 'growth-unknown';

export interface ProjectedPayment {
  exDate: string; payDate: string;
  perShareAmount: number; currency: string;
  confidence: ProjectionConfidence;
}

// lib/portfolio/income-calendar.ts (Slice A — additive to existing shape)
export type SegmentKind =
  | 'actual'              // user_dividends, past or current
  | 'partial'             // current-month partial
  | 'confirmed-forecast'  // equity_scores.next_ex_div_*
  | 'projected-cadence'   // Slice B: cadence-fill
  | 'projected-growth'    // Slice B: cadence + growth
  | 'growth-clipped';     // Slice B: growth hit cap

export interface IncomeCalendarMonth {
  ym: string;
  segments: Array<{ primary: number; kind: SegmentKind }>;
  gbp: number;   // back-compat — sum of segments; deprecated for v2.1 cleanup
  kind: SegmentKind;  // back-compat — dominant kind; deprecated for v2.1 cleanup
}
```

### Non-breaking schema strategy

Slice A's chart and the dashboard lite card consume both the new `segments` array AND the legacy `gbp + kind` fields during the transition. Slice B simply adds new entries to the `SegmentKind` union — the chart already speaks segments. v2.1 cleanup removes the legacy `gbp + kind` fields once nothing reads them.

---

## Section 5 — Testing strategy

**Per-slice totals:** Slice A ~15 tests + ~6 tax-module tests = ~21. Slice B ~26 tests. Plus ~5 cross-cutting tests for wrapper/locale aggregation. **~52 new tests total.**

### Pure modules first (TDD per [reference_equity_scoring_spec])

These ARE the engine — most test surface:
- `project-dividends.ts`: cadence detection bucketing, growth-rate computation, ±20% clip behaviour, cut-dominance freeze trigger, sub-history fallback path, `holdings.createdAt` back-projection floor enforcement.
- `dividend-tax.ts`: sheltered wrapper passthrough, UK £500 allowance carry-over across multiple holdings, US 15% flat, locale switching, primary-currency parity.
- `income-calendar.ts` (extended): segment composition correctness, wrapper aggregation, locale-aware primary-currency conversion.

### Component tests (RTL)

- Chart: segment provenance rendering, today-divider position, animation guard for `prefers-reduced-motion`, segment-kind a11y labels.
- Hero KPI strip: tile calculations from fixtures, partial-data hint render, `(incl. projected)` tooltip when applicable.
- Wrapper filter chip row: locale-aware chip set, cascade to KPIs + chart + drill-down.
- Drill-down per-payment list: row composition, wrapper-badge tonal class, sortable behaviour.
- Cadence timeline: marker positioning, coordinated hover with list rows, ≤3-days-out pulse.
- Empty-state CTA: render condition (zero `user_dividends` in past 6mo).

### Route tests

- `/app/calendar`: Pro-gate, soft-nav `requireUser()` per [reference_app_page_auth_guard], correctly loads server data.
- `/dividend-calendar`: renders cookieless, ISR cache headers, JSON-LD present, demo hydrates without auth, sitemap includes route.

### Cross-cutting (locale + wrapper)

- UK tax-year YTD computation (April 6 → April 5).
- US tax-year YTD computation (Jan 1 → Dec 31).
- USD-primary vs GBP-primary chart rendering equivalence.
- Sample portfolio fixture diversity check (≥3 wrappers represented per locale).

### Cron test

`score-equities` writes the four new projection columns end-to-end with a fixture symbol history exercising each `confidence` band.

### Anti-pattern guards (memory entries)

- `next build` locally before pushing any Supabase-touching code per [feedback_supabase_promiselike_chain] — applies to Slice B's `equity_scores` reads.
- No `useState` + `useEffect` for derived state per [feedback_set_state_in_effect_workaround] — drill-down panel state stays local-only.

---

## Slicing summary

| Slice | Days | PR | Ships |
|---|---|---|---|
| A | ~5 | 1 | `/app/calendar` page, all visual surface, tax module, dashboard lite-card update, wrapper filter, locale awareness. **Uses today's data path** — sparse past for non-T212 users + CSV import CTA. |
| B | ~4 | 1 | Projection engine module + cron extension + migration 0021 + chart segments + `/dividend-calendar` public landing. Back-fills Slice A's sparse past for non-T212 users. |

**Total:** ~9 working days + 1 buffer day = **10 working days**, two sequential PRs gated by Slice A live-validation before Slice B starts. Sequenced after Phase 4 Income Vehicles Hub (just shipped).

---

## Risks + open questions

- **Projection-engine calibration risk.** ±20% growth cap and 95% cut-detection threshold are first-pass values. May need adjustment after seeing real-world output. Mitigation: Slice B persists `projected_growth_rate` uncapped for diagnostic; Glenn can run a one-shot script post-cron to inspect distribution before locking.
- **Holdings without `created_at`.** Legacy holdings rows may have null `created_at`. Default to `today − 6 months` floor; this overstates income for legacy positions held longer than 6 months. Acceptable — they'll see *less* projected income than reality, not more. Worth a one-shot backfill script (Slice B Day 1) if Glenn wants it.
- **Multi-currency holdings without FMP coverage.** UK trusts that FMP doesn't carry (per [reference_fmp_coverage_matrix]) will return empty `historicalPayments` → `cadence-unknown` → empty bars. Same v1 gap; v2 doesn't worsen it but doesn't fix it either. Carry-over doc's spawned question #2 (UK trust coverage sweep into Phase 4 data infra) remains the right place to address.
- **Tax band customisation.** v2 ships locale-default bands only (UK 8.75%, US 15%). Higher-rate UK taxpayers will see overstated net. v2.1 adds per-user band setting; mitigation in v2 is the `Net | Gross` toggle so users can flip back to gross.
- **Public landing demo currency confusion.** Locale toggle on the landing must persist for the demo component — risk of users seeing dollar amounts on the UK landing if toggle state is mishandled. Test guard: demo currency assertion per locale.

---

## Acceptance criteria

**Slice A is done when:**
- `/app/calendar` renders for Pro users, returns 302 to upgrade for Free.
- 4 KPI tiles compute correctly against fixture portfolios for both locales.
- Wrapper filter cascades through KPIs, chart, drill-down.
- Net/Gross toggle changes taxable-wrapper primary-currency displays.
- Tax-year/Calendar-year toggle correctly re-buckets YTD.
- Drill-down opens on click; per-payment list + cadence timeline render correctly.
- Empty-state CTA renders only when applicable.
- Dashboard lite card links to `/app/calendar`.
- All ~21 Slice A tests pass.

**Slice B is done when:**
- Migration `0021` applied to prod; cron writes new columns nightly.
- `/app/calendar` chart renders projected-* segments visibly distinct from confirmed.
- Past bars for non-T212 users back-fill from cadence + `holdings.createdAt` floor.
- `/dividend-calendar` is live, indexable, in sitemap, locale-aware, demo renders without auth.
- All ~26 Slice B tests pass.
- `next build` clean locally before push.

---

## Memory cross-refs

- [reference_app_page_auth_guard] — `/app/calendar` Pro-gate pattern.
- [reference_app_marketing_chrome_split] — `/app/calendar` lives under `/app/*` so it inherits the drawer shell, not marketing chrome.
- [project_scoring_known_data_issues] — cut-dominance rule motivation.
- [reference_fmp_coverage_matrix] — known UK trust / ETF coverage gaps that limit cadence detection.
- [reference_equity_scoring_spec] — TDD-first cadence; pure modules tested before UI.
- [feedback_supabase_promiselike_chain] — `next build` locally before any push touching `equity_scores`.
- [feedback_set_state_in_effect_workaround] — derived state pattern guard.
- [feedback_dividendmapper_nextjs_warning] — read `node_modules/next/dist/docs/` before Next-specific code.
