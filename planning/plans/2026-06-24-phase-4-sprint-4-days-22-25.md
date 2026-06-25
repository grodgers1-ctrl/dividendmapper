# Phase 4 Sprint 4 — App Integration + Launch (Days 22–25)

> **For agentic workers:** REQUIRED SUB-SKILLS in order — `superpowers:executing-plans` (this plan), `superpowers:subagent-driven-development` (per-day execution), `superpowers:test-driven-development` (per-task where logic-shaped). The launch-comms task on Day 25 also requires `humaniser` per the project memory entry on humaniser-mandatory.

**Sprint outcome.** Vehicle-typed holdings in `/app/portfolio` render Resilience chips alongside equity chips. The existing score drawer routes vehicle tickers to the Sprint 3 data API and reuses `VehicleProDetail` inside the panel. New "Anchors vs Exposures" portfolio surface buckets income by Resilience band so Pro members can see what's earning them rent vs what's earning them yield. PostHog instrumentation, Sentry-clean prod, three successful daily-cron runs. Founding-member email + public launch comms go out.

**Branch.** `phase-4/income-vehicle-scoring` (long-lived concept; in practice each sprint child-branches off main). Per-sprint child branch `phase-4/sprint-4` off `main`. Per-day commits inside the worktree. Sprint 4 PR rebased onto current main at end of Day 25.

**Carries over from Sprint 3.** Public pages live at `/reits`, `/bdcs`, `/uk-reits` with per-ticker pages + methodology. `VehicleProDetail` client island, `/api/vehicle-scoring/[ticker]` route, `VEHICLE_FAMILIES` metadata, the three SVG primitives — all available for reuse. CAL-3 (Q_S1 streak modal-amount) shipped 2026-06-24; CAL-4 / CAL-5 / CAL-6 / CAL-7 stay deferred to V1.1.

---

## Pre-flight (Day 21.5 — before Day 22 kicks off)

### 1. Agentic worker — worktree setup

```bash
cd /c/Users/grodg/dividend_mapper_plan
git fetch origin
git worktree add dividendmapper/.worktrees/phase-4-sprint-4 -b phase-4/sprint-4 origin/main
cd dividendmapper/.worktrees/phase-4-sprint-4/dividendmapper
cmd //C "mklink /J node_modules ..\\..\\..\\..\\dividendmapper\\node_modules"
cmd //C "mklink .env.local ..\\..\\..\\..\\dividendmapper\\.env.local"
npx vitest run --no-file-parallelism lib/scoring/   # baseline — expect ≥ 540 tests
```

### 2. Glenn — seed sample vehicle holdings in /app

Sprint 4 wires vehicles into the holdings drawer, but Glenn's prod portfolio currently has equities only. Before Day 22 starts he adds 3–4 vehicle holdings via the existing CSV import flow or the Portfolio Manager UI:

```text
O       1   shares   us_reit
MAIN    1   shares   us_bdc
BLND.L  1   shares   uk_reit
SGRO.L  1   shares   uk_reit
```

These exist purely so Days 22–24 have something to render against in `/app/portfolio` and the score drawer. Use the existing CSV import path (`scripts/imports/csv-holdings-import.md` from state memory entry [csv-import shipped]) or the Portfolio Manager modal.

### 3. Glenn — QA pass on `uk-reit-classification.json` (optional, ~30 min)

The hand-classified file ships in prod and the methodology page now points users to it as the source of truth for `propertyType` + `geographicScope`. Per the cleanup backlog, spot-check the 7 `overseas_exposed` entries (SGRO.L, HMSO.L, SAFE.L, PHP.L, SUPR.L, CLI.L, SERE.L) against the latest annual reports and add a `reviewed_by_glenn: true` flag so the file carries provenance. Not blocking; nice to land before public launch comms go out on Day 25.

### 4. Agentic worker — Sprint 3 prod-stability check

Before any new app code lands, confirm Sprint 3 is genuinely stable in prod (it shipped 2026-06-24 ~12:08 UTC):

- No Sentry errors on `/reits`, `/bdcs`, `/uk-reits`, `/methodology/income-vehicles` over the past 24h.
- `vehicle_scores.computed_at` shows a fresh row from the most recent 09:00 UTC cron run (so the CAL-3 fix is reflected in the persisted `human_label`).
- `sitemap.xml` indexed by Google Search Console — submit the new sitemap if not already crawled.

If any check fails, raise it before Day 22 starts. The launch comms on Day 25 lean on a clean prod surface.

---

## File map (lock decomposition here)

**Modified library code:**
- `lib/scoring/load-vehicle-score.ts` — exported `loadVehicleScore` already; add a thin `loadVehicleScoresByTickers` batch helper (Day 22) so the holdings table doesn't fan out one query per ticker.
- `lib/scoring/income-band-helpers.ts` _(new, ~80 lines)_ — pure helper. Given `{ vehicleType, resilienceScore }` returns `'anchor' | 'exposure' | 'risk' | 'unscored'` for the Anchors vs Exposures view (Day 24).

**Modified app code:**
- `app/app/portfolio/_components/holdings-table.tsx` — extend vehicle-type discriminator → render `<VehicleChip />` for REIT/BDC/UK-REIT tickers (Day 22).
- `app/app/portfolio/_components/vehicle-chip.tsx` _(new)_ — small label + colour chip for vehicle rows. Distinct from equity chips so the user reads "REIT 72" not just "72".
- `app/app/portfolio/_components/score-drawer.tsx` — accept `vehicleType` prop; route to `/api/vehicle-scoring/[ticker]` when vehicle-typed; render `VehicleProDetail` shape inside (Day 23).
- `app/app/portfolio/_components/anchors-exposures-card.tsx` _(new)_ — Pro-gated card on `/app/dashboard` (or `/app/portfolio`) that buckets income by resilience band (Day 24).

**Methodology page touch-up:**
- `app/(public)/methodology/income-vehicles/page.mdx` — strike-through the CAL-3 caveat (now shipped) and replace with a one-line "Calibrations shipped" note (Day 22 — tiny edit, ~10 min).

**Telemetry + comms:**
- `instrumentation-client.ts` _(edit)_ — add PostHog `$pageview` capture for `/reits/*`, `/bdcs/*`, `/uk-reits/*` if not already global, plus a `vehicle_pro_upsell_view` event when the upsell card mounts for an anon/free viewer (Day 25).
- `scripts/sends/founding-member-vehicle-launch.txt` _(new)_ — outreach copy (Day 25). Humaniser-cleared.
- `app/blog/income-vehicle-resilience-launch/page.mdx` _(new, optional)_ — public launch post if Glenn wants a citable announcement page (Day 25).

**Tests:**
- `lib/scoring/__tests__/income-band-helpers.test.ts` _(new)_ — 4–6 tests covering the band-mapping rules.
- `lib/scoring/__tests__/load-vehicle-score.test.ts` — extend with batch-helper coverage (2 new tests).
- `app/app/portfolio/_components/__tests__/holdings-table.test.tsx` — extend existing suite with a vehicle-typed-row case (1 new test).
- No new route-level integration tests — covered by preview MCP + Sentry on Day 25.

---

## Day 22 — Holdings-table vehicle-type discriminator

**Outcome.** Glenn's holdings table renders distinct Resilience chips for the vehicle tickers seeded in pre-flight. Methodology page CAL-3 caveat updated. ~3 tests.

### Task 22.1 — `loadVehicleScoresByTickers` batch helper

**Files.** `lib/scoring/load-vehicle-score.ts` + extend `lib/scoring/__tests__/load-vehicle-score.test.ts`.

**Definition.** Given a list of tickers, return a `Map<ticker, VehicleScoreLoadResult>`. One Supabase round-trip, not N. Joins `vehicle_scores` + `vehicle_universe` like the single-ticker `loadVehicleScore` but with an `.in("ticker", tickers)` filter. Skips signals + history (the table only needs the chip data).

**TDD.**
1. Write failing test: empty input returns empty Map; mixed equity+vehicle tickers returns only vehicle rows; unknown tickers absent from result.
2. Implement. Reuse the existing query patterns from `loadVehicleScore`.
3. Commit `Phase 4 Sprint 4 Day 22: batch vehicle-score loader`.

### Task 22.2 — `VehicleChip` component

**Files.** `app/app/portfolio/_components/vehicle-chip.tsx` _(new)_, no test (pure render + Tailwind).

**Definition.** Server component, ~30 lines. Props `{ vehicleType, resilienceScore, qualityGatePassed }`. Renders a small chip styled in line with the existing equity chip but with a vehicle-type prefix (`REIT 72`, `BDC 67`, `UK REIT 60`). Gate-failed shows `REIT —` with a muted background. Reuses the `--color-resilience-*` ramp from Sprint 3 Day 19.

### Task 22.3 — `holdings-table.tsx` discriminator

**Files.** `app/app/portfolio/_components/holdings-table.tsx` + extend the existing test file.

**Definition.** Currently the table fetches equity scores by ticker. Extend the fetch step to:
1. Call `loadVehicleScoresByTickers` in parallel with the existing equity-score fetch.
2. For each row, render `<VehicleChip>` when the ticker is in the vehicle Map; fall back to the existing equity chip otherwise.

**TDD.** Add one fixture row with `vehicle_type='us_reit'` and assert the rendered cell contains `REIT`.

### Task 22.4 — Methodology page CAL-3 status update

**Files.** `app/(public)/methodology/income-vehicles/page.mdx`.

**Definition.** Tiny edit. Strike through the CAL-3 bullet under "Known limits" and replace with:

> **Q_S1 dividend-streak — calibration shipped (2026-06-24).** Streak now compares modal payment amount per year, robust to stray 13th payments. Reported streak capped at 10 years by the input fetch window; widening to 30 years to surface the full Aristocrat streak is queued for a small follow-up.

No re-deploy of scores needed — the new `human_label` strings propagate on the next daily cron run.

### Day 22 end-of-day checklist

- [ ] `loadVehicleScoresByTickers` committed with tests
- [ ] `VehicleChip` renders for the 4 seeded vehicle holdings in `/app/portfolio` (preview verify)
- [ ] Methodology page CAL-3 caveat replaced with the shipped-status note
- [ ] `npx vitest run --no-file-parallelism lib/scoring/ app/(public)/_components/__tests__/` green
- [ ] Commit: `Phase 4 Sprint 4 Day 22: holdings-table vehicle chips + methodology refresh`

---

## Day 23 — Score-drawer extension

**Outcome.** Clicking a vehicle row's chip in `/app/portfolio` opens the drawer with the per-signal Q/D/C/R breakdown. The drawer reuses `VehicleProDetail` from Sprint 3 so there is exactly one implementation of the Pro breakdown UI. "View on /reits/O" deep link bottoms the panel.

### Task 23.1 — `score-drawer.tsx` vehicle-type prop

**Files.** `app/app/portfolio/_components/score-drawer.tsx`.

**Definition.** The drawer currently fetches `/api/scoring/[ticker]` (equity path). Extend the component:
1. Accept a `vehicleType?: 'us_reit' | 'us_bdc' | 'uk_reit'` prop.
2. When `vehicleType` is set, fetch `/api/vehicle-scoring/[ticker]` instead and render the vehicle shape (Resilience + Q/D/C/R) rather than the equity buy/risk/trim triplet.
3. When not set, behave exactly as today.

Caller (holdings-table row click) passes `vehicleType` based on the same map populated in Day 22.

### Task 23.2 — Render the vehicle breakdown via `VehicleProDetail`

**Files.** Same drawer file. Import the Sprint 3 `VehicleProDetail` from `app/(public)/_components/vehicle-pro-detail.tsx` and render it as the drawer body when the response is vehicle-shaped. The component already handles Pro tier gating; inside the drawer the viewer is already known-Pro (drawer is `/app`-only) so the tier check effectively short-circuits — the component reuses cleanly either way.

If `VehicleProDetail` reads `useUser()` directly in a way that double-fetches when both the drawer and the per-ticker page mount it, factor out the data-fetch into a small `useVehicleSignals(ticker)` hook so the drawer skips the tier-gate fetch.

### Task 23.3 — Deep link to the per-ticker page

Add a footer link inside the drawer: `View full resilience page →` pointing at `/{family.slug}/{ticker}` (e.g. `/reits/O`). Uses `VEHICLE_FAMILIES` to derive the slug from `vehicleType`.

### Task 23.4 — Preview verify

Use the Preview MCP at desktop + mobile widths:
1. Open `/app/portfolio`, click O's row → drawer slides in, shows Resilience 35 + Q/D/C/R bars + footer link.
2. Open MAIN's row → drawer shows BDC-shaped data (Q_B1 / C_B1 / R_B1 visible).
3. Open BLND.L's row → drawer shows UK REIT-shaped data (Q_U1 / Q_U2 / C_U1 visible).
4. Click the footer link → navigates to `/reits/O` (or `/bdcs/MAIN`, etc.). Drawer URL state cleans up.

### Day 23 end-of-day checklist

- [ ] Score-drawer routes vehicle tickers to `/api/vehicle-scoring/[ticker]`
- [ ] Drawer renders VehicleProDetail inline; no duplicate Pro-tier fetches per drawer open
- [ ] Footer deep link works on all three families
- [ ] Preview MCP screenshot of the drawer open on O pasted into the commit message
- [ ] Commit: `Phase 4 Sprint 4 Day 23: vehicle-aware score drawer`

---

## Day 24 — Anchors vs Exposures portfolio view

**Outcome.** Pro members see a new card on `/app/dashboard` that buckets their dividend income by Resilience band — "anchors" earning durable rent vs "exposures" earning higher yield with more cut risk. Glenn's seeded test portfolio (O, MAIN, BLND.L, SGRO.L) gives the card real numbers to render against during dev. Surface is intentionally read-only in V1; the underlying classification is the V1.1 hook for personalised "rebalance toward anchors" suggestions.

### Task 24.1 — `income-band-helpers.ts`

**Files.** `lib/scoring/income-band-helpers.ts` + `__tests__/income-band-helpers.test.ts`.

**Definition.** Pure function:

```ts
export type IncomeBand = 'anchor' | 'exposure' | 'risk' | 'unscored';

export function classifyHolding(input: {
  vehicleType: VehicleType | 'equity';
  resilienceScore: number | null;        // for vehicles
  buyScore: number | null;               // for equities (Quality)
  qualityGatePassed: boolean;
}): IncomeBand;
```

Banding rules (vehicles):
- `resilienceScore >= 75` → `anchor`
- `50 <= resilienceScore < 75` → `exposure`
- `resilienceScore < 50` OR gate-failed → `risk`
- `vehicleType === 'equity'` with `buyScore >= 75` → `anchor` (equity contributes too)
- Anything missing → `unscored`

**TDD.** ~6 tests covering each branch + an edge case for gate-failed.

### Task 24.2 — Income aggregation

**Files.** Add a small helper to the existing portfolio-analytics module (`lib/scoring/load-portfolio-analytics.ts`). Given holdings + scores + projected annual income per holding (already computed there), return `{ anchorIncome, exposureIncome, riskIncome, unscoredIncome }`.

### Task 24.3 — `anchors-exposures-card.tsx`

**Files.** New component, server-rendered, takes the aggregation as a prop. Renders:
- Headline: total income split into a 4-segment horizontal stacked bar (sage / sand / brick / muted-grey using the resilience ramp).
- Per-band breakdown rows: `£X/yr from anchors (3 holdings)`, `£Y/yr from exposures (2)`, etc.
- A short explainer below: "Anchors earn durable rent; exposures earn higher yield with more cut risk. Not financial advice." Link to the methodology page anchor.

No interactivity in V1 — a static, screenshot-able panel that gives Pro members a meaningful at-a-glance view they can't get from the holdings table alone.

### Task 24.4 — Wire into `/app/dashboard`

Place the card below the existing dashboard income chart, above the holdings preview table. Hidden for non-Pro members (or replaced with a small upsell card — match the equivalent upsell pattern from the existing dashboard).

### Day 24 end-of-day checklist

- [ ] Band helper + aggregation committed with tests
- [ ] Card renders against Glenn's seeded portfolio with sensible numbers
- [ ] Mobile + desktop screenshots in the commit message
- [ ] Commit: `Phase 4 Sprint 4 Day 24: Anchors vs Exposures portfolio card`

---

## Day 25 — Launch comms + monitoring

**Outcome.** PostHog instrumented on all per-vehicle pages + the upsell card. Founding-member email goes out. Public launch comms drafted, humaniser-cleared, sent. Three successful daily-cron runs logged; Sentry clean; production smoke green.

### Task 25.1 — PostHog instrumentation

**Files.** `instrumentation-client.ts` _(edit)_; or per-page if PostHog `$autocapture` already covers pageviews. Add:
1. `$pageview` capture confirmed firing on `/reits/[ticker]`, `/bdcs/[ticker]`, `/uk-reits/[ticker]` (autocapture likely already handles this — verify).
2. Custom event `vehicle_pro_upsell_view` fired when `VehicleProDetail`'s upsell variant mounts for anon/free viewers. Properties: `ticker`, `vehicleType`, `viewer` (`anon` or `free`).
3. Custom event `vehicle_drawer_open` fired when the score drawer opens for a vehicle row in `/app/portfolio`. Properties: `ticker`, `vehicleType`, `resilienceScore`.

Verify by opening `/reits/O` anon → confirm `vehicle_pro_upsell_view` lands in PostHog within 30s.

### Task 25.2 — Founding-member email

**Files.** `scripts/sends/founding-member-vehicle-launch.txt`.

**Process.**
1. Draft the email per Glenn's editorial preferences from the [welcome-email-template] memory entry (warm opener, "please flag", "Here is", "WhatsApp" cap).
2. Run `npm run lint:humaniser` (per the humaniser-mandatory memory entry). Resolve every flagged pattern. Show Glenn the audit output BEFORE sending.
3. Send via the existing Resend stack (founding-member list, ~current count from Stripe).

Subject line draft: `New on DividendMapper: dividend resilience for REITs, BDCs, and UK REITs`.

Body shape (~150–200 words):
- One-line context: "you backed DividendMapper as a founding member; here's the next big surface."
- What's new: three new sections — `/reits`, `/bdcs`, `/uk-reits` — each with a Resilience score and per-signal breakdown for Pro.
- One concrete example: "look up O, MAIN, BLND.L to see what the score does for a name you already know."
- App integration: "your portfolio's REIT and BDC holdings now show Resilience chips alongside equities."
- Methodology link: `/methodology/income-vehicles`.
- Sign-off: Glenn, plain.

### Task 25.3 — Public launch comms

Three artefacts, each humaniser-cleared:

1. **Web post** _(optional, only if Glenn wants a citable URL)_ — `app/blog/income-vehicle-resilience-launch/page.mdx`. ~600 words. SEO-friendly so the announcement is itself indexable.
2. **Reddit/T212 forum DM template** — short, no markdown bullets per the [outreach-DM-format] memory entry. NOT a launch post on r/UKPersonalFinance (per the [launch-traffic-skepticism] memory entry — mods remove product posts; the comms below skip subs and focus on direct outreach + email).
3. **Twitter/X thread** — 3–5 tweets, no em-dashes, leads with the visual rather than the claim.

All three drafts saved to `scripts/sends/` for Glenn's review before send. **Do not send anything without the humaniser audit attached.**

### Task 25.4 — Production smoke

Run through the §Verify Sprint 4 SQL block (below) and confirm each line. Pass criteria: every check returns the expected shape. Anything off → file the gap, decide before sending the founding-member email.

### Task 25.5 — _(Optional)_ EDGAR CIK backfill for 9 missing tickers

Per the cleanup backlog: HTGC, SLRC, GAIN, KIO, SAR, DLR, GLPI, FR, REXR have `cik = null` because FMP's `profile.cik` was null for them. Affects only the data-freshness badge in V1.1, not scoring. ~2 hours work — ship if Sprint 4 has time; skip otherwise and leave in the backlog.

If shipping: add a `--from-sec-tickers` mode to `scripts/scoring/backfill-vehicle-edgar.mjs` that reads SEC's `company_tickers.json`. One-off run, UPDATE the 9 rows.

### Day 25 end-of-day

- [ ] PostHog events firing on /reits/* and the drawer
- [ ] Founding-member email sent (with humaniser audit attached to the commit / Glenn's WhatsApp)
- [ ] Public comms drafts saved to `scripts/sends/` for Glenn's review
- [ ] Sprint 4 PR rebased onto current main: `git rebase origin/main`
- [ ] PR opened: `gh pr create --base main --head phase-4/sprint-4 --title "Phase 4 Sprint 4 — App Integration + Launch"`
- [ ] PR body: screenshots of /app holdings-table with vehicle chips, drawer open on O, Anchors vs Exposures card, PostHog event screenshot

---

## Sprint 4 Verify

```bash
# /app/portfolio holdings table renders the vehicle chips for seeded tickers
# (run authenticated as Glenn — easier to do in browser).

# /api/vehicle-scoring routes are healthy
for t in O MAIN BLND.L SGRO.L; do
  printf "%-10s %s\n" "$t" "$(curl -s -o /dev/null -w '%{http_code}' "https://dividendmapper.com/api/vehicle-scoring/${t}")"
done
# expect 401 for anon (rate-limited only after 60/hr); 200 once authed
```

```sql
-- Cron freshness: prices today, scores today, signals today
select 'prices' as kind, max(observed_at)::text from vehicle_prices
union all
select 'scores', max(computed_at)::text from vehicle_scores
union all
select 'signals', max(observed_at)::text from vehicle_score_signals;
-- expect all three within the last 24h

-- CAL-3 fix visible on the persisted label for O
select human_label from vehicle_score_signals
where ticker = 'O' and signal_code = 'Q_S1'
order by observed_at desc limit 1;
-- expect "10y consecutive dividend streak" (or higher once the input window widens)
```

```bash
# Sentry — last 24h, by route
gh api repos/grodgers1-ctrl/dividendmapper/issues?labels=sentry --jq 'length'
# expect 0 (or only known/already-handled noise)

# PostHog event smoke
# (manual: open PostHog dashboard, filter event=vehicle_pro_upsell_view, expect ≥1 entry from /reits/O after the open test in Task 25.1)
```

---

## Carry-forward to V1.1

After Sprint 4 ships, the V1 launch is done. Backlog priority for V1.1 (from `planning/phase-4-cleanup.md` triage):

1. **CAL-7 BDC modal filter** — biggest user-visible impact (60% BDC blank-out). ~3 hours.
2. ~~CAL-3 Q_S1 streak~~ — shipped 2026-06-24.
3. **CAL-3 follow-up: widen dividend history window from 10y to 30y** — so Aristocrat streaks show the full count rather than capping at 10. ~30 min.
4. **CAL-4 C_R1 single-bucket cascade** — cosmetic but misleading scores. ~1 hour.
5. **EDGAR backfill** for 9 missing CIK tickers (if not done as Day 25.5). ~2 hours.
6. **CAL-5 R_B1 fundamentals window** — option (b) is cheap, do it with CAL-7. ~1 hour.
7. **EPRA NAV for UK REITs** — meaningful UK D_S1 upgrade. Manual scrape into per-ticker JSON, refreshed semi-annually.
8. **Q_U1 EPRA EPS proxy → real EPS** — same scrape, swaps in real EPRA EPS / DPS for the UK Quality signal.
9. **Per-ticker dynamic OG images** — V1.1 if open-rate from email + social shows the static OG image is hurting CTR.
10. **Sub-sector landing pages** (`/reits/healthcare`, `/uk-reits/industrial`) — SEO long-tail. V1.1.
11. **Comparison view** (side-by-side two tickers) — frequently-asked feature. V1.1.

## Deferred (NOT this sprint)

- **Personalised "rebalance toward anchors" suggestions** — Anchors vs Exposures card in Day 24 is read-only V1; the personalised suggestion engine is V1.1.
- **Email digest of resilience changes** — daily email "your O moved from Resilience 35 to 38" → only meaningful once score history accrues ≥30 days. V1.2.
- **Alerts on gate-pass / gate-fail transitions** — same dependency on history accrual. V1.2.
- **Resilience score weight tuning panel** — Pro power-user feature. Out of scope until user research validates demand.

## References

- Phase plan: [planning/08-phase-4-income-vehicle-scoring.md](../08-phase-4-income-vehicle-scoring.md)
- Sprint 3 shipped: [PR #21](https://github.com/grodgers1-ctrl/dividendmapper/pull/21), [planning/plans/2026-06-23-phase-4-sprint-3-days-14-21.md](2026-06-23-phase-4-sprint-3-days-14-21.md)
- CAL-3 shipped: [PR #22](https://github.com/grodgers1-ctrl/dividendmapper/pull/22)
- Cleanup backlog: [planning/phase-4-cleanup.md](../phase-4-cleanup.md)
- Existing patterns to mirror:
  - Equity score drawer: `dividendmapper/app/app/portfolio/_components/score-drawer.tsx`
  - Equity holdings table: `dividendmapper/app/app/portfolio/_components/holdings-table.tsx`
  - Vehicle Pro detail (Sprint 3): `dividendmapper/app/(public)/_components/vehicle-pro-detail.tsx`
  - Vehicle family metadata (Sprint 3): `dividendmapper/lib/scoring/data/vehicle-families.ts`
  - Founding-member email shape: `dividendmapper/super_user/templates/welcome-reply.txt` (per memory)
