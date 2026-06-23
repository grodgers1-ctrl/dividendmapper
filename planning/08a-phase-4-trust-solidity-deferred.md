# Phase 4 — UK Investment Trust Solidity Resource

> **For agentic workers:** This is a phase-level plan, not a bite-sized TDD plan. Sprint-level day plans (matching `planning/plans/2026-05-29-phase-2.75-equity-scoring-days-2-9.md` style) get written at the start of each sprint. Steps below describe outcomes per sprint, not individual TDD cycles.

**Goal:** Ship a standalone UK investment trust info & scoring resource — public per-trust pages with full methodology transparency, covering the top 50 trusts by AUM, on public-data sources only, sexy data-rich UI. Pro-tier gating on signal breakdowns; methodology page free.

**Architecture:** Mirror the existing Phase 2.75 equity scoring engine. New tables (migration 0010), new signal modules in `lib/scoring/signals/trust-*`, new ingestion crons for RNS + sponsor portals + annual reports, new public pages under `/trusts/*` following the `/scoring/[ticker]` pattern shipped 2026-06-02. App integration via a vehicle-type discriminator on the holdings table chip.

**Tech stack:** Next 16 + React 19, Supabase (Postgres + RLS), Vercel Cron, FMP Premium (already paid), per-sponsor IR scraping for both RNS announcements + monthly factsheets (zero new infra cost), `pdf-parse` or `unpdf` for factsheet PDFs.

---

## Context

Glenn's refined vision (post-research): standalone UK trust resource modelled on ETF-scoring competitors (ETF.com, ETFdb, Trackinsight), public-data only, no AIC licence dependency, sexy UI, top 50 trusts by AUM. The thesis is that Kepler/Citywire/QuotedData score performance not durability, AIC publishes Dividend Heroes (streak) but no per-trust solidity score, and the gap at UK retail price (£5/mo Pro) is unclaimed.

Research file rev 1+2 (at `~/.claude/plans/c-users-grodg-downloads-closed-end-engi-serialized-whisper-agent-*.md`) captured the competitive scan; this plan is the build sequel.

## Timeline placement

Sequencing:

1. **Phase 3.5 quick wins first** (~2–3 weeks). Already-backlogged user-asked items: CSV import, watchlist UI, reinvest alert, special-div exclusion, quote.ts Polygon→FMP migration. Low risk, keeps founding-member engagement up while the trust build ramps. Detailed in `planning/` already; not in scope of this plan.

2. **Phase 4: Trust Solidity Resource** — this plan. ~6.5–7 weeks of focused engineering, four sprints (see breakdown below).

3. **Parallel during Phase 3.5:** book the LSEG RNS Data Feed sales call (week 1 of Phase 3.5) AND verify free public alternatives (LSE public news, per-sponsor IR feeds). Need a prod RNS path locked before sprint 1 of Phase 4.

Total timeline from today (2026-06-09): launch in **week of 2026-08-17** with a buffer week, or **2026-08-10** if sprints run tight.

## V1 scope (locked decisions)

- **Universe:** top ~40 UK investment trusts by net assets — specifically the subset of the top 50 covered by the top 8 sponsors (Janus Henderson, JPMAM, BlackRock, abrdn, Baillie Gifford, Columbia Threadneedle, Polar Capital, Allianz GI / Invesco). Constrained by zero-cost data sourcing: only sponsor IR pages (free, first-party, ToS-permissive) are used for V1 RNS + factsheet ingestion. The ~10 trusts dropped from the top 50 are smaller-AUM and from sponsors not in the top 8 — revisit in V1.1 / V2 when MRR supports a licensed feed (e.g. Ticker Pro). Corporate-action edits: WTAN merged into ALW, DGI9 winding down, TRIG transferring to HICL — drop or flag accordingly. Final list needs QA against the AIC monthly Sector Sizes XLSX before sprint 1 day 1.
- **Depth:** 9–11 signals per trust across four categories (Quality / Discount / Concentration / Risk-flags), composite Solidity Score, quality-gated.
- **Public surface:** `/trusts` (list + screener), `/trusts/[ticker]` (per-trust resource page), `/trusts/methodology` (signal definitions + data sources), `/trusts/sectors/[sector]` (SEO bonus, per AIC sector). All ISR with `revalidate: 3600`.
- **Pro gating:** methodology page free; headline solidity score free on per-trust pages; full signal breakdown + history + alerts Pro-only — matches existing equity pattern.
- **App integration:** holdings-table chip for trust tickers; Anchors vs Exposures split surfaces trusts alongside equities in unified portfolio resilience view.
- **UI direction:** sexy data-rich. Distinctive visual primitives: fuel-gauge for reserve runway, sparkline for NAV discount over 5y, spider chart for signal categories, large numeric solidity display. Reference points: Sharesight, Linear, Stripe Dashboard — not Kepler/QuotedData (staid).

## RNS source — V1 zero-cost decision

V1 launches at zero data-feed cost. The only viable free-and-legal-clean path is **per-sponsor IR scraping**: extend the 8 sponsor scrapers we're already building for monthly factsheets to also fetch NAV / dividend / corporate-action RNS announcements from the same sponsor IR pages.

**Why this works:**
- Sponsor IR pages are first-party sites designed to be consumed by investors and journalists
- ToS on sponsor IR pages is typically permissive for polite scraping (verify per-sponsor in sprint 1 day 0)
- Top 8 sponsors cover ~40 of top 50 trusts (Janus Henderson, JPMAM, BlackRock, abrdn, Baillie Gifford, Columbia Threadneedle, Polar Capital, Allianz GI / Invesco)
- Same scraper infrastructure handles both fundamentals (factsheet PDFs) and announcements (RNS list pages) — no marginal infra cost beyond the factsheet work already planned
- Single legal posture (first-party only) — methodology page reads cleanly

**V1 trade-off accepted:** universe shrinks to ~40 trusts. The dropped ~10 are smaller-AUM trusts from sponsors outside the top 8; marketing "Top 40 UK trusts" reads identically to "Top 50".

**Time-to-data caveat:** sponsor IR pages publish within minutes-to-hours of RNS, not real-time. Solidity scoring is not real-time-sensitive so this doesn't matter for V1. Future dividend-cut alert features may want a licensed feed.

### Sources ruled out for V1

| Source | Why not for V1 |
|---|---|
| Ticker.app Free/Lite/Advanced/Ultimate | Personal-use only per their pricing page — explicitly forbids commercial / SaaS use |
| Ticker.app Professional (Startup/Business/Issuer/Enterprise) | Likely £100-400/mo — postponed to V2 / post-MRR upgrade |
| LSEG RNS Data Feed | Likely £500-£5,000/mo — postponed indefinitely |
| LSE public news pages (`londonstockexchange.com/news`) | Grey zone, ToS technically restricts scraping. Avoid for clean legal posture. |
| Investegate | ToS forbids commercial redistribution |
| AIC company pages | Off-table per Glenn (AIC redistribution clause) |

### Upgrade path (V2, post-MRR)

When DM crosses ~£300-500/mo MRR, evaluate Ticker.app Professional. Likely £100-400/mo. Benefits: adds the missing ~10 trusts to reach the full top 50, replaces 8 sponsor scrapers with 1 licensed API client, cleaner long-term posture, supports future real-time alert features. Email `support@ticker.app` for Startup-tier Pro pricing when the time comes.

### Sprint 1 day 0 verification (cheap, before sprint commits)

- Read top-8 sponsor IR pages' robots.txt and ToS — flag any with restrictive scraping clauses
- Confirm RNS announcement archive exists on each sponsor IR page going back ≥2 years (need for dividend-streak signal Q2)
- Identify URL patterns for NAV / dividend / corporate-action announcements per sponsor — heterogeneous formats expected

## Signal design (locked direction; thresholds tuned in sprint 2)

Mirrors Phase 2.75 pattern in `lib/scoring/signals/`. Each signal returns `{ score: number | null, humanLabel: string }`; N/A signals cascade via `redistribute-weights.ts`.

### Quality (Q) — durability of the income stream

| Code | Signal | Source | Cadence |
|---|---|---|---|
| Q1 | Revenue reserve cover (years of dividends from reserves) | Annual report | Annual |
| Q2 | Dividend streak years (recomputed from RNS dividend history) | RNS | Daily refresh |
| Q3 | Distribution coverage (revenue earnings ÷ dividends paid) | Annual & interim reports | Semi-annual |
| Q4 | Ongoing charges % vs AIC sector median | Monthly factsheet | Monthly |

### Discount (D) — pricing context

| Code | Signal | Source | Cadence |
|---|---|---|---|
| D1 | NAV discount/premium vs 5-yr Z-score | Daily NAV (RNS) + price | Daily |
| D2 | Discount-control mechanism flag (buyback / tender / continuation vote last 3y) | Annual report | Annual |

### Concentration (C) — diversification risk

| Code | Signal | Source | Cadence |
|---|---|---|---|
| C1 | Top-10 holdings concentration (Herfindahl-Hirschman Index) | Monthly factsheet | Monthly |
| C2 | Sector / geographic concentration (HHI) | Monthly factsheet | Monthly |
| C3 | Alternative-assets share (PE / debt / property — illiquid valuations) | Monthly factsheet | Monthly |

### Risk flags (R) — binary triggers

| Code | Signal | Source | Cadence |
|---|---|---|---|
| R1 | Gearing % vs structural limit (warning at >80% of limit) | Monthly factsheet | Monthly |
| R2 | Recent dividend cut (last 5y) | RNS | Daily refresh |
| R3 | Continuation vote in next 12 months | Annual report + RNS | Annual |

### Quality gates (must-pass before signal composite)

- **G1:** Revenue reserve cover ≥ 0.5 years (sector-aware: alternative-income trusts ≥ 0.25; UK equity income trusts ≥ 1.0)
- **G2:** Distribution coverage ≥ 0.95 (slight reserve draw permitted)
- **G3:** No dividend cut in last 5 years
- **G4:** Ongoing charges < 2.0% (cost ceiling)

Composite **Solidity Score** = quality-gated weighted average of Q/D/C/R categories. Sign-inverted R signals reduce the score. Same `computeCategoryAggregate()` from `lib/scoring/redistribute-weights.ts` reused.

## Critical files

### Net-new

- `dividendmapper/supabase/migrations/0010_investment_trust_scoring.sql` — see schema below
- `dividendmapper/lib/scoring/signals/trust-q1-reserve-cover.ts` through `trust-r3-continuation-vote.ts` (10 files)
- `dividendmapper/lib/scoring/compute-trust-solidity-score.ts` — orchestrator, mirrors `compute-buy-score.ts`
- `dividendmapper/lib/scoring/trust-quality-gates.ts` — mirrors `quality-gates.ts` with trust thresholds
- `dividendmapper/lib/scoring/trust-assemble-inputs.ts` — adapter, takes raw ingested data + assembles signal inputs
- `dividendmapper/lib/ingestion/trust-rns.ts` — RNS scraper (source TBD per `## RNS source options`)
- `dividendmapper/lib/ingestion/trust-factsheet.ts` — sponsor-PDF factsheet parser, ~8 templates
- `dividendmapper/lib/ingestion/trust-annual-report.ts` — annual report PDF parser, revenue reserves + coverage extraction
- `dividendmapper/lib/ingestion/trust-universe.ts` — universe seed + corporate-action handling
- `dividendmapper/app/api/internal/refresh-trust-nav/route.ts` — daily NAV cron (08:00 UTC)
- `dividendmapper/app/api/internal/refresh-trust-fundamentals/route.ts` — monthly factsheet + quarterly annual report cron
- `dividendmapper/app/api/internal/refresh-trust-scores/route.ts` — daily scoring cron (09:00 UTC, after NAV)
- `dividendmapper/app/api/scoring/trust/[ticker]/route.ts` — data API, mirrors `app/api/scoring/[ticker]/route.ts`
- `dividendmapper/app/api/scoring/trust/route.ts` — list/screener data API
- `dividendmapper/app/trusts/page.tsx` — list/screener
- `dividendmapper/app/trusts/[ticker]/page.tsx` — per-trust resource (ISR)
- `dividendmapper/app/trusts/methodology/page.mdx` — methodology
- `dividendmapper/app/trusts/sectors/[sector]/page.tsx` — by AIC sector
- `dividendmapper/app/trusts/_components/solidity-display.tsx` — large numeric headline
- `dividendmapper/app/trusts/_components/reserve-fuel-gauge.tsx` — distinctive visual
- `dividendmapper/app/trusts/_components/nav-discount-sparkline.tsx` — distinctive visual
- `dividendmapper/app/trusts/_components/signal-spider-chart.tsx` — Q/D/C/R quadrant breakdown
- `dividendmapper/planning/plans/2026-mm-dd-phase4-sprint1-ingestion.md` — sprint 1 day plan, written at sprint 1 start
- (sprint 2, 3, 4 day plans similarly)

### Modified

- `dividendmapper/lib/scoring/redistribute-weights.ts` — verify generic enough for trust signals (likely zero changes; the function operates on `SignalWeight[]` which is vehicle-agnostic)
- `dividendmapper/app/app/portfolio/_components/holdings-table.tsx` — add vehicle-type discriminator → render trust chip vs equity chip per row
- `dividendmapper/app/app/portfolio/_components/score-drawer.tsx` — accept `vehicleType` prop, fetch from `/api/scoring/trust/[ticker]` when trust
- `dividendmapper/vercel.json` — add 3 new cron schedules
- `dividendmapper/lib/scoring/chip-display.ts` — extend colour mapping for solidity score (single composite, not buy/trim/risk)

### Reused (no changes)

- `lib/scoring/redistribute-weights.ts` — N/A cascade + category aggregation
- `lib/scoring/sector.ts` — sector classifier (extend separately for AIC sectors if needed, but probably keep separate as `lib/scoring/trust-sector.ts`)
- Cron auth + Sentry pattern from `app/api/internal/refresh-equity-scores/route.ts`
- Public page ISR + cookieless-client pattern from `app/scoring/[ticker]/page.tsx`

## Database schema (migration 0010)

```sql
-- Universe table: which trusts we cover, with corporate-action handling
create table trust_universe (
  ticker text primary key,
  trust_name text not null,
  sponsor text not null,
  aic_sector text not null,
  domicile text,
  nav_currency text not null default 'GBP',
  share_class text default 'ordinary',
  status text not null default 'active', -- active / merged / wound_down / suspended
  successor_ticker text,
  included_in_v1 boolean not null default false,
  added_at timestamptz not null default now(),
  notes text
);

-- Fundamentals: per-period (annual / semi-annual / monthly factsheet) snapshot
create table trust_fundamentals (
  id bigserial primary key,
  ticker text not null references trust_universe(ticker),
  period_end date not null,
  period_type text not null, -- annual / interim / monthly_factsheet
  revenue_reserves_pence_per_share numeric,
  reserve_cover_years numeric,
  ongoing_charges_pct numeric,
  gearing_net_pct numeric,
  gearing_structural_max_pct numeric,
  distribution_coverage numeric,
  top10_holdings_pct numeric,
  sector_concentration_hhi numeric,
  alternative_assets_pct numeric,
  source text not null, -- factsheet_url / annual_report_url
  source_url text,
  observed_at timestamptz not null default now(),
  unique(ticker, period_end, period_type)
);

-- NAV: daily / weekly / monthly per trust
create table trust_nav (
  id bigserial primary key,
  ticker text not null references trust_universe(ticker),
  observed_at date not null,
  nav_pence numeric not null,
  nav_currency text not null default 'GBP',
  source text not null, -- rns / sponsor_portal / factsheet
  source_url text,
  unique(ticker, observed_at)
);

-- Mirror equity_scores
create table trust_scores (
  ticker text primary key references trust_universe(ticker),
  solidity_score numeric, -- 0-100, null if gate fails
  quality_gate_passed boolean not null default false,
  failed_gates text[],
  data_quality text not null default 'full', -- full / partial / sparse
  computed_at timestamptz not null default now()
);

-- Mirror equity_score_signals
create table trust_score_signals (
  id bigserial primary key,
  ticker text not null references trust_universe(ticker),
  signal_code text not null, -- Q1..R3
  raw_score numeric,
  weight numeric,
  contribution numeric,
  human_label text,
  observed_at timestamptz not null default now()
);

-- Mirror equity_score_history
create table trust_score_history (
  id bigserial primary key,
  ticker text not null references trust_universe(ticker),
  observed_at date not null,
  solidity_score numeric,
  nav_pence numeric,
  discount_pct numeric,
  reserve_cover_years numeric,
  unique(ticker, observed_at)
);

-- RLS: public read, service-role only write (mirror equity_scores pattern)
alter table trust_universe enable row level security;
alter table trust_fundamentals enable row level security;
alter table trust_nav enable row level security;
alter table trust_scores enable row level security;
alter table trust_score_signals enable row level security;
alter table trust_score_history enable row level security;

create policy "public read" on trust_universe for select using (true);
create policy "public read" on trust_fundamentals for select using (true);
create policy "public read" on trust_nav for select using (true);
create policy "public read" on trust_scores for select using (true);
create policy "public read" on trust_score_signals for select using (true);
create policy "public read" on trust_score_history for select using (true);
```

## Sprint breakdown

Each sprint produces independently shippable / verifiable output. Sprint-level day plans are written at sprint start, not pre-baked here.

### Sprint 1 — Foundations + Ingestion (10 working days, ~2 weeks)

**Outcome:** Top 50 universe seeded; daily NAV ingestion runs end-to-end; sponsor factsheet PDFs parsed for top 8 sponsors; annual reports parsed for revenue reserves. Data visible in Supabase tables, no scoring yet.

- **Day 1**: AIC sector-sizes XLSX QA on top 50 universe; lock the list; apply migration 0010; seed `trust_universe` rows including 3 corporate-action edits (WTAN→ALW, DGI9, TRIG). Confirm RNS source decision (LSEG vs free public alternative).
- **Day 2–3**: RNS scraper module + tests; ingest daily NAV announcements for ~40 daily-cadence trusts; cron at 08:00 UTC. Cover currency edge cases (HVPE/PSH USD-NAV).
- **Day 4–5**: Sponsor factsheet PDF parser. Build templates for top 4 sponsors (Janus Henderson, JPMAM, BlackRock, abrdn — covers ~30 of 50 trusts). Extract revenue reserves, ongoing charges, gearing, top-10 HHI, sector concentration, alt-assets share.
- **Day 6**: Sponsor factsheet templates 5–8 (Baillie Gifford, Columbia Threadneedle, Polar Capital, Allianz GI / Invesco) — extends coverage to 40+ of 50.
- **Day 7–8**: Annual report PDF parser — focused on revenue reserves, distribution coverage, continuation-vote schedule. Tested against 5 representative reports (CTY, BNKR, FCIT, JCH, MRCH).
- **Day 9**: Universe maintenance script — corporate-action detection (mergers, wind-downs), share-class handling.
- **Day 10**: Top-50 dry-run — invoke all ingestion paths, log coverage matrix. Identify trusts with partial data (target: ≥40 of 50 with full data, ≤10 with sparse).

**Verify sprint 1:** `select ticker, count(*) from trust_fundamentals group by ticker;` shows ≥40 rows; `select ticker, max(observed_at) from trust_nav group by ticker;` shows yesterday or today for ≥40 trusts.

### Sprint 2 — Scoring Engine (8 working days, ~1.5 weeks)

**Outcome:** Solidity score computed daily for all v1 trusts. Per-signal breakdown persisted. Quality gates enforced. Tested end-to-end.

- **Day 11**: Signal interface + Q1 reserve cover + Q2 dividend streak (reuses RNS data + dividend history). TDD per Phase 2.75 pattern.
- **Day 12**: Q3 distribution coverage + Q4 ongoing charges vs AIC sector median (sector medians computed across v1 universe + cached).
- **Day 13**: D1 NAV discount Z-score (5-yr rolling) + D2 discount-control flag.
- **Day 14**: C1 top-10 HHI + C2 sector/geo HHI + C3 alternative-assets share.
- **Day 15**: R1 gearing-vs-limit + R2 dividend-cut history + R3 continuation-vote-in-12m.
- **Day 16**: Quality gates G1–G4 + composite Solidity Score orchestrator + sector-aware threshold tuning. Sensitivity analysis: do gates eliminate sensible trusts (CTY, BNKR should clear; obviously distressed trusts should fail).
- **Day 17**: Daily scoring cron at 09:00 UTC after NAV refresh; persist to `trust_scores` + `trust_score_signals` + `trust_score_history`.
- **Day 18**: End-to-end run + diagnostic logging; spot-check 10 trusts vs hand calculations.

**Verify sprint 2:** `select * from trust_scores where solidity_score is not null;` shows ≥35 trusts with scores; signal breakdown is non-empty for each.

### Sprint 3 — Public Pages + Methodology + UI Polish (10 working days, ~2 weeks)

**Outcome:** Public `/trusts/*` pages live and indexable; methodology page citable; distinctive UI primitives shipped; mobile responsive.

- **Day 19–20**: `/trusts/[ticker]/page.tsx` — per-trust resource page. Server-component ISR (`revalidate: 3600`). Headline solidity display + signal breakdown (Pro-gated) + reserve fuel-gauge + NAV discount sparkline.
- **Day 21–22**: `/trusts/page.tsx` — list/screener with sort by solidity, filter by AIC sector, free-text search.
- **Day 23**: `/trusts/methodology/page.mdx` — written methodology with signal-by-signal definitions, data-source attribution (RNS for NAV, sponsor factsheets for fundamentals, annual reports for reserves), worked example. Linked from per-trust pages.
- **Day 24**: `/trusts/sectors/[sector]/page.tsx` — SEO bonus, "UK Equity Income trusts ranked by solidity" style pages per AIC sector. Static generation.
- **Day 25**: Distinctive visual primitives:
   - `reserve-fuel-gauge.tsx` — semi-circular gauge, years-of-cover number in centre, colour ramp green→amber→red
   - `nav-discount-sparkline.tsx` — 5-yr line with Z-score band overlay
   - `signal-spider-chart.tsx` — Q/D/C/R quadrant filled-shape on radar, hoverable per axis
   - `solidity-display.tsx` — large numeric (e.g. `78`) with secondary "Solid · Anchor" label and trend arrow
- **Day 26**: SEO + AEO polish — JSON-LD `Investment` schema, OpenGraph images per-trust (dynamic at build via OG image generation), canonical URLs, sitemap entries for all `/trusts/*` pages, descriptive meta. Use `nextjs-seo-aeo-audit` skill against the site.
- **Day 27**: Mobile responsiveness pass — test on iPhone SE / standard / Pro Max widths. Solidity card should be the hero on mobile.
- **Day 28**: Design review pass — invoke `design-review` skill. Fix AI-slop patterns, spacing, hierarchy.

**Verify sprint 3:** `curl https://dividendmapper.com/trusts/CTY.L | grep -c "Solidity"` returns ≥1; Lighthouse desktop ≥95 performance / ≥95 SEO; unauthenticated and authenticated views both render score (breakdown gated for unauth).

### Sprint 4 — App Integration + Launch (5 working days, ~1 week)

**Outcome:** Trust holdings show solidity chips in user portfolios; Anchors vs Exposures unified resilience view; founding-member launch comms sent; monitoring live.

- **Day 29**: Extend `holdings-table.tsx` with vehicle-type discriminator. When `ticker in trust_universe`, render trust chip (solidity score) instead of equity chip (buy/trim/risk).
- **Day 30**: Extend `score-drawer.tsx` to fetch from `/api/scoring/trust/[ticker]` when vehicle-type is trust. Drawer surfaces Q/D/C/R breakdown.
- **Day 31**: Portfolio Anchors vs Exposures view — group trusts + equities into one resilience map. "Your buffered income (£X/mo) vs exposed income (£Y/mo)".
- **Day 32**: Founding-member email — sent via existing Resend stack. Public launch comms (T212 forum if Glenn's `probablypassive` account aged, WhatsApp group, brief LinkedIn post). Use `humaniser` linter on all copy.
- **Day 33**: Production smoke (synthetic Pro user + unauth view), Sentry monitoring confirmed, daily-NAV cron logged ≥3 successful runs, PostHog events firing on `/trusts/[ticker]` views.

**Verify sprint 4:** Glenn logs into `/app`, sees a trust holding (CTY or equivalent) with solidity chip, clicks → drawer opens with Q/D/C/R breakdown, "View on /trusts/CTY.L" link works.

## UI design direction — "sexy"

Reference points (not aesthetic copies — orientation):

- **Sharesight** — clean tabular data with thoughtful colour
- **Linear** — minimalist density, mono-typography, restraint
- **Stripe Dashboard** — sophisticated colour palette beyond green/red, breathable spacing, distinctive iconography
- **Lightyear / Trading 212 app** — modern fintech minimalism
- **Avoid:** Kepler / QuotedData / Citywire UK-financial-services-default aesthetic

Distinctive primitives we build:

1. **Reserve fuel-gauge** — semicircular, years-of-cover number in the centre, secondary "covers next ~X dividends at current rate" label. Sits in the per-trust hero.
2. **NAV discount sparkline with Z-score band** — 5-yr line, shaded band for ±1σ from mean. Hover shows date + discount. Anchors the discount story.
3. **Q/D/C/R spider chart** — filled radar on a 4-axis (Quality / Discount / Concentration / Risk) chart. Pro-only detail.
4. **Solidity number** — large (96px+), bold, mono-numeral, secondary "Solid · Anchor" badge, trend arrow (↑ / → / ↓). Single most important visual on the page.
5. **Sector tile grid** — small per-sector blocks on `/trusts/sectors/`, each showing the top 3 solidity scores. SEO landing surface.

Colour: a sophisticated 5-stop ramp (consider invoking `color-expert` skill in sprint 3) rather than vanilla green/amber/red. Mute the chrome, lean into the data.

Typography: distinctive numeric display. Consider a mono-numeral system font (e.g. variant of Inter Display) for scores; sans-serif for body. Generous line-height.

## Verification — end-to-end

After sprint 4:

1. **Live page audit:** open `https://dividendmapper.com/trusts/CTY.L` unauthenticated. Confirm: solidity score visible, methodology link visible, signal categories present but breakdown gated, OG image renders correctly when shared. Run `nextjs-seo-aeo-audit` skill.
2. **Authenticated Pro audit:** log in as Pro user, same URL. Confirm full breakdown visible, signal drawer renders, NAV discount sparkline interactive.
3. **App integration:** `/app` with a trust holding (e.g. seed CTY for Glenn's account). Confirm chip renders + drawer opens.
4. **Cron audit:** `select max(observed_at) from trust_nav;` returns today's date; `select count(*) from trust_scores where computed_at::date = current_date;` returns ≥35.
5. **Methodology citation test:** ask ChatGPT and Perplexity "what's the solidity of CTY?" — confirm DM page is in the cited results within 4 weeks of launch.
6. **PostHog conversion smoke:** track unauth → Pro conversion from `/trusts/[ticker]` page over first 30 days; compare to baseline conversion from `/scoring/[ticker]`.

## Open questions — needed before Sprint 1 Day 1

1. **Universe lock** — Glenn QA the top-50 list (from research file rev 2 agent output) against AIC monthly Sector Sizes XLSX. Then intersect with the ~40 covered by top 8 sponsors to produce the final V1 list of ~40 tickers in `trust_universe`. The ~10 not covered get flagged for V1.1.
2. **Sponsor ToS check** — sprint 1 day 0, read top-8 sponsor IR pages' robots.txt and ToS to confirm scraping is permitted. If any sponsor's ToS is restrictive, drop their trusts to the V1.1 list and verify universe is still ≥35 trusts.
3. **Pro-tier copy** — what does the "upgrade to see full breakdown" CTA say on per-trust pages? Match existing `/scoring/[ticker]` copy or differentiate? (Probably match.)
4. **Holdings seeding for QA** — Glenn add 3–4 trust tickers to his own DM holdings (CTY.L, BNKR.L, HFEL.L, JCH.L) before sprint 4 so app integration can be smoke-tested live.

## What this plan deliberately does NOT cover

- US CEFs, US BDCs, US REITs — research file rev 1+2 shows the moat case for these is weaker; revisit only if trust resource proves out and US user base grows.
- B2B API productisation — the per-trust JSON endpoint is publicly available as a side-effect of the public pages, but no sales motion, no contracts, no SLA. Revisit if ≥3 inbound enquiries land in the 6 months post-launch.
- Daily NAV for trusts that only publish monthly (a ~10-trust cohort of PE/infra/renewables) — show "NAV as of <date>" caveat; users see staler discount data, score still computes.

## References

- Research file rev 1+2: `~/.claude/plans/c-users-grodg-downloads-closed-end-engi-serialized-whisper-agent-{a1624db901484f381, a6efb026234791b35}.md`
- Existing equity scoring engine pattern: `dividendmapper/lib/scoring/compute-buy-score.ts`, `dividendmapper/lib/scoring/signals/`, `dividendmapper/lib/scoring/redistribute-weights.ts`, `dividendmapper/app/api/internal/refresh-equity-scores/route.ts`, `dividendmapper/app/api/scoring/[ticker]/route.ts`
- Existing public scoring pages pattern: shipped 2026-06-02, see memory `state_2026-06-02_eod_public_scoring_pages.md`
- Plan-doc convention: `planning/06-equity-scoring.md` (phase spec), `planning/plans/2026-05-29-phase-2.75-equity-scoring-days-2-9.md` (sprint plan)
- AIC monthly Sector Sizes XLSX (for universe QA) — theaic.co.uk → Stats → Sector Sizes (referenceable, not redistributable)
- LSEG RNS Data Feed sales contact — `rns@lseg.com`
