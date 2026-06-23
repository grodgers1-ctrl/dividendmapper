# Phase 4 — Income Vehicle Scoring (US REITs · US BDCs · UK REITs)

> **For agentic workers:** Phase-level plan, not a bite-sized TDD plan. Sprint-level day plans (matching `planning/plans/2026-05-29-phase-2.75-equity-scoring-days-2-9.md` style) get written at the start of each sprint. Steps below describe outcomes per sprint, not individual TDD cycles.

> **Supersedes:** `planning/08-phase-4-trust-solidity.md` (UK Investment Trust resource — deferred indefinitely; sponsor-IR scraping infra cost was the blocker). Archive or rename when this plan is approved.

**Goal:** Ship a single scoring engine + three indexable public surfaces — `/reits` (US), `/bdcs` (US), `/uk-reits` — covering ~100 of the most liquid income vehicles across the three families, on data Glenn already pays for (FMP Premium) plus free SEC EDGAR. Pro-tier gating on signal breakdowns; methodology page free. App integration: holdings table renders vehicle-typed chips alongside equity chips.

**Architecture:** Mirror the Phase 2.75 equity scoring engine. Single ingestion module (FMP + light EDGAR for filing dates), single unified schema (`vehicle_*` tables with a `vehicle_type` discriminator), three signal sets sharing one orchestrator (`compute-vehicle-score.ts`), three sibling public routes sharing one page template. Vehicle-type chip discriminator extends the holdings-table pattern already designed for the deferred trust plan.

**Tech stack:** Next 16 + React 19, Supabase (Postgres + RLS), Vercel Cron, FMP Premium (already paid, US + UK coverage), SEC EDGAR submissions/filings API (free, structured, no auth). No PDF parsing, no scrapers, no sponsor-portal fragility.

---

## Context

Original Phase 4 plan targeted UK Investment Trusts via 8 sponsor IR scrapers + factsheet/annual-report PDF parsing. The data-ingestion surface area (~16 brittle scrapers, ToS exposure, multi-year historical-data backfill gaps for D1/Q2/Q4) broke the "minimal infra cost" constraint in operational time, even if Vercel + Supabase bills stayed flat.

This plan targets the three vehicle families Glenn actually asked for (REITs + BDCs) plus UK REITs (FMP-covered, retains UK user-base relevance):

- **US Equity REITs** — ~50 most liquid by market cap (e.g. O, PLD, AMT, EQIX, WELL, SPG, EQR, AVB, EXR, VICI…). FFO/AFFO is the metric of art; FMP carries it.
- **US BDCs** — top ~25 by market cap; near-total coverage of the investable universe (e.g. ARCC, MAIN, OBDC, HTGC, OXSQ, PSEC…). Net Investment Income (NII) coverage of distribution is the metric of art; FMP carries NII and distribution, plus regulatory leverage cap is well-defined (Investment Company Act §61, 2:1 asset coverage post-SBCAA).
- **UK REITs** — top ~25 by market cap (BLND, LAND, SGRO, UNITE, LXI, PHP, GPE, DLN, BBOX, TRIT…). FMP LSE coverage already validated in Phase 2.75 (80% gate PASS). EPRA NAV is the canonical UK REIT metric but lives in interims/annuals; V1 uses book NAV from FMP, V1.1 adds EPRA.

## Timeline placement

Sequencing:

1. **Phase 3.5 quick wins first** (~2–3 weeks). Already-backlogged items per `state_2026-06-11_phase3.5_sprint1.md`. Out of scope of this plan.
2. **Phase 4: Income Vehicle Scoring** — this plan. **4.5 weeks** of focused engineering across four sprints, +0.5 week buffer = **5 weeks worst case**.
3. **Pre-flight (Phase 3.5 week 1, parallel):** FMP coverage probe for the three universes (script per `state_2026-05-29_eod_day1_phase2.75.md` pattern). Confirms no nasty gaps before Sprint 1 starts.

Total timeline from today (2026-06-19): launch in **week of 2026-08-03** (4-week sprints + buffer), or **2026-08-10** with 1 slip-week.

## V1 scope (locked decisions)

- **Universe (~100 tickers):**
  - Top 50 US equity REITs by market cap (covers all 12 GICS REIT sub-sectors: industrial, retail, residential, healthcare, office, data centres, hotels, self-storage, telecoms, speciality, diversified, mortgage)
  - Top 25 US BDCs by market cap (covers near-total liquid universe; below #25 liquidity falls off a cliff)
  - Top 25 UK REITs by market cap (split: ~10 generalist, ~15 specialist — industrial/residential/healthcare/student/social-housing)
  - Final list locked Sprint 1 Day 1 via FMP screener output QA'd by Glenn
- **Depth:** 8–10 signals per vehicle, four categories — Quality (Q), Discount (D), Concentration (C), Risk-flags (R) — composite **Resilience Score**, quality-gated. Signal taxonomy diverges by family (see below).
- **Public surface:** `/reits` (US list+screener), `/bdcs` (US list+screener), `/uk-reits` (UK list+screener), `/reits/[ticker]` + `/bdcs/[ticker]` + `/uk-reits/[ticker]` (per-vehicle resource pages, ISR `revalidate: 3600`), `/methodology/income-vehicles` (shared methodology page, signal-by-signal).
- **Pro gating:** methodology free; headline Resilience Score free on per-vehicle pages; signal breakdown + history + alerts Pro-only — matches existing `/scoring/[ticker]` pattern.
- **App integration:** holdings-table chip discriminates `vehicle_type` (equity / us_reit / us_bdc / uk_reit) and routes the score drawer to the right data API. Anchors vs Exposures view extends to surface vehicle-type buckets.
- **UI direction:** sexy data-rich, matches the visual direction from the trust plan — large numeric Resilience display, Q/D/C/R spider chart, leverage gauge, NAV-discount sparkline. Detail in §UI direction.

## Data sources — zero new infra cost

| Source | Coverage | Cost | Notes |
|---|---|---|---|
| **FMP Premium** (already paid) | US REITs financials, FFO/AFFO, dividends, ratios; US BDCs same; UK REITs LSE-listed | $0 marginal | Validated 2026-05-29; LSE coverage gate PASS |
| **SEC EDGAR submissions API** | Filing dates (10-K / 10-Q / 8-K), used for "last filed" + dividend-cut detection corroboration | Free, no auth | `data.sec.gov/submissions/CIK*.json` — structured JSON |
| **SEC EDGAR XBRL companyfacts** | Optional V1.1 supplement for FFO normalisation across REITs | Free | Use only if FMP FFO field shows >5% reconciliation error against sample 10-Ks |
| **`lib/scoring/data/uk-reit-classification.json`** | UK REIT property focus + geographic scope (C_U1, C_U2) | Free | ~25 hand-curated entries; FMP segmentation is empty for LSE-listed REITs (probe-confirmed 2026-06-19); refresh quarterly |

That's it. No scrapers, no PDF parsing, no sponsor portals, no ToS exposure.

**Historical backfill:** FMP gives 10y+ dividend history + 5y+ financials on all three universes at first ingestion. D1 Price/NAV needs only forward daily updates. Q2 Dividend Streak is computed from FMP's dividend table on Day 1. Q3/Q4 leverage signals computed from FMP's current financials snapshot. No "signals dark for 12 months" problem.

## Signal design (locked direction; thresholds tuned in Sprint 2)

Each signal returns `{ score: number | null, humanLabel: string }`; N/A signals cascade via the existing `redistribute-weights.ts` from `lib/scoring/`. Same shape as Phase 2.75 equity engine.

### Shared across all three families

| Code | Signal | Source | Cadence |
|---|---|---|---|
| Q_S1 | Dividend streak years (computed from FMP dividend history, special divs excluded) | FMP | Weekly |
| D_S1 | Price / NAV (book NAV per share, FMP-reported) | FMP daily price + quarterly NAV | Daily |
| R_S1 | Dividend cut in last 5y (FMP dividend history, excludes BDC supplementals) | FMP | Weekly |

### US Equity REIT — Q_R / C_R / R_R suffix

| Code | Signal | Source | Cadence |
|---|---|---|---|
| Q_R1 | FFO payout ratio (DPS ÷ FFO per share) — quality-gated | FMP | Quarterly |
| Q_R2 | Net Debt / EBITDA | FMP | Quarterly |
| C_R1 | Property-type concentration (Herfindahl-Hirschman Index of segment revenue from FMP) | FMP | Quarterly |
| C_R2 | Geographic concentration (HHI of segment revenue where reported; N/A cascades when not segmented) | FMP | Quarterly |
| R_R1 | Interest coverage (EBITDA ÷ Interest Expense) flag at < 2.5× | FMP | Quarterly |

### US BDC — Q_B / C_B / R_B suffix

| Code | Signal | Source | Cadence |
|---|---|---|---|
| Q_B1 | NII coverage of distribution (NII per share ÷ regular dividend per share) — quality-gated | FMP | Quarterly |
| Q_B2 | NAV/share 3y trend (slope of quarterly NAV — flat or up is healthy) | FMP | Quarterly |
| C_B1 | Statutory leverage proximity (Debt/Equity vs 2:1 cap; warning >1.5×) | FMP | Quarterly |
| R_B1 | Portfolio yield drift (3y trailing change in interest income yield — sharp jumps signal credit deterioration / non-accrual masking) | FMP | Quarterly |
| R_B2 | Distribution composition (regular vs special) — flag if special > regular for last 2y (typical pre-cut pattern) | FMP | Weekly |

### UK REIT — Q_U / C_U / R_U suffix

| Code | Signal | Source | Cadence |
|---|---|---|---|
| Q_U1 | EPRA earnings cover (use net rental income ÷ dividends until V1.1 swaps in EPRA earnings per share) | FMP | Semi-annual |
| Q_U2 | Loan-to-Value (LTV) ratio — canonical UK REIT leverage signal | FMP | Semi-annual |
| C_U1 | Property-type focus (binary: diversified vs specialist) — sourced from maintained classification list | `lib/scoring/data/uk-reit-classification.json` | Static (manual) |
| C_U2 | Geographic scope (binary: UK-only vs overseas-exposed) — sourced from maintained classification list | `lib/scoring/data/uk-reit-classification.json` | Static (manual) |
| R_U1 | Interest coverage at < 2.0× (UK REITs typically lower-geared than US peers; tighter threshold) | FMP | Semi-annual |

> **Why a classification file instead of FMP segmentation:** the pre-flight probe (`fmp-vehicle-coverage-matrix.md`, generated 2026-06-19) confirmed FMP's `revenue-product-segmentation` and `revenue-geographic-segmentation` endpoints are **universally empty for LSE-listed REITs** (US REITs have full coverage). Top 25 UK REITs is a small, slow-changing list — a hand-maintained JSON checked into the repo costs nothing operationally and lets these signals exist instead of cascading to N/A on every UK ticker. The signals lose HHI precision (binary instead of continuous) but stay meaningful for the diversified-vs-specialist and domestic-vs-international cuts that actually move resilience.

### Quality gates (must-pass before signal composite resolves to a score)

- **G_R1 (REIT):** FFO payout ratio ≤ 100% (paying out more than FFO is structural risk)
- **G_R2 (REIT):** No dividend cut in last 5y
- **G_B1 (BDC):** NII coverage ≥ 0.95 (slight under-earn permitted)
- **G_B2 (BDC):** No regular-distribution cut in last 5y (special-distribution variation does not count)
- **G_U1 (UK REIT):** LTV ≤ 50% (sector-aware: industrial REITs ≤ 40%, healthcare/social ≤ 60%)
- **G_U2 (UK REIT):** No dividend cut in last 5y

Composite **Resilience Score** = quality-gated weighted average of Q/D/C/R categories. R signals are sign-inverted. Same `computeCategoryAggregate()` from `lib/scoring/redistribute-weights.ts` reused unchanged.

## V1 cuts (deliberately deferred to V1.1)

These are real signals; each was cut because it breaks the FMP-only constraint:

1. **BDC non-accrual %** — lives in 10-Q portfolio-supplement schedules; structured but tedious to parse. V1.1.
2. **UK REIT EPRA NAV** — canonical UK metric; V1 uses book NAV. V1.1 parses interim/annual statements for EPRA.
3. **REIT debt-maturity wall** — needs year-by-year debt schedule from 10-K; FMP gives aggregates only. V1.1.
4. **AFFO normalisation across REITs** — V1 trusts FMP's as-reported FFO/AFFO. V1.1 reconciles against XBRL companyfacts.

## Critical files

### Net-new

- `dividendmapper/supabase/migrations/0014_vehicle_scoring.sql` — see schema below
- `dividendmapper/lib/scoring/signals/vehicle-shared-{streak,price-nav,cut}.ts` (3 files)
- `dividendmapper/lib/scoring/signals/vehicle-reit-{ffo-payout,debt-ebitda,property-hhi,geo-hhi,int-cov}.ts` (5 files)
- `dividendmapper/lib/scoring/signals/vehicle-bdc-{nii-cov,nav-trend,leverage,yield-drift,special-mix}.ts` (5 files)
- `dividendmapper/lib/scoring/signals/vehicle-uk-{epra-cover,ltv,property-focus,geo-scope,int-cov}.ts` (5 files)
- `dividendmapper/lib/scoring/data/uk-reit-classification.json` — static `{ ticker → { propertyType: 'diversified'|'industrial'|'healthcare'|…, geographicScope: 'uk_only'|'overseas_exposed' } }` for top 25 UK REITs; replaces FMP segmentation
- `dividendmapper/lib/scoring/compute-vehicle-score.ts` — orchestrator, dispatches by `vehicle_type`, mirrors `compute-buy-score.ts`
- `dividendmapper/lib/scoring/vehicle-quality-gates.ts` — gate registry by vehicle_type
- `dividendmapper/lib/scoring/vehicle-assemble-inputs.ts` — adapter, raw FMP rows → signal inputs
- `dividendmapper/lib/ingestion/vehicle-fmp.ts` — single FMP ingest module, handles all three universes
- `dividendmapper/lib/ingestion/vehicle-edgar.ts` — light EDGAR client, filing dates only
- `dividendmapper/lib/ingestion/vehicle-universe.ts` — universe seed + maintenance (delisting, ticker changes)
- `dividendmapper/app/api/internal/refresh-vehicle-fundamentals/route.ts` — weekly FMP refresh cron
- `dividendmapper/app/api/internal/refresh-vehicle-prices/route.ts` — daily price + Price/NAV recompute
- `dividendmapper/app/api/internal/refresh-vehicle-scores/route.ts` — daily scoring cron (after prices)
- `dividendmapper/app/api/scoring/vehicle/[ticker]/route.ts` — per-vehicle data API
- `dividendmapper/app/api/scoring/vehicle/route.ts` — list/screener data API (accepts `?family=us_reit|us_bdc|uk_reit`)
- `dividendmapper/app/reits/page.tsx` — US REIT list+screener
- `dividendmapper/app/reits/[ticker]/page.tsx` — per-REIT resource (ISR)
- `dividendmapper/app/bdcs/page.tsx` — BDC list+screener
- `dividendmapper/app/bdcs/[ticker]/page.tsx` — per-BDC resource (ISR)
- `dividendmapper/app/uk-reits/page.tsx` — UK REIT list+screener
- `dividendmapper/app/uk-reits/[ticker]/page.tsx` — per-UK-REIT resource (ISR)
- `dividendmapper/app/methodology/income-vehicles/page.mdx` — shared methodology
- `dividendmapper/app/(public)/_components/resilience-display.tsx` — large numeric headline (shared across families)
- `dividendmapper/app/(public)/_components/leverage-gauge.tsx` — semicircular gauge (FFO-payout for REITs, NII-cov for BDCs, LTV for UK REITs — parameterised)
- `dividendmapper/app/(public)/_components/price-nav-sparkline.tsx` — 5y line + Z-band
- `dividendmapper/app/(public)/_components/vehicle-signal-spider.tsx` — Q/D/C/R radar
- `dividendmapper/planning/plans/2026-mm-dd-phase4-sprint{1,2,3,4}-*.md` — sprint-level day plans, written at each sprint start

### Modified

- `dividendmapper/lib/scoring/redistribute-weights.ts` — verify generic enough for vehicle signals (likely zero changes; `SignalWeight[]` already vehicle-agnostic)
- `dividendmapper/app/app/portfolio/_components/holdings-table.tsx` — extend vehicle-type discriminator → render `<VehicleChip />` for REIT/BDC/UK-REIT tickers
- `dividendmapper/app/app/portfolio/_components/score-drawer.tsx` — accept `vehicleType` prop, fetch from `/api/scoring/vehicle/[ticker]` when not `equity`
- `dividendmapper/vercel.json` — add 3 new cron schedules (vehicle-prices, vehicle-fundamentals, vehicle-scores)
- `dividendmapper/lib/scoring/chip-display.ts` — extend colour mapping for Resilience composite (single number, not buy/trim/risk triplet)

### Reused (no changes)

- `lib/scoring/redistribute-weights.ts` — N/A cascade + category aggregation
- Cron auth + Sentry pattern from `app/api/internal/refresh-equity-scores/route.ts`
- Public page ISR + cookieless-client pattern from `app/scoring/[ticker]/page.tsx`
- Anonymous rate-limit (60/hr/IP) from public scoring pages launch

## Database schema (migration 0014)

```sql
-- Unified universe with vehicle-type discriminator
create table vehicle_universe (
  ticker text primary key,
  vehicle_type text not null check (vehicle_type in ('us_reit', 'us_bdc', 'uk_reit')),
  display_name text not null,
  exchange text not null, -- 'NYSE' / 'NASDAQ' / 'LSE'
  currency text not null, -- 'USD' / 'GBP' / 'GBX'
  sub_sector text, -- 'industrial' / 'healthcare' / 'data_centre' / 'business_development' etc.
  cik text, -- SEC CIK for US tickers; null for UK
  market_cap_at_seed numeric,
  status text not null default 'active', -- active / delisted / acquired
  successor_ticker text,
  included_in_v1 boolean not null default true,
  added_at timestamptz not null default now(),
  notes text
);
create index on vehicle_universe(vehicle_type) where included_in_v1;

-- Per-period fundamentals snapshot (quarterly for US, semi-annual for UK)
create table vehicle_fundamentals (
  id bigserial primary key,
  ticker text not null references vehicle_universe(ticker),
  period_end date not null,
  period_type text not null, -- 'quarterly' / 'semi_annual' / 'annual'
  ffo_per_share numeric,         -- REIT only
  affo_per_share numeric,        -- REIT only
  nii_per_share numeric,         -- BDC only
  nav_per_share numeric,         -- all
  debt_total numeric,
  equity_total numeric,
  ebitda numeric,
  interest_expense numeric,
  ltv_pct numeric,               -- UK REIT only (FMP-derived)
  property_segment_hhi numeric,
  geo_segment_hhi numeric,
  tenant_concentration_hhi numeric, -- UK REIT only when reported
  source text not null default 'fmp',
  source_url text,
  observed_at timestamptz not null default now(),
  unique(ticker, period_end, period_type)
);
create index on vehicle_fundamentals(ticker, period_end desc);

-- Daily price snapshot (cached for Price/NAV signal)
create table vehicle_prices (
  id bigserial primary key,
  ticker text not null references vehicle_universe(ticker),
  observed_at date not null,
  close_price numeric not null,
  source text not null default 'fmp',
  unique(ticker, observed_at)
);

-- Computed scores (mirrors equity_scores)
create table vehicle_scores (
  ticker text primary key references vehicle_universe(ticker),
  vehicle_type text not null,
  resilience_score numeric, -- 0-100, null if gate fails
  quality_gate_passed boolean not null default false,
  failed_gates text[],
  data_quality text not null default 'full', -- full / partial / sparse
  computed_at timestamptz not null default now()
);
create index on vehicle_scores(vehicle_type, resilience_score desc nulls last);

-- Per-signal breakdown (mirrors equity_score_signals)
create table vehicle_score_signals (
  id bigserial primary key,
  ticker text not null references vehicle_universe(ticker),
  signal_code text not null, -- 'Q_S1' .. 'R_U1'
  raw_score numeric,
  weight numeric,
  contribution numeric,
  human_label text,
  observed_at timestamptz not null default now()
);
create index on vehicle_score_signals(ticker, observed_at desc);

-- Daily history snapshot (mirrors equity_score_history)
create table vehicle_score_history (
  id bigserial primary key,
  ticker text not null references vehicle_universe(ticker),
  observed_at date not null,
  resilience_score numeric,
  price_nav_ratio numeric,
  unique(ticker, observed_at)
);

-- RLS: public read, service-role write (matches equity_scores pattern)
alter table vehicle_universe enable row level security;
alter table vehicle_fundamentals enable row level security;
alter table vehicle_prices enable row level security;
alter table vehicle_scores enable row level security;
alter table vehicle_score_signals enable row level security;
alter table vehicle_score_history enable row level security;

create policy "public read" on vehicle_universe for select using (true);
create policy "public read" on vehicle_fundamentals for select using (true);
create policy "public read" on vehicle_prices for select using (true);
create policy "public read" on vehicle_scores for select using (true);
create policy "public read" on vehicle_score_signals for select using (true);
create policy "public read" on vehicle_score_history for select using (true);
```

## Sprint breakdown

Each sprint produces independently shippable / verifiable output. Sprint-level day plans written at sprint start.

### Sprint 1 — Foundations + Ingestion (5 working days, 1 week)

**Outcome:** ~100-ticker universe seeded across three families; FMP fundamentals + price ingestion runs end-to-end; EDGAR client returns filing dates for US tickers. Data visible in Supabase, no scoring yet.

- **Day 1:** Universe lock — FMP screener output by market cap for each family; Glenn QA against current major-name list; apply migration 0014; seed `vehicle_universe`. Also seed `lib/scoring/data/uk-reit-classification.json` with `{ propertyType, geographicScope }` for the locked top 25 UK REITs (manual; ~30 min).
- **Day 2:** `vehicle-fmp.ts` ingestion module — TDD against 3–5 sample tickers per family. Covers fundamentals + daily prices. Currency normalisation (GBX→GBP for UK REITs).
- **Day 3:** Daily price cron at 08:00 UTC + initial backfill (10y prices, 5y fundamentals for all V1 tickers). Verify count thresholds.
- **Day 4:** Weekly fundamentals cron (Sunday 02:00 UTC) + EDGAR filing-dates client (`vehicle-edgar.ts`).
- **Day 5:** Coverage dry-run — emit matrix of `(ticker, fields populated, fields null)`. Target: ≥95 of ~100 tickers with full data; ≤5 with partial. Tag partial tickers `data_quality='partial'` in `vehicle_universe`.

**Verify Sprint 1:**
```sql
select vehicle_type, count(*) from vehicle_fundamentals
where period_end >= current_date - interval '120 days'
group by vehicle_type;
-- expect: us_reit ~50, us_bdc ~25, uk_reit ~25
```

### Sprint 2 — Scoring Engine (8 working days, ~1.5 weeks)

**Outcome:** Resilience Score computed daily for all V1 vehicles. Per-signal breakdown persisted. Quality gates enforced. Tested end-to-end.

- **Day 6:** Shared signal trio (Q_S1 streak, D_S1 Price/NAV, R_S1 cut) + signal interface conventions. TDD per Phase 2.75 pattern.
- **Day 7:** US REIT signals Q_R1, Q_R2, C_R1, C_R2, R_R1.
- **Day 8:** US BDC signals Q_B1, Q_B2, C_B1, R_B1, R_B2. Statutory-leverage logic and special-vs-regular distribution detection are the two nuanced pieces here.
- **Day 9:** UK REIT signals Q_U1, Q_U2, C_U1, C_U2, R_U1. LTV is the key UK-specific computation.
- **Day 10:** `compute-vehicle-score.ts` orchestrator + family-aware quality gates + composite Resilience Score. Threshold sanity-check: well-known anchors (O, MAIN, BLND) should clear; obvious distressed names should fail gates.
- **Day 11:** Daily scoring cron 09:00 UTC (after prices). Persist to `vehicle_scores` + `vehicle_score_signals` + `vehicle_score_history`.
- **Day 12:** End-to-end run + spot-check 10 vehicles (2–4 per family) vs hand calculations.
- **Day 13:** Buffer / signal calibration based on Day 12 output.

**Verify Sprint 2:**
```sql
select vehicle_type, count(*) filter (where resilience_score is not null) as scored,
       count(*) filter (where resilience_score is null) as gate_failed
from vehicle_scores group by vehicle_type;
-- expect majority scored per family; gate-failed list should be defensible
```

### Sprint 3 — Public Pages + Methodology (8 working days, ~1.5 weeks)

**Outcome:** `/reits`, `/bdcs`, `/uk-reits` and per-ticker pages live and indexable; shared methodology page citable; distinctive visuals; mobile responsive.

- **Day 14:** Per-vehicle template (`_components/vehicle-page-template.tsx`) — server-component ISR (`revalidate: 3600`). Headline Resilience display + signal breakdown (Pro-gated) + leverage gauge + Price/NAV sparkline.
- **Day 15:** `/reits/page.tsx` + `/reits/[ticker]/page.tsx` wired against template. Sort by Resilience, filter by sub-sector, free-text search.
- **Day 16:** `/bdcs/page.tsx` + `/bdcs/[ticker]/page.tsx`. BDC list defaults to "include yield" sort since yield is the consumer hook here.
- **Day 17:** `/uk-reits/page.tsx` + `/uk-reits/[ticker]/page.tsx`. Sterling formatting; GBX → GBP normalisation in display.
- **Day 18:** `/methodology/income-vehicles/page.mdx` — shared methodology, signal-by-signal definitions, family-specific quality gates, data-source attribution, worked example per family.
- **Day 19:** Distinctive visual primitives polished (leverage gauge parameterisation for each family, sparkline Z-band, spider chart).
- **Day 20:** SEO + AEO pass — JSON-LD `FinancialProduct` per page, dynamic OG images, canonical URLs, sitemap entries, descriptive meta. Invoke `nextjs-seo-aeo-audit` skill.
- **Day 21:** Mobile responsiveness + design-review skill pass. Buffer for fixes.

**Verify Sprint 3:**
```bash
curl -s https://dividendmapper.com/reits/O | grep -c "Resilience"   # >=1
curl -s https://dividendmapper.com/bdcs/MAIN | grep -c "Resilience" # >=1
curl -s https://dividendmapper.com/uk-reits/BLND.L | grep -c "Resilience" # >=1
```
Lighthouse desktop ≥95 perf / ≥95 SEO on each route; unauth view renders score, breakdown gated.

### Sprint 4 — App Integration + Launch (4 working days, ~1 week)

**Outcome:** Vehicle-typed holdings show Resilience chips in user portfolios; Anchors vs Exposures view extended; founding-member launch comms sent; monitoring live.

- **Day 22:** Extend `holdings-table.tsx` vehicle-type discriminator. Lookup `vehicle_type` from `vehicle_universe`; render `<VehicleChip>` for matched tickers.
- **Day 23:** Extend `score-drawer.tsx` to fetch from `/api/scoring/vehicle/[ticker]` when vehicle-typed. Drawer surfaces Q/D/C/R breakdown.
- **Day 24:** Anchors vs Exposures portfolio view — group equities + REITs/BDCs into resilience map. "Income from anchors: £X/mo; income from exposures: £Y/mo." Seed Glenn's own portfolio with 3–4 reps (O, MAIN, BLND.L) for live QA.
- **Day 25:** Founding-member email via existing Resend stack; public launch comms (humaniser-cleared); production smoke (synthetic Pro + unauth view, Sentry, daily crons logged ≥3 successful runs, PostHog firing on per-vehicle pages).

**Verify Sprint 4:** Glenn logs into `/app`, sees a REIT holding with Resilience chip, clicks → drawer opens with Q/D/C/R breakdown, "View on /reits/O" link works.

## UI design direction — "sexy"

Reference points (orientation, not aesthetic copies): Sharesight, Linear, Stripe Dashboard, Lightyear / Trading 212 app. Avoid Seeking Alpha / Hoya Capital UK-financial-services-default aesthetic.

Distinctive primitives:

1. **Resilience number** — large (96px+), bold, mono-numeral, secondary "Anchor · Resilient" badge, trend arrow.
2. **Leverage gauge** — semicircular gauge, parameterised:
   - REIT: FFO payout ratio (green ≤ 80% / amber 80–100% / red > 100%)
   - BDC: NII coverage (green ≥ 1.05 / amber 0.95–1.05 / red < 0.95)
   - UK REIT: LTV (green ≤ 30% / amber 30–45% / red > 45%; sector-aware)
3. **Price/NAV sparkline with Z-band** — 5y line + ±1σ shaded band.
4. **Q/D/C/R spider chart** — 4-axis radar; Pro-only detail.
5. **Family-sector tile grid** — small per-sub-sector blocks on family list pages; SEO landing surface.

Colour: invoke `color-expert` skill in Sprint 3 Day 19 for a 5-stop ramp rather than vanilla green/amber/red.

Typography: mono-numeral for scores; sans-serif for body; generous line-height.

## Verification — end-to-end

After Sprint 4:

1. **Live page audit per family:** open `https://dividendmapper.com/reits/O`, `/bdcs/MAIN`, `/uk-reits/BLND.L` unauthenticated. Confirm: Resilience visible, methodology link visible, signal categories present but breakdown gated, OG image renders correctly. Run `nextjs-seo-aeo-audit`.
2. **Authenticated Pro audit:** log in as Pro, same URLs. Confirm full breakdown visible.
3. **App integration:** `/app` with REIT + BDC + UK REIT holdings seeded. Confirm chips render + drawer routes to vehicle API.
4. **Cron audit:**
   ```sql
   select max(observed_at) from vehicle_prices;            -- expect today
   select count(*) from vehicle_scores
   where computed_at::date = current_date;                 -- expect ~95
   ```
5. **AEO citation test:** ask ChatGPT and Perplexity "is Realty Income's dividend safe?" / "what's the most resilient UK REIT?" — confirm DM pages cited within 4 weeks of launch.
6. **PostHog conversion smoke:** track unauth → Pro conversion from each family's per-ticker page over first 30 days.

## Open questions — before Sprint 1 Day 1

1. **FMP REIT/BDC field coverage probe** — ✅ **DONE 2026-06-19** (`scripts/scoring/fmp-vehicle-coverage-matrix.js` → `planning/research/fmp-vehicle-coverage-matrix.md`). All three families PASS the 80% gate: us_reit 98.1%, us_bdc 100%, uk_reit 81.8%. All 6 signal-critical field spot-checks present (FFO components, BDC NII, UK LTV inputs). One real finding: FMP `revenue-product-segmentation` and `revenue-geographic-segmentation` are universally empty for LSE-listed REITs — handled by replacing C_U1/C_U2 with a maintained classification JSON (see §Signal design and §Critical files).
2. **Universe lock** — top-N market-cap cutoff is straightforward but Glenn should sanity-check the lists (does the BDC list include MAIN, ARCC, OBDC, HTGC? does the UK REIT list include the major specialist REITs?).
3. **Pro-tier copy** — "upgrade to see full breakdown" CTA on per-vehicle pages: match existing `/scoring/[ticker]` or differentiate? Probably match.
4. **Holdings seeding for QA** — Glenn add 3–4 vehicle holdings (O, MAIN, BLND.L, SGRO.L) before Sprint 4.
5. **Score naming** — "Resilience Score" is consistent with the equity engine vocabulary already used in app copy. If Glenn prefers "Solidity" (from the deferred trust plan) or another label, decide before Sprint 3 Day 14 (template writes the headline).

## What this plan deliberately does NOT cover

- **UK Investment Trusts** — original Phase 4 target; deferred indefinitely (data sourcing too expensive in eng-time). Revisit if Ticker.app Professional licensing becomes viable post-MRR.
- **Mortgage REITs as a separate family** — included within top-50 US REITs by market cap, not split out as a sub-resource. AGNC, NLY etc. score against the same REIT signal set; their FFO mechanics differ but the gates fail correctly when payout exceeds earnings, which is the V1 quality bar.
- **B2B API productisation** — JSON endpoints are publicly available as a side-effect of public pages, but no sales motion, contracts, or SLA. Revisit if ≥3 inbound enquiries land in 6 months post-launch.
- **EPRA NAV / BDC non-accrual % / REIT debt-maturity wall / AFFO normalisation** — see §V1 cuts.

## References

- Existing equity scoring engine pattern: `dividendmapper/lib/scoring/compute-buy-score.ts`, `dividendmapper/lib/scoring/signals/`, `dividendmapper/lib/scoring/redistribute-weights.ts`, `dividendmapper/app/api/internal/refresh-equity-scores/route.ts`, `dividendmapper/app/api/scoring/[ticker]/route.ts`
- Existing public scoring pages pattern: shipped 2026-06-02 (see `state_2026-06-02_eod_public_scoring_pages.md`)
- Plan-doc convention: `planning/06-equity-scoring.md` (phase spec), `planning/plans/2026-05-29-phase-2.75-equity-scoring-days-2-9.md` (sprint plan)
- FMP API docs: `https://site.financialmodelingprep.com/developer/docs` — endpoints used here: `/api/v3/profile`, `/api/v3/income-statement`, `/api/v3/balance-sheet-statement`, `/api/v3/historical-price-full`, `/api/v3/historical-dividend`
- SEC EDGAR submissions API: `https://data.sec.gov/submissions/CIK{10-digit-zero-padded}.json` — no auth, JSON, rate-limit 10 req/sec
- Superseded plan: `planning/08-phase-4-trust-solidity.md` (UK Investment Trust resource — defer/archive)
