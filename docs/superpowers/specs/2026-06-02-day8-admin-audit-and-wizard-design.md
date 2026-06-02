# Phase 2.75 Day 8 — Admin Audit + Personalisation Wizard (design)

Date: 2026-06-02
Status: design approved (Glenn), ready for implementation plan
Source kickoff: `planning/plans/2026-06-01-phase-2.75-day8-kickoff-prompt.md`
Prior state: `state_2026-06-01_eod_day7_phase2.75` (auto-memory)

## Constraint frame (non-negotiable)

- **Scoring engine is FROZEN.** Nothing here changes what the 22:30 UTC cron computes
  (scores/gates) or any persisted `equity_scores` / `equity_score_signals` values. Every
  deliverable is **display-layer**: new read-only pages, render-time re-aggregation, copy,
  thresholds. No new engine compute, no cron change.
- **Reframe is live.** "Buy Score" is displayed as **"Quality Score"** (internal `buy_*`
  identifiers/DB columns unchanged). The Quality score is a **resilience check, an objective
  property of the company's dividend durability — NOT a per-user buy recommendation.** This
  framing governs the wizard design below (see Decision Log).
- **Compliance.** Never "Buy/Sell/Recommend". "Not financial advice" wherever scores appear.
  Humaniser `--strict` (24-pattern audit) on all new user-facing copy, shown before review.
- **Deploy model.** `git push origin main` auto-deploys prod (Root Directory fixed). Verify via
  Vercel MCP (projectId `prj_BLaQ11IfxVGzFy3wRtRXV8pilf9J`). CLI token dead. Confirm the prod
  deploy with Glenn. Never merge `phase-2.75-backtest`; never touch `scripts/backtest/` or
  `scripts/analyst-dashboard/` (separate workstreams).

## Scope & sequencing (Decision A — approved)

Day 8 ships two display-layer units; the public pages are **planned only** this session.

1. **8A — Admin audit** `/app/admin/scoring/audit` (read-only). Smallest, highest ops value,
   de-risks the flagged GATE_4 / degraded_uk data concerns. Ships first.
2. **8B — Personalisation wizard** (posture layer + optional score lens — see Decision B).
3. **Public `/scoring` pages** — full ready-to-execute plan written this session, **built next
   session** (largest, SEO + compliance sensitive). See "Public pages (planned)" below.

## Baseline at design time (2026-06-02)

- Tests 419/68 green; tsc clean; `npm run lint` has 3 pre-existing errors (do not touch).
- Cron healthy: all 11 tickers `computed_at 2026-06-01 22:34 UTC`. BOWL.L now scored. New
  holding **MU** present. 4 of 11 carry a Quality score (PEP 81, PYPL 78, MSFT 40, MU 14); the
  other 7 are `null` (gate failures).
- `user_preferences` table already exists (migration 0004) with the exact 6 wizard columns +
  lifecycle timestamps + RLS self-policy. **No new migration needed.**
- `equity_score_signals` populated (320 rows / 10 tickers): per signal `raw_score` (0-100) +
  `weight` (base within-category) + `contribution` (`raw_score×weight`), keyed by
  `(ticker, score_type, signal_code, observed_at)`. Latest `observed_at` is the live row set.
- `isAdmin(email)` exists in `lib/scoring/config.ts` (ADMIN_EMAILS = glenn@dividendmapper.com,
  grodgers1@googlemail.com). Gate by email, not user_id.
- `applyUserWeights` exists twice: a real category-weight mapper in `lib/scoring/weights.ts`
  (handles `primary_goal` only) and an **identity stub** in `lib/scoring/portfolio-scores.ts`
  used by the live `lib/scoring/load-portfolio-analytics.ts`.

---

## 8A — Admin audit dashboard

**Route.** `app/app/admin/scoring/audit/page.tsx` — server component, `runtime = "nodejs"`,
`dynamic = "force-dynamic"`. Inside the `/app` shell so it reuses the auth layout.

**Guard.** `const user = await requireUser("/app/admin/scoring/audit")` (per the
`reference_app_page_auth_guard` rule — page guards itself, never trusts the layout), then
`if (!isAdmin(claims.email)) notFound()`. Email from `supabase.auth.getClaims()`.

**Data module.** `lib/scoring/load-audit.ts` — one async function querying `equity_scores`
(read), returning a pure summary object. Split so the aggregation is unit-testable without I/O:
a pure `summariseAudit(rows): AuditSummary` + a thin `loadAudit()` that fetches then calls it.

**Panels (read-only v1).**
1. **Cron freshness** — `max(computed_at)`, age in hours, amber "stale" if `> 36h`.
2. **Gate pass / DNQ counts** — count where `buy_quality_gate_passed` true vs false.
3. **`data_quality` breakdown** — counts by `clean` / `sparse` / `degraded_uk`.
4. **Gate-failure tally** — per gate code (GATE_1..GATE_6), how many tickers failed it.
   Directly surfaces the flagged GATE_4 / degraded_uk concern.
5. **Ticker table** — ticker, buy/trim/risk, gate_ok, failed gates, data_quality, computed_at.

**Out of scope v1.** No mutation, no re-trigger button, no charts. Pure read.

**Tests.** `summariseAudit` over a fixture row set → expected counts/tallies/freshness flag;
a guard test that a non-admin email yields `notFound()`.

---

## 8B — Personalisation wizard

### Decision B (approved): posture layer + optional score lens

The wizard's answers drive a **posture layer by default** (where the user's posture legitimately
applies), and the category reweighting ships as an **explicitly-labelled, off-by-default lens**.
The default Quality score every user sees stays the objective resilience score.

Rationale (recorded so it is not relitigated): the Quality score is gated + signal-sparse (only
~4 names scored, each on 1-2 surviving signals), so reweighting moves few names modestly
(worked example: PEP 81 -> ~87 for an income/cautious/retired profile). More importantly,
reweighting an *objective resilience* score per user goal reintroduces the per-user buy framing
the reframe deliberately dropped, and the backtest work already found a-priori weight rebalancing
fails out-of-sample (`project_buy_score_backtest_artifact`). So personalise where posture is real
(reinvest, action hints, copy) and make the score lens opt-in.

### Data

`user_preferences` (0004) — no migration. Columns: `primary_goal`, `investing_horizon`,
`risk_appetite`, `reinvest_default`, `sectors_to_avoid text[]`, `annual_income_target_gbp`,
`wizard_completed_at`, `wizard_skipped_at`, `wizard_last_reviewed_at`, `updated_at`.

### `/api/preferences`

`app/api/preferences/route.ts` — `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- `GET` → the caller's row (or null). `auth.getClaims().sub`; RLS self-policy enforces ownership.
- `POST`/`PUT` → upsert answers; validate every field against the table's CHECK constraints
  before write; stamp `wizard_completed_at` on submit or `wizard_skipped_at` on skip; set
  `updated_at`. Reject unknown enum values (do not rely on the DB error).
- Route test mocks `@/lib/supabase/server`; asserts validation + 401 on no session.

### Wizard UI

`<PersonalisationWizard>` (base-ui dialog, same stack as `ScoreDrawer`). 6 questions = the 6
answer columns, one per step, all skippable:
1. primary_goal (income_now / total_return / safety_stability / undecided)
2. investing_horizon (lt_5y / 5_10y / 10y_plus / already_retired / undecided)
3. risk_appetite (cautious / balanced / aggressive / undecided)
4. reinvest_default (always_drip / look_for_opportunities / withdraw_cash / undecided)
5. sectors_to_avoid (multi-select text[])
6. annual_income_target_gbp (optional number, GBP)

**Placement (Decision approved): first-visit modal.** On the Portfolio Manager page, auto-open
for Pro when the user has neither `wizard_completed_at` nor `wizard_skipped_at` (skippable). A
**"Personalise"** entry in `/app/account` lets anyone revisit; Free reaches the wizard only via
Account (capture-only — Free has no Manager/scores). One shared component for both entry points.

### Posture layer (default, always on)

1. **`sectors_to_avoid` → Reinvest filter.** `loadPortfolioAnalytics` currently passes
   `sectorsToAvoid: []` to `buildReinvestCard`; thread the user's value through instead.
2. **`risk_appetite` + `investing_horizon` → action-hint sensitivity.** Extend
   `actionHint(s, sensitivity?)` in `lib/scoring/chip-display.ts` with an optional threshold
   shift (backward-compatible default = current thresholds 75/50; sensitivity lowers both
   thresholds by its value, so a negative sensitivity warns *earlier*). Derive one int via a
   pure `actionHintSensitivity(prefs)` that **sums** two contributions and clamps to `[−10, +10]`:
   risk_appetite (cautious −5 / aggressive +5 / else 0) + investing_horizon (already_retired −5 /
   lt_5y −5 / 10y_plus +5 / else 0). Examples: cautious + already_retired → −10 (risk 65/40,
   trim 65/40); cautious + 10y_plus → 0; aggressive + 10y_plus → +10 (risk 85/60). Action hints
   are about user posture, so tuning them this way is honest (unlike the objective score).
3. **`reinvest_default` + `annual_income_target_gbp` → Reinvest card copy/framing** (no ranking
   change to the recommender logic; copy only).
4. **Full capture** of all answers for cohort segmentation / future features (PostHog event on
   completion).

### Optional score lens (off by default)

- A clearly-labelled **"View scores through my goals"** toggle on the Portfolio Manager page,
  default **off**. Persisted as a lightweight UI preference (client state for v1; no new column).
- When on, the Quality (buy) score is re-aggregated at render time via a real `applyUserWeights`.
- **Re-aggregation (`lib/scoring/reaggregate.ts`, pure):** from the latest `equity_score_signals`
  buy rows, group by category (signal_code prefix A/B/C/D), reconstruct each category aggregate
  = `Σ(raw_score×weight) / Σ(weight)` over available signals, then
  `final = Σ catAgg × (userCatWeight / Σ available userCatWeights)`, round, clamp 0-100.
- **User category weights:** base `{A:.35, B:.30, C:.20, D:.15}` + additive deltas per answer
  (goal/horizon/risk), each category clamped to `[0.05, 0.55]`, renormalised to sum=1:

  | Answer | A Val | B Tech | C Sent | D Div |
  |---|---|---|---|---|
  | goal=income_now | +0.05 | −0.10 | −0.05 | +0.10 |
  | goal=total_return | +0.05 | +0.08 | +0.02 | −0.10 |
  | goal=safety_stability | +0.10 | −0.08 | −0.05 | +0.03 |
  | horizon=10y_plus | +0.08 | −0.08 | 0 | 0 |
  | horizon=lt_5y / already_retired | −0.05 | +0.03 | 0 | +0.05 |
  | risk=aggressive | −0.05 | +0.08 | +0.05 | −0.05 |
  | risk=cautious | +0.08 | −0.05 | −0.05 | 0 |

  `undecided`/null → no delta. **Trim and Risk are never reweighted** (defensive scores stay as
  computed). Lens shows a "tuned to your goals · reset" affordance; trim/risk chips unaffected.

### Tests (TDD)

- `actionHintSensitivity(prefs)` mapping; `actionHint` with each sensitivity shift.
- `reaggregate`: fixture signals + a known weight set → exact expected score; clamp/renormalise
  edge cases (all-undecided → base; one category collapsed; weights hit the clamp floor/ceiling).
- `/api/preferences` validation + auth.
- `<PersonalisationWizard>` RTL: renders 6 steps, skip path stamps skipped, submit calls API.
- Reinvest filter: `sectors_to_avoid` actually excludes a candidate (extend existing card tests).

### Compliance / copy

No Buy/Sell/Recommend. "Not financial advice" on the wizard and anywhere the lens appears. The
lens label avoids implying the personalised number is "better" — it is "your weighting lens",
the objective score remains primary. Humaniser `--strict` audit on every new string.

---

## Public `/scoring` pages (planned this session, built next session)

Decisions captured (Decision C — approved): anonymous shows **numeric Quality/Risk/Trim + a
one-line plain-English summary + the resilience framing** (real indexable content); the
**per-signal breakdown + score history are gated to Pro**. ISR `revalidate: 3600`. The
anonymous IP rate-limit **mechanism is deferred to build day** (lean toward an in-memory/edge
limiter for v1 — no Upstash dependency yet; ISR means most hits are cached static anyway).

Planned surface (to be detailed in the next-session plan):
- `app/(public)/scoring/page.tsx` — ticker search/index. Indexable.
- `app/(public)/scoring/[ticker]/page.tsx` — ISR (`revalidate: 3600`), `generateMetadata`
  (title/description/canonical), JSON-LD that describes the page **without** asserting a
  recommendation, "Not financial advice" prominent. Anonymous teaser (numbers + summary + frame);
  Pro+ sees the breakdown drawer + history (reuse `ScoreDrawer`, gate by tier from `profiles`).
- Reuse the existing public `GET /api/scoring/[ticker]` + `equity_score_signals` read.
- Add both routes to `sitemap`. Run `nextjs-seo-aeo-audit` on the new pages.
- Rate-limit: pick mechanism at build (in-memory/edge limiter v1; document the multi-instance
  caveat). No Upstash until Phase 3.
- Compliance: the public SEO surface carries the strongest "resilience check, not advice"
  framing; humaniser + a careful read of every public string.

---

## Decision log

- **A. Sequencing** — Audit (8A) → Wizard (8B) in Day 8; public pages planned-only. (Approved.)
- **B. Wizard impact** — posture layer (reinvest filter + action-hint sensitivity + reinvest
  copy + capture) by default; category reweighting as an off-by-default opt-in lens. The
  objective Quality score is not reweighted by default. (Approved after critique — see rationale.)
- **B2. Placement** — first-visit modal on Manager (Pro) + Account entry (all, incl. Free
  capture-only). (Approved.)
- **C. Public pages** — numbers + summary public, breakdown/history Pro-gated; ISR 3600;
  rate-limit mechanism deferred to build day. (Approved.)
- **D. Admin audit** — read-only v1 fields as listed; `isAdmin` email-gated (exists); route
  `/app/admin/scoring/audit`. (Approved.)

## Out of scope (parked)

Deferred engine changes (GATE_1 carve-out, GATE_6, A4) on `phase-2.75-backtest`; the flagged
GATE_4 spurious-fire + `annualDividend` semi-annual fixes (engine-frozen); Phase 3 DDM (NO-GO)
and T212 sync; notification prefs + alert emails + 23:00 cron (Day 9); watchlist (polish);
"Save idea" real destination; the local Analyst Dashboard (separate workstream).
