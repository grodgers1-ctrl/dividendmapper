# Phase 4 Sprint 3 — Public Pages + Methodology (Days 14–21)

> **For agentic workers:** REQUIRED SUB-SKILLS in order — `superpowers:executing-plans` (this plan), `superpowers:subagent-driven-development` (per-day execution), `superpowers:test-driven-development` (per-task where logic-shaped; UI tasks favour preview/Lighthouse over unit tests).

**Sprint outcome.** Three indexable family route trees live — `/reits`, `/bdcs`, `/uk-reits` — each with a list page + per-ticker page rendered against a shared `vehicle-page-template.tsx`. Methodology page citable at `/methodology/income-vehicles`. Sitemap surfaces every scored ticker. Lighthouse ≥ 95 perf / ≥ 95 SEO on each route. Pro breakdown gated; unauth visitors see the headline Resilience + leverage gauge + Price/NAV sparkline.

**Branch.** `phase-4/income-vehicle-scoring` (long-lived), worked from a fresh worktree at `.worktrees/phase-4-sprint-3`. Per-day commits inside the worktree. Sprint 3 PR rebased onto current main at end of Day 21.

**Carries over from Sprint 2.** `vehicle_scores` + `vehicle_score_signals` + `vehicle_score_history` populated daily by the 09:00 UTC cron. `compute-vehicle-score.ts` orchestrator + 13 signal modules + 6 quality gates already shipped. UK REIT classification JSON live at `lib/scoring/data/uk-reit-classification.json`.

---

## Pre-flight (Day 13.5 — before Day 14 kicks off)

### 1. Agentic worker — worktree setup

Sprint 2 used a per-sprint child branch off `phase-4/income-vehicle-scoring`; same pattern here. Fresh worktree:

```bash
cd /c/Users/grodg/dividend_mapper_plan
git fetch origin
git worktree add dividendmapper/.worktrees/phase-4-sprint-3 -b phase-4/sprint-3 origin/main
cd dividendmapper/.worktrees/phase-4-sprint-3/dividendmapper
cmd //C "mklink /J node_modules ..\\..\\..\\..\\dividendmapper\\node_modules"
cmd //C "mklink .env.local ..\\..\\..\\..\\dividendmapper\\.env.local"
npx vitest run lib/scoring/__tests__/compute-vehicle-score.test.ts   # baseline — expect 7 passed
```

### 2. Glenn — first live cron run on dev

Before Day 14, Glenn invokes the Sprint 2 scoring cron once against dev so `vehicle_scores` / `vehicle_score_signals` / `vehicle_score_history` have rows the new pages can read:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://dividendmapper.com/api/internal/refresh-vehicle-scores
```

Then run the Sprint 2 Verify SQL block from the Sprint 2 plan. Confirm ~91 scored tickers across the three families. If the cron output is clean and counts are right, Day 14 can start. If gate-fails > 20% of universe, raise it — likely a CAL-3 (Q_S1 raw-sum) bleed-through that should be patched before pages go live.

### 3. Agentic worker — pin colour ramp (optional, ≤ 30 min)

If Glenn wants the `color-expert` ramp landed early so Day 14's template uses real tokens from the outset, run the colour-expert skill once at this point — produces a 5-stop ramp the rest of the sprint binds to. Otherwise it can wait for Day 19; the template uses the existing `bg-amber-*` / `text-emerald-*` Tailwind tokens in the interim.

---

## File map (lock decomposition here)

**New library code:**
- `lib/scoring/load-vehicle-score.ts` — cookieless public read of `vehicle_scores` + `vehicle_score_signals` for one ticker. Mirrors `load-score.ts` (equity).
- `lib/scoring/list-vehicle-tickers.ts` — list helper for the family index pages. Filters by `vehicle_type`, supports sort + sub-sector filter.
- `lib/scoring/data/vehicle-families.ts` — per-family display metadata (heading copy, list-page sort default, leverage-gauge mode label, glossary anchor).
- `lib/scoring/vehicle-public-summary.ts` — analog of `public-summary.ts`; one-sentence headline + chip colour from a `VehicleScoreResult`.

**New shared route group + components:**
- `app/(public)/_components/vehicle-page-template.tsx` — server component, takes a `VehicleScoreResult` + family metadata, renders the per-ticker layout. Pro detail is a client island.
- `app/(public)/_components/leverage-gauge.tsx` — SVG semicircular gauge. Parameterised by family (FFO payout / NII coverage / LTV).
- `app/(public)/_components/price-nav-sparkline.tsx` — SVG sparkline with ±1σ shaded band, 5y window. Reads `vehicle_score_history.price_nav_ratio` plus mean+stdev from `vehicle_score_signals.D_S1`.
- `app/(public)/_components/resilience-spider.tsx` — 4-axis radar (Q/D/C/R). Client-side only because the Pro reveal is interactive. Composes `Q_*`, `D_S1`, `C_*`, `R_*` per-family.
- `app/(public)/_components/family-tile-grid.tsx` — sub-sector tile grid for the list-page surface.
- `app/(public)/_components/vehicle-pro-detail.tsx` — Pro-gated full breakdown (analog of `pro-score-detail.tsx` for equities).

**New family routes (three parallel trees, identical shape):**
- `app/(public)/reits/page.tsx` — US REIT list.
- `app/(public)/reits/[ticker]/page.tsx` — US REIT per-ticker.
- `app/(public)/reits/_components/{list-filters.tsx,coverage-banner.tsx}` — list-specific UI.
- `app/(public)/bdcs/page.tsx` — US BDC list.
- `app/(public)/bdcs/[ticker]/page.tsx` — US BDC per-ticker.
- `app/(public)/uk-reits/page.tsx` — UK REIT list.
- `app/(public)/uk-reits/[ticker]/page.tsx` — UK REIT per-ticker.

**Methodology + SEO:**
- `app/(public)/methodology/income-vehicles/page.mdx` — shared methodology MDX page.
- `app/(public)/_components/jsonld-financial-product.tsx` — JSON-LD `FinancialProduct` helper.
- `app/(public)/opengraph-image.tsx` extension OR per-family `opengraph-image.tsx` files (decide on Day 20 based on caching cost).
- `app/sitemap.ts` — extended with `/reits`, `/bdcs`, `/uk-reits` + per-ticker entries.

**Tests:**
- `lib/scoring/__tests__/load-vehicle-score.test.ts`
- `lib/scoring/__tests__/list-vehicle-tickers.test.ts`
- `lib/scoring/__tests__/vehicle-public-summary.test.ts`
- `app/(public)/_components/__tests__/leverage-gauge.test.tsx` (snapshot + branch coverage)
- `app/(public)/_components/__tests__/price-nav-sparkline.test.tsx`
- `app/(public)/_components/__tests__/resilience-spider.test.tsx`
- No route-level integration tests — covered by preview MCP + Lighthouse in the EOD checklists.

---

## Day 14 — Per-vehicle template + public data loaders

**Outcome.** Server-component `vehicle-page-template.tsx` renders against a stub `VehicleScoreResult` in isolation. Public data loaders return clean Result objects for a given ticker. ~14 tests.

### Task 14.1 — `lib/scoring/load-vehicle-score.ts`

**Files.** `lib/scoring/load-vehicle-score.ts` + `lib/scoring/__tests__/load-vehicle-score.test.ts`.

**Definition.** Mirror `load-score.ts` but for `vehicle_scores` + `vehicle_score_signals`. Three public functions live in the same file so the route can do one import:

```ts
export interface VehicleScoreLoadResult {
  ticker: string;
  vehicleType: 'us_reit' | 'us_bdc' | 'uk_reit';
  displayName: string;       // joined from vehicle_universe
  subSector: string | null;  // joined from vehicle_universe
  resilienceScore: number | null;
  qualityGatePassed: boolean;
  failedGates: string[];
  dataQuality: 'full' | 'partial' | 'sparse';
  computedAt: string;
  priceNavRatio: number | null;
  signals: { code: string; rawScore: number | null; weight: number; contribution: number; humanLabel: string }[];
}

export async function loadVehicleScore(
  sb: SupabaseClient,
  ticker: string,
): Promise<VehicleScoreLoadResult | null>;

export async function loadVehicleScoreHistory(
  sb: SupabaseClient,
  ticker: string,
  days: number,                // typically 365 * 5 for the 5y sparkline
): Promise<{ observed_at: string; price_nav_ratio: number | null }[]>;

export function normalizeTicker(raw: string): string | null;  // mirror load-score.ts
```

**TDD steps.**
1. Write failing tests: `loadVehicleScore` returns null for missing ticker; aggregates `vehicle_scores` + same-day `vehicle_score_signals` + `vehicle_universe`; tolerates stale day in signals (most recent observed_at wins). `loadVehicleScoreHistory` returns rows date-asc with the window applied. `normalizeTicker` uppercases + strips whitespace + rejects empty.
2. `npx vitest run lib/scoring/__tests__/load-vehicle-score.test.ts` → confirm fails.
3. Implement using the stub-Supabase pattern from `vehicle-persist-scores.test.ts`. Use cookieless client (`createSupabasePublicClient`) at the call site (this module is client-agnostic — takes the client by injection like `load-score.ts`).
4. Commit `Phase 4 Sprint 3 Day 14: vehicle public score loader`.

### Task 14.2 — `lib/scoring/list-vehicle-tickers.ts`

**Files.** `lib/scoring/list-vehicle-tickers.ts` + test.

**Definition.** Takes `{ supabase, vehicleType, sort, subSector? }`, returns `Array<{ ticker, displayName, resilienceScore, subSector }>`. Joins `vehicle_universe` (display_name, sub_sector) with `vehicle_scores` (resilience_score). Sort options: `'resilience-desc' | 'resilience-asc' | 'alpha'`. Empty score becomes `null`.

**TDD.** ~4 tests covering the three sort options + the sub-sector filter.

### Task 14.3 — `lib/scoring/data/vehicle-families.ts`

**Files.** `lib/scoring/data/vehicle-families.ts` (no test — pure data).

**Definition.** A const map keyed by `vehicleType`:

```ts
export const VEHICLE_FAMILIES = {
  us_reit: {
    slug: 'reits',
    heading: 'US REITs',
    indexCopy: 'Real estate investment trusts ranked by dividend resilience.',
    leverageMode: 'ffo-payout',
    sortDefault: 'resilience-desc',
    methodologyAnchor: '#us-reits',
  },
  us_bdc: {
    slug: 'bdcs',
    heading: 'Business development companies (BDCs)',
    indexCopy: 'High-yield US BDCs ranked by NII-coverage strength and resilience.',
    leverageMode: 'nii-coverage',
    sortDefault: 'resilience-desc',
    methodologyAnchor: '#us-bdcs',
  },
  uk_reit: {
    slug: 'uk-reits',
    heading: 'UK REITs',
    indexCopy: 'LSE-listed real estate investment trusts ranked by dividend resilience.',
    leverageMode: 'ltv',
    sortDefault: 'resilience-desc',
    methodologyAnchor: '#uk-reits',
  },
} as const;
```

### Task 14.4 — `lib/scoring/vehicle-public-summary.ts`

**Files.** `lib/scoring/vehicle-public-summary.ts` + test.

**Definition.** Pure function: from a `VehicleScoreLoadResult`, produce `{ headline: string, chipColor: 'green' | 'amber' | 'red' | 'grey' }`. Headline is a short sentence the page meta + OG image consume; chipColor extends the existing `chip-display.ts` rules to the resilience composite (≥ 70 green, 50–70 amber, < 50 red, gate-failed grey).

**TDD.** ~4 tests covering each chip band + gate-failed.

### Task 14.5 — `app/(public)/_components/vehicle-page-template.tsx`

**Files.** `app/(public)/_components/vehicle-page-template.tsx`. No unit test — preview-driven verify.

**Definition.** Server component (no `'use client'`), props:

```ts
interface Props {
  score: VehicleScoreLoadResult;
  family: typeof VEHICLE_FAMILIES[keyof typeof VEHICLE_FAMILIES];
  displayName: string;
  proSlot: React.ReactNode;          // Pro-gated breakdown injected from the route
  navHistory: { observed_at: string; price_nav_ratio: number | null }[];
}
```

Layout:
- Header: ticker, displayName, large Resilience number (mono-numeral, 96px+).
- "Quality gate" chip — passed / failed (+ failed gates list when failed).
- Leverage gauge (Day 19 will polish; Day 14 lands a placeholder div with the right structure).
- Price/NAV sparkline placeholder.
- 4 category strip (Q/D/C/R aggregate scores).
- `{proSlot}` — caller injects the Pro full breakdown (or upsell card for unauth).
- Footer methodology link + AGENTS.md disclaimer line.

Verify by running `npx tsx scripts/preview/render-vehicle-template.tsx` (small one-off script that fakes a `VehicleScoreLoadResult` and writes the rendered HTML to a temp file). Skip the script if Day 15's `/reits/[ticker]` page already wires the template — start the dev server and screenshot via preview MCP.

### Day 14 end-of-day checklist

- [ ] Three data modules + summary + template committed
- [ ] `npx vitest run lib/scoring/__tests__/load-vehicle-score.test.ts lib/scoring/__tests__/list-vehicle-tickers.test.ts lib/scoring/__tests__/vehicle-public-summary.test.ts` all green (~14 tests)
- [ ] Full scoring suite still green: `npx vitest run --no-file-parallelism lib/scoring/` (expect ≥ 525 tests post-Sprint-2)
- [ ] Commit: `Phase 4 Sprint 3 Day 14: public loaders + vehicle-page-template`

---

## Day 15 — `/reits` + `/reits/[ticker]`

**Outcome.** US REIT list + per-ticker pages live behind ISR, unauth visitors see the public surface, Pro detail gated. Lighthouse desktop on `/reits/O` ≥ 95 perf / ≥ 95 SEO.

### Task 15.1 — `app/(public)/reits/page.tsx`

**Files.** `app/(public)/reits/page.tsx`, `app/(public)/reits/_components/list-filters.tsx`.

**Definition.** Server component, `revalidate: 3600`. Reads `listVehicleTickers({ vehicleType: 'us_reit', sort, subSector })` from search params (`?sort=`, `?sub=`). Renders a sortable table:

```tsx
<table>
  <thead>
    <tr><th>Ticker</th><th>Name</th><th>Sub-sector</th><th>Resilience</th></tr>
  </thead>
  <tbody>
    {rows.map(r => (
      <tr key={r.ticker}>
        <td><Link href={`/reits/${r.ticker}`}>{r.ticker}</Link></td>
        <td>{r.displayName}</td>
        <td>{r.subSector ?? '—'}</td>
        <td>{r.resilienceScore ?? <span title="Quality gate failed">—</span>}</td>
      </tr>
    ))}
  </tbody>
</table>
```

`list-filters.tsx` is a client component with `useRouter().push()` to update query string. Sub-sector dropdown options derived server-side from distinct values in `vehicle_universe` for the family.

**Metadata.** `title: 'US REITs ranked by dividend resilience'`, `description` ≤ 158 chars, canonical `/reits`.

### Task 15.2 — `app/(public)/reits/[ticker]/page.tsx`

**Files.** `app/(public)/reits/[ticker]/page.tsx`, `app/(public)/_components/vehicle-pro-detail.tsx` (shared across all three families).

**Definition.** Mirrors `app/(public)/scoring/[ticker]/page.tsx`:
- `revalidate: 3600`, `dynamicParams: true`.
- `generateStaticParams` lists active US REIT tickers from `vehicle_universe`.
- `generateMetadata` consumes `vehiclePublicSummary(score)`.
- Body: `<VehiclePageTemplate score={...} family={VEHICLE_FAMILIES.us_reit} proSlot={<VehicleProDetail signals={...} />} />`.
- Pro detail: same `useUser()` hook the equity Pro detail uses — anon visitors see an upsell card with the first signal teased; Pro sees the full breakdown.

**`not-found.tsx`** sibling — borrow shape from `app/(public)/scoring/not-found.tsx`.

### Task 15.3 — Preview verify

Use the Preview MCP (`preview_start` + `preview_snapshot` + `preview_screenshot`):
1. `/reits` — sortable table renders, click a ticker → navigates.
2. `/reits/O` — Resilience number visible, gate chip visible, Pro slot shows upsell.
3. Run Lighthouse via `npx lighthouse` against the local preview URL — desktop perf ≥ 95, SEO ≥ 95.

### Day 15 end-of-day checklist

- [ ] `/reits` + `/reits/[ticker]` + shared Pro detail committed
- [ ] `npx playwright test` (if any pre-existing Playwright suites touch routing) still green; we add no new Playwright here
- [ ] Lighthouse screenshot pasted into the commit message
- [ ] Commit: `Phase 4 Sprint 3 Day 15: /reits list + per-ticker pages`

---

## Day 16 — `/bdcs` + `/bdcs/[ticker]`

**Outcome.** Same shape as Day 15, BDC-specific. Default sort surfaces yield because that's the consumer hook for BDCs.

### Task 16.1 — `app/(public)/bdcs/page.tsx`

Identical structure to `/reits/page.tsx` but with two additions:
- Extra column: "TTM yield" — pulled from `equity_scores.yield_ttm` (BDC tickers live in both `equity_scores` and `vehicle_scores`; the yield column already exists). If a ticker is missing equity-side yield, render `—`.
- Default sort `?sort=yield-desc` rather than resilience-desc. Implement by extending `listVehicleTickers` with a 4th sort option or by post-sorting in the page (V1 favours the page-level post-sort to keep `listVehicleTickers` family-agnostic).

### Task 16.2 — `app/(public)/bdcs/[ticker]/page.tsx`

Same shape as Day 15.2 with `family: VEHICLE_FAMILIES.us_bdc`. The leverage gauge wires `nii-coverage` mode automatically via `family.leverageMode`.

### Task 16.3 — Preview verify

- `/bdcs` — yield column visible, default sort is yield-desc, ticker links navigate.
- `/bdcs/MAIN` — Resilience visible, NII-coverage gauge (placeholder until Day 19), Pro upsell visible.

### Day 16 end-of-day checklist

- [ ] BDC list + per-ticker pages committed
- [ ] Lighthouse desktop screenshot for `/bdcs/MAIN` pasted
- [ ] Commit: `Phase 4 Sprint 3 Day 16: /bdcs list + per-ticker pages`

---

## Day 17 — `/uk-reits` + `/uk-reits/[ticker]`

**Outcome.** UK family routes live. Sterling formatting (£ prefix), Price/NAV ratios kept dimensionless. GBX → GBP normalisation already happened at ingestion; verify the displays.

### Task 17.1 — `app/(public)/uk-reits/page.tsx`

Same shape; family copy from `VEHICLE_FAMILIES.uk_reit`. Add a "Property focus" column reading `propertyTypeFor(ticker)` (already exported from `signals/c_u1-property-focus.ts`). Add a "Geographic scope" column reading `geographicScopeFor`.

### Task 17.2 — `app/(public)/uk-reits/[ticker]/page.tsx`

Same shape with `family: VEHICLE_FAMILIES.uk_reit`. The leverage gauge wires LTV mode. Verify the LTV displays correctly for BLND.L (33%) and SGRO.L (28%) — both should land in the green band per the spot-check matrix.

### Task 17.3 — Preview verify

- `/uk-reits` — property focus + geo scope columns visible.
- `/uk-reits/BLND.L` — Resilience visible, LTV gauge placeholder shows 33%, property focus "diversified" copy under the header.
- Sterling formatting on any price field (no `$` slip).

### Day 17 end-of-day checklist

- [ ] UK REIT list + per-ticker pages committed
- [ ] Lighthouse desktop screenshot for `/uk-reits/BLND.L` pasted
- [ ] Commit: `Phase 4 Sprint 3 Day 17: /uk-reits list + per-ticker pages`

---

## Day 18 — Methodology page

**Outcome.** `/methodology/income-vehicles` MDX page citable from every per-ticker page. Signal-by-signal definitions, family-specific gates, data-source attribution, worked example per family.

### Task 18.1 — `app/(public)/methodology/income-vehicles/page.mdx`

**Files.** `app/(public)/methodology/income-vehicles/page.mdx` (plus any necessary `mdx-components.tsx` extension if a new component is needed — likely not, the existing components cover headings/links/tables).

**Structure.**
1. Plain-English intro — what Resilience tries to measure, what it explicitly doesn't.
2. The four categories Q/D/C/R explained without jargon.
3. Per-family sections (anchors `#us-reits`, `#us-bdcs`, `#uk-reits`):
   - 8 signals each with definition + score banding (copy directly from each signal file's header comment).
   - Quality gates list.
   - Worked example: one anchor ticker, hand-calc of each signal vs the engine output (use the Day 12/13 spot-check numbers — O, MAIN, BLND.L).
4. Data sources — FMP for fundamentals + dividends, SEC EDGAR for US filing dates, the hand-classified `uk-reit-classification.json` for UK REITs.
5. Known limits — link to V1.1 calibration items from Sprint 2 Day 13 (Q_S1 banding, C_R1 single-bucket cascade, R_B1 noise, D_S1 directionality on tower REITs).
6. Disclaimer (mirror the per-ticker page disclaimer copy).

**Humaniser pass.** Before committing, run `npm run lint:humaniser` (per the memory entry on humaniser-mandatory) on the MDX content. Resolve every flagged pattern.

### Task 18.2 — Cross-link the methodology

Add the link to every per-ticker page footer (template) and the family list pages. Verify on `/reits/O`, `/bdcs/MAIN`, `/uk-reits/BLND.L` that the methodology link renders and goes to the right anchor.

### Day 18 end-of-day checklist

- [ ] MDX page committed; humaniser linter clean
- [ ] Methodology link verified on all three per-ticker pages via preview MCP
- [ ] Commit: `Phase 4 Sprint 3 Day 18: income-vehicles methodology page`

---

## Day 19 — Distinctive visual primitives

**Outcome.** Leverage gauge, Price/NAV sparkline, Q/D/C/R spider chart land as polished SVG components and replace the placeholders in the template. `color-expert` skill produces a 5-stop ramp the components bind to.

### Task 19.1 — `color-expert` ramp

Invoke the `color-expert` skill with a brief: "5-stop ramp from 'unsafe / cut risk' through 'healthy / resilient', for a dividend-investing audience, avoid the green/amber/red default that screams traffic-light." Get 5 hex codes + suggested CSS variable names. Commit them to `app/globals.css` as new CSS variables prefixed `--resilience-*` (keeps the existing chip-display tokens unchanged for the equity engine).

### Task 19.2 — `leverage-gauge.tsx`

**Files.** `app/(public)/_components/leverage-gauge.tsx` + `app/(public)/_components/__tests__/leverage-gauge.test.tsx`.

**Definition.** SVG semicircular gauge, `<svg viewBox="0 0 200 110">`. Props:

```ts
interface Props {
  mode: 'ffo-payout' | 'nii-coverage' | 'ltv';
  value: number;                  // raw metric value
  subSector?: string;             // LTV mode honours sector-aware cap
}
```

The component:
- Maps `value` to a 0–1 fraction along the gauge based on mode-specific thresholds (FFO 0–120%, NII 0.5–2.0×, LTV 0–80%).
- Picks a colour from the Day 19.1 ramp based on the mode-specific bands (FFO ≤ 80% green / 80–100% amber / > 100% red; NII ≥ 1.05 green / 0.95–1.05 amber / < 0.95 red; LTV mode honours `subSector` for the sector-aware cap).
- Renders the numeric value bold below the gauge.

**Tests.** Snapshot test per mode + branch coverage on the colour bands (≥ 6 tests).

### Task 19.3 — `price-nav-sparkline.tsx`

**Files.** Same pattern.

**Definition.** SVG sparkline with ±1σ shaded band. Reads `navHistory` (already on the template props) — `{ observed_at, price_nav_ratio }[]`. Computes mean + stdev across the window; renders the band as a translucent rectangle behind the line. Current point dot highlighted.

**Tests.** 1 happy-path snapshot + 1 "<60 observations" fallback rendering "insufficient history" + 1 "all null" empty state.

### Task 19.4 — `resilience-spider.tsx`

**Files.** Same pattern. Client component (`'use client'`).

**Definition.** SVG 4-axis radar. Props: `{ q, d, c, r }` (numbers 0–100). Renders the polygon + axis labels Q/D/C/R. For unauth users, fill with the family-average ramp colour; for Pro, the polygon is interactive on hover (tooltip with category aggregate value).

**Tests.** Snapshot test + axis-position calculation unit tests.

### Task 19.5 — Replace placeholders in `vehicle-page-template.tsx`

Replace the Day 14 placeholders with the polished components. Verify each family per-ticker page renders the gauge + sparkline + spider correctly via preview MCP. Take a screenshot per family for the commit message.

### Day 19 end-of-day checklist

- [ ] Three primitives committed with tests
- [ ] color-expert ramp tokens in globals.css
- [ ] Three family per-ticker screenshots in commit message
- [ ] `npx vitest run app/(public)/_components/__tests__/` green
- [ ] Commit: `Phase 4 Sprint 3 Day 19: leverage gauge + sparkline + spider chart`

---

## Day 20 — SEO + AEO pass

**Outcome.** JSON-LD `FinancialProduct` on every per-ticker page; per-family OG images; canonical URLs; sitemap entries; descriptive meta. `nextjs-seo-aeo-audit` skill clears the routes.

### Task 20.1 — JSON-LD helper

**Files.** `app/(public)/_components/jsonld-financial-product.tsx`.

**Definition.** Small server component that emits a `<script type="application/ld+json">` block with `@type: FinancialProduct`, `category: 'REIT' | 'BDC'`, `name`, `description`, `url`, `provider`, `disclaimer`. No `Rating` / `AggregateRating` — neutral, content-describing only (mirror the equity engine's stance from `app/(public)/scoring/[ticker]/page.tsx`).

Add to all three family per-ticker pages.

### Task 20.2 — Open Graph images

**Decision (start of day).** Two options:
- (a) Single `app/opengraph-image.tsx` shared across all family pages (cheaper, less distinctive).
- (b) Per-family `app/(public)/<slug>/opengraph-image.tsx` + per-ticker dynamic OG (more distinctive, more compute).

**Recommended:** (a) for V1 — ship velocity matters more than OG-image variety. Defer (b) to V1.1.

If (a), extend the existing `app/opengraph-image.tsx` to render the family heading + ticker symbol when route params include a vehicle context. If (b), follow the pattern from `app/blog/[slug]/opengraph-image.tsx`.

### Task 20.3 — Sitemap extension

Modify `app/sitemap.ts`. Add three family list entries (priority 0.8) + one per scored vehicle ticker (priority 0.6, `lastModified` from `vehicle_scores.computed_at`). Mirror the existing equity-scoring fan-out — use `Promise.all` to avoid serialising the family queries.

### Task 20.4 — `nextjs-seo-aeo-audit` skill

Invoke the skill. Review the report. Fix anything blocking — likely candidates:
- Missing `description` < 158 chars
- Missing canonical
- Heading hierarchy (h1 → h2 → h3 without skips)
- Image alt text on the gauge / sparkline / spider (each component needs an `aria-label`)

### Day 20 end-of-day checklist

- [ ] JSON-LD on every per-ticker page; manual view-source check
- [ ] OG images render for `/reits/O`, `/bdcs/MAIN`, `/uk-reits/BLND.L` via Vercel preview deploy
- [ ] Sitemap.xml contains all three family list URLs + per-ticker entries
- [ ] `nextjs-seo-aeo-audit` report attached to commit
- [ ] Commit: `Phase 4 Sprint 3 Day 20: SEO + AEO surface`

---

## Day 21 — Mobile + design-review + buffer

**Outcome.** Mobile responsive everywhere. `design-review` skill clears the four key routes. Any leftover Day 14–20 issues fixed.

### Task 21.1 — Mobile responsive

For each of `/reits`, `/reits/O`, `/bdcs`, `/bdcs/MAIN`, `/uk-reits`, `/uk-reits/BLND.L`:
1. `preview_resize` to 380×800 (iPhone SE bracket).
2. `preview_snapshot` — confirm the table doesn't overflow, the leverage gauge stays readable, the spider chart shrinks gracefully.
3. Fix any overflow / wrap issues. The list-page table should switch to a stacked card layout below `md:` breakpoint.

### Task 21.2 — `design-review` skill

Invoke `design-review` against `/reits/O`, `/bdcs/MAIN`, `/uk-reits/BLND.L`, and the methodology page. Apply every fix the skill proposes (it's an iterative fix loop — let it run to completion).

### Task 21.3 — Buffer

Any leftover gaps from Days 14–20. Common candidates:
- Lighthouse perf < 95 on any route (usually image optimisation or stray client component).
- Day 19 visual primitive contrast issue picked up by design-review.
- Day 20 OG image mismatched dimensions.

### Day 21 end-of-day

- [ ] All four key routes pass mobile spot-check
- [ ] design-review proposes no fresh issues on a re-run
- [ ] Sprint 3 PR rebased onto current main: `git rebase origin/main`
- [ ] PR opened: `gh pr create --base main --head phase-4/sprint-3 --title "Phase 4 Sprint 3 — Public Pages + Methodology"`
- [ ] PR body: Lighthouse desktop scores per route, screenshots per family, design-review pass note

---

## Sprint 3 Verify

```bash
# Three family routes reachable, each surfaces "Resilience"
for path in /reits/O /bdcs/MAIN /uk-reits/BLND.L; do
  curl -s "https://dividendmapper.com${path}" | grep -c "Resilience"
done
# expect: 1 per line (>=1 occurrence)

# Sitemap contains all three family list URLs
curl -s https://dividendmapper.com/sitemap.xml | grep -c -E "/(reits|bdcs|uk-reits)$"
# expect: 3

# Sitemap per-ticker entries
curl -s https://dividendmapper.com/sitemap.xml | grep -c -E "/(reits|bdcs|uk-reits)/[A-Z]+"
# expect: ~91 (matches Sprint 1 coverage matrix full+partial count)

# JSON-LD FinancialProduct on per-ticker pages
curl -s https://dividendmapper.com/reits/O | grep -c '"@type":"FinancialProduct"'
# expect: 1

# Methodology page reachable
curl -s -o /dev/null -w "%{http_code}" https://dividendmapper.com/methodology/income-vehicles
# expect: 200
```

```sql
-- Confirm the cron has been writing rows since Sprint 2 wrapped
select count(distinct ticker) from vehicle_scores;
-- expect: ~91

select max(computed_at) from vehicle_scores;
-- expect: within the last 24h
```

Lighthouse desktop (run from local preview):
```bash
for path in /reits /reits/O /bdcs /bdcs/MAIN /uk-reits /uk-reits/BLND.L /methodology/income-vehicles; do
  npx lighthouse "http://localhost:3000${path}" --only-categories=performance,seo --quiet --chrome-flags="--headless"
done
# expect: every route ≥95 perf, ≥95 SEO
```

---

## Carry-forward to Sprint 4

- App-integration drawer (`/app/portfolio/*`) consumes the same `vehicle_score_signals` rows on Day 23 — `vehicle-pro-detail.tsx` is reused as the drawer's per-vehicle breakdown panel.
- The 9 EDGAR-missing tickers' "data freshness" badge falls back to `—` per the methodology page's "Known limits" copy.
- The four CAL-3..6 V1.1 items deferred from Sprint 2 surface as caveats in the methodology page's "Known limits" section. Glenn may want to tackle CAL-3 (Q_S1 raw-sum) before Sprint 4 to clean up the O streak display.

## Deferred (NOT this sprint)

- **Per-ticker dynamic OG images** — V1.1.
- **Sub-sector landing pages** (`/reits/healthcare`, `/uk-reits/industrial`) — V1.1.
- **Comparison view** (side-by-side two tickers) — V1.1.
- **PostHog conversion tracking** — Sprint 4 Day 25 ships analytics + launch comms together.

## References

- Phase plan: [planning/08-phase-4-income-vehicle-scoring.md](../08-phase-4-income-vehicle-scoring.md)
- Sprint 2 shipped: [PR #19](https://github.com/grodgers1-ctrl/dividendmapper/pull/19), [planning/research/vehicle-scoring-spotcheck.md](../research/vehicle-scoring-spotcheck.md)
- Day-plan format reference: [planning/plans/2026-06-23-phase-4-sprint-2-days-6-13.md](2026-06-23-phase-4-sprint-2-days-6-13.md)
- Existing engine references — public score loader: `dividendmapper/lib/scoring/load-score.ts`; per-ticker page: `dividendmapper/app/(public)/scoring/[ticker]/page.tsx`; cookieless client: `dividendmapper/lib/supabase/public.ts`; sitemap pattern: `dividendmapper/app/sitemap.ts`
- Sprint 2 ingestion: `dividendmapper/lib/scoring/vehicle-fmp.ts`, `vehicle-persist.ts`, `compute-vehicle-score.ts`, `vehicle-quality-gates.ts`, `vehicle-assemble-inputs.ts`
