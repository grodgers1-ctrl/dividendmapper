# Phase 4 Sprint 2 — Scoring Engine (Days 6–13)

> **For agentic workers:** REQUIRED SUB-SKILLS in order — `superpowers:executing-plans` (this plan), `superpowers:subagent-driven-development` (per-day execution), `superpowers:test-driven-development` (per-task, strict).

**Sprint outcome.** Resilience Score computed daily for every V1 vehicle, persisted to `vehicle_scores` / `vehicle_score_signals` / `vehicle_score_history`. Quality gates enforced per family. 10 spot-checked vehicles match hand calculations. Scoring cron live on dev.

**Branch.** `phase-4/income-vehicle-scoring` (long-lived), worked from a fresh worktree at `.worktrees/phase-4-sprint-2`. Per-day commits inside the worktree. Sprint 2 PR rebased onto current main at end of Day 13.

**Carries over from Sprint 1.** vehicle-fmp.ts, vehicle-persist.ts, vehicle-edgar.ts, migration 0018, ~100 tickers seeded with 241k price rows + 846 fundamentals + 66 EDGAR dates. 91 full / 9 partial coverage.

---

## Pre-flight (Day 5.5 — before Day 6 kicks off)

These three items happen BEFORE Day 6. None is timed; combined wall time ≤ 60 min.

### 1. Glenn — QA `uk-reit-classification.json`

The 25-entry JSON at `dividendmapper/lib/scoring/data/uk-reit-classification.json` was hand-written by Claude during Sprint 1 Day 1. The `propertyType` column is largely derivable from FMP sub_sector (low risk); the `geographicScope` column is the high-judgement piece (uk_only vs overseas_exposed). Glenn to:

- Spot-check every `geographicScope: "overseas_exposed"` entry (SGRO.L, HMSO.L, SAFE.L, PHP.L, SUPR.L, CLI.L, SERE.L) against the company's latest annual report or factsheet.
- Spot-check every `geographicScope: "uk_only"` entry for anything with material non-UK exposure that was missed.
- Fix any wrong calls; add `reviewed_by_glenn: true` to each entry that's been verified.
- Commit the changes on `phase-4/sprint-2-plan` (or a new branch) and merge before Day 6 — `C_U1` + `C_U2` signals read this JSON directly.

If Glenn finds significant misclassifications, escalate before Day 9 — the UK signals depend on this list being trustworthy.

### 2. Agentic worker — worktree setup

Fresh worktree (no carry-over from Sprint 1 worktree — that one was bound to a now-deleted branch):

```bash
cd /c/Users/grodg/dividend_mapper_plan
git fetch origin
git worktree add dividendmapper/.worktrees/phase-4-sprint-2 -b phase-4/sprint-2 origin/main
cd dividendmapper/.worktrees/phase-4-sprint-2/dividendmapper
cmd //C "mklink /J node_modules ..\\..\\..\\..\\dividendmapper\\node_modules"
cmd //C "mklink .env.local ..\\..\\..\\..\\dividendmapper\\.env.local"
npx vitest run lib/scoring/__tests__/vehicle-fmp.test.ts   # baseline — expect 12 passed
```

Sprint 1 verified the junction pattern works; reuse it verbatim. Glenn's parallel sessions touch the main checkout's branch, never the worktree.

### 3. Agentic worker — EDGAR backfill follow-up (optional, ≤ 15 min)

The 9 EDGAR-missing tickers (HTGC, SLRC, GAIN, KIO, SAR, DLR, GLPI, FR, REXR) have null `cik` because FMP's `profile.cik` was null for them. SEC publishes a canonical ticker → CIK mapping at `https://www.sec.gov/files/company_tickers.json` — one fetch, no auth, ~10k entries. Backfill these 9 specifically by adding a `--from-sec-tickers` mode to `scripts/scoring/backfill-vehicle-edgar.mjs`. Optional because the 9 tickers still have full price + fundamentals data; only the `data freshness` badge is affected.

---

## Day 6 — Signal interface + shared signal trio

**Outcome.** Three shared signals (`Q_S1`, `D_S1`, `R_S1`) computed for any ticker against in-memory inputs. Vehicle-signal interface conventions locked. ~12 unit tests.

### Convention: signal file shape

Every Sprint 2 signal exports a pure function `compute<Code><Slug>(inputs)` returning `{ score: number | null, humanLabel: string }`. No FMP fetching, no Supabase, no Sentry. Mirrors the equity engine convention exactly (see `lib/scoring/signals/a1-yield-percentile.ts`). `null` cascades via existing `redistribute-weights.ts`.

File naming: `lib/scoring/signals/<lowercase-code-with-underscore>-<slug>.ts` → `q_s1-streak.ts`, `d_s1-price-nav.ts`, `r_s1-cut.ts`, `q_r1-ffo-payout.ts`, etc. Tests collocated in `lib/scoring/signals/__tests__/`.

### Task 6.1 — `q_s1-streak.ts`

**Files.** `lib/scoring/signals/q_s1-streak.ts` + `lib/scoring/signals/__tests__/q_s1-streak.test.ts`.

**Definition.** Count consecutive years (ending in the most recent complete year) where the ticker paid at least one regular dividend AND total annual dividend ≥ previous year's total. Specials excluded. Streak resets on year-over-year decline > 5%.

**Inputs.** `{ dividends: VehicleDividendRow[] }` — already normalised (GBX→GBP) and ordered date-desc by the caller. Use `VehicleDividendRow` from `lib/scoring/vehicle-fmp.ts` directly.

**Score banding.** 0y → 0; 5y → 25; 10y → 50; 20y → 75; 25y+ → 100. Linear interp between bands.

**TDD steps.**
1. Write failing tests for: monthly payer with 10y clean streak → 50; semi-annual payer with 25y → 100; ticker with a 7% YoY drop 3 years ago → resets, current streak = 3; empty history → `{ score: null, humanLabel: "no dividend history" }`.
2. `npx vitest run lib/scoring/signals/__tests__/q_s1-streak.test.ts` → confirm fails (module missing).
3. Implement. Re-run → green.
4. Commit `Phase 4 Sprint 2 Day 6: Q_S1 streak signal`.

### Task 6.2 — `d_s1-price-nav.ts`

**Files.** `lib/scoring/signals/d_s1-price-nav.ts` + test.

**Definition.** Current price ÷ latest NAV per share. Z-score against the trailing 5y rolling mean ± stdev of the same ratio. Discount score: −2σ or more → 100 (deeply discounted); 0σ → 50 (fair); +2σ or more → 0 (premium).

**Inputs.** `{ currentPrice: number, navPerShare: number, ratioHistory: number[] }`. Caller computes `ratioHistory` from past prices + past NAV (closest period to each price date).

**Edge cases.** `navPerShare ≤ 0` → null (data error). `ratioHistory.length < 60` (≤ 3 months) → return `{ score: 50, humanLabel: "insufficient history" }` (neutral score, allow other signals to drive).

**TDD steps as above.** ~4 tests.

### Task 6.3 — `r_s1-cut.ts`

**Files.** `lib/scoring/signals/r_s1-cut.ts` + test.

**Definition.** Any year-over-year decline > 5% in total annual dividends in the last 5 calendar years. BDC supplementals excluded (covered by `R_B2` separately).

**Inputs.** `{ dividends: VehicleDividendRow[], excludeSpecials: boolean }`. (Excludes irrelevant for REIT/UK; BDC orchestrator passes `excludeSpecials: true`.)

**Score.** 0 if any cut detected (high risk), 100 if clean. Binary — no interpolation. Risk signals are sign-inverted at composite time.

**TDD steps as above.** ~4 tests.

### Day 6 end-of-day checklist

- [ ] 3 signal modules + test files committed (≥ 12 tests, all green)
- [ ] Full scoring suite still green: `npx vitest run --no-file-parallelism lib/scoring/` (expect 53+ files, 374+ tests)
- [ ] No file imports `@supabase/supabase-js` or `fetch` directly — signals are pure
- [ ] Commit: `Phase 4 Sprint 2 Day 6: shared signal trio + interface conventions`

---

## Day 7 — US REIT signals

**Outcome.** Five US-REIT-specific signals (`Q_R1`, `Q_R2`, `C_R1`, `C_R2`, `R_R1`). ~15 tests.

### Task 7.1 — `q_r1-ffo-payout.ts` (quality-gated input — see Day 10)

**Definition.** Dividend per share TTM ÷ FFO per share TTM. FFO = (netIncome + depreciationAndAmortization) ÷ weightedAverageShsOut, summed over trailing 4 quarters. Score: ≤ 70% → 100; 70–85% → 75; 85–95% → 50; 95–100% → 25; > 100% → 0 (also fails `G_R1` gate).

**Inputs.** `{ ttmDps: number, ttmFfoPerShare: number }`.

### Task 7.2 — `q_r2-debt-ebitda.ts`

**Definition.** Net Debt ÷ EBITDA TTM. Net Debt = totalDebt − cashAndShortTermInvestments. Score: ≤ 4× → 100; 4–6× → 75; 6–8× → 50; 8–10× → 25; > 10× → 0.

**Inputs.** `{ totalDebt: number, cash: number, ttmEbitda: number }`.

### Task 7.3 — `c_r1-property-hhi.ts`

**Definition.** Herfindahl-Hirschman Index of revenue by property segment (from FMP `revenue-product-segmentation`). HHI ranges 0–10000 (single segment = 10000). Score: ≤ 1500 → 100 (well diversified); 1500–2500 → 75; 2500–4000 → 50; 4000–6000 → 25; > 6000 → 0.

**Inputs.** `{ segmentShares: number[] }` (decimals summing to 1.0 — caller normalises).

**Cascade.** Empty segment list → `null` + humanLabel `"segment data unavailable"` (`redistribute-weights.ts` re-allocates weight).

### Task 7.4 — `c_r2-geo-hhi.ts`

Same shape as `C_R1` but for geographic segments. Same cascade rule.

### Task 7.5 — `r_r1-int-coverage.ts`

**Definition.** EBITDA TTM ÷ interestExpense TTM. Score: < 2.5× → 0 (high risk, also surfaces in drawer copy); 2.5–4× → 50; > 4× → 100.

**Inputs.** `{ ttmEbitda: number, ttmInterestExpense: number }`. `interestExpense ≤ 0` → `null` (no debt or data error).

### Day 7 end-of-day checklist

- [ ] 5 signal modules + tests committed
- [ ] `npx vitest run lib/scoring/signals/__tests__/q_r1-*.test.ts q_r2-*.test.ts c_r1-*.test.ts c_r2-*.test.ts r_r1-*.test.ts` all green (~15 tests)
- [ ] Commit: `Phase 4 Sprint 2 Day 7: US REIT signals (Q_R1 Q_R2 C_R1 C_R2 R_R1)`

---

## Day 8 — US BDC signals

**Outcome.** Five US-BDC-specific signals (`Q_B1`, `Q_B2`, `C_B1`, `R_B1`, `R_B2`). ~15 tests. The nuanced pieces are statutory leverage proximity (`C_B1`) and special-vs-regular distribution detection (`R_B2`).

### Task 8.1 — `q_b1-nii-coverage.ts` (quality-gated)

**Definition.** NII per share TTM ÷ regular dividend per share TTM. NII per share = (totalInvestmentIncome − totalExpenses) ÷ weightedAverageShsOut. Source: BDC income statements have explicit NII fields; if not direct, derive from `totalInterestIncome` and `totalOtherExpenses` (probe both at task start, document choice).

**Score banding.** < 0.95 → 0 (also fails `G_B1`); 0.95–1.00 → 25; 1.00–1.05 → 50; 1.05–1.15 → 75; ≥ 1.15 → 100.

**Inputs.** `{ ttmNiiPerShare: number, ttmRegularDps: number }`.

### Task 8.2 — `q_b2-nav-trend.ts`

**Definition.** Linear regression slope of `nav_per_share` over the last 12 quarters (3 years). Positive slope = healthy NAV growth; flat = OK; negative = deteriorating book.

**Score banding.** slope ≥ +0.5%/quarter → 100; 0 to +0.5% → 75; −0.5 to 0% → 50; −1.0 to −0.5% → 25; < −1.0% → 0.

**Inputs.** `{ navPerShareHistory: { period_end: string, nav_per_share: number }[] }` (ordered date-asc).

### Task 8.3 — `c_b1-statutory-leverage.ts`

**Definition.** Debt-to-equity (totalDebt ÷ totalEquity) vs the SBCAA-relaxed 2:1 statutory cap (Investment Company Act §61). Score expresses proximity to the cap: ≤ 1.0× → 100; 1.0–1.3× → 75; 1.3–1.5× → 50 (warning zone); 1.5–1.8× → 25; > 1.8× → 0 (approaching cap → forced deleveraging risk).

**Inputs.** `{ totalDebt: number, totalEquity: number }`.

### Task 8.4 — `r_b1-yield-drift.ts`

**Definition.** Trailing-3y change in portfolio yield = (current totalInterestIncome / current debtInvestments) − (3y-prior same ratio). Sharp jumps either way signal credit deterioration or non-accrual masking.

**Score.** |delta| ≤ 1pp → 100; 1–2pp → 75; 2–3pp → 50; 3–4pp → 25; > 4pp → 0. Symmetric on direction.

**Inputs.** `{ currentInterestIncome: number, currentDebtInvestments: number, priorInterestIncome: number, priorDebtInvestments: number }`. Caller pulls "prior" from the fundamentals row closest to today−3y.

### Task 8.5 — `r_b2-special-mix.ts`

**Definition.** Sum of special distributions ÷ sum of regular distributions over the trailing 2 years. > 1.0 in either year signals the regular distribution is under-earning and specials are propping up yield (classic pre-cut pattern).

**Detection.** FMP doesn't label special vs regular directly. Heuristic: regular distributions are the modal-amount payment in a year (e.g. monthly $0.265 for ARCC); anything ≥ 1.5× the modal amount is treated as special. Document this in the file header — it's a heuristic, easily wrong, and we may want EDGAR 8-K parsing in V1.1.

**Score.** ratio ≤ 0.2 → 100; 0.2–0.5 → 75; 0.5–1.0 → 50; 1.0–1.5 → 25; > 1.5 → 0.

**Inputs.** `{ dividends: VehicleDividendRow[] }`.

### Day 8 end-of-day checklist

- [ ] 5 BDC signal modules + tests committed
- [ ] Commit: `Phase 4 Sprint 2 Day 8: US BDC signals (Q_B1 Q_B2 C_B1 R_B1 R_B2)`

---

## Day 9 — UK REIT signals

**Outcome.** Five UK-REIT-specific signals (`Q_U1`, `Q_U2`, `C_U1`, `C_U2`, `R_U1`). ~13 tests. LTV is the key UK-specific computation; classification JSON drives C_U1/C_U2.

### Task 9.1 — `q_u1-epra-cover.ts`

**Definition.** V1 proxy: net rental income (UK REIT income-statement field — probe at task start to confirm FMP exposes it; if not, use revenue − operatingExpenses as second-best) ÷ total dividends paid. V1.1 swaps in EPRA EPS / DPS.

**Score banding.** ≥ 1.20 → 100; 1.10–1.20 → 75; 1.00–1.10 → 50; 0.90–1.00 → 25; < 0.90 → 0.

**Inputs.** `{ ttmNetRentalIncome: number, ttmTotalDividendsPaid: number }`.

### Task 9.2 — `q_u2-ltv.ts` (quality-gated)

**Definition.** Loan-to-Value = totalDebt ÷ totalAssets. Canonical UK REIT leverage metric. Score: ≤ 25% → 100; 25–35% → 75; 35–45% → 50; 45–55% → 25; > 55% → 0 (also fails `G_U1` sector-aware gate at composite time).

**Inputs.** `{ totalDebt: number, totalAssets: number }`.

### Task 9.3 — `c_u1-property-focus.ts`

**Definition.** Binary, from `lib/scoring/data/uk-reit-classification.json` (post-Glenn-QA). `diversified` → 100 (low concentration). `industrial|retail|office|residential|healthcare|self_storage|student|social_housing|supermarket|specialty` → 50 (single-sector concentration, neither penalised nor rewarded — speciality REITs are a deliberate choice).

**Inputs.** `{ propertyType: string }`. Module imports the JSON at module-load time and exports a thin helper `propertyTypeFor(ticker): string | null`.

### Task 9.4 — `c_u2-geo-scope.ts`

**Definition.** Binary from same JSON. `uk_only` → 50 (single-country); `overseas_exposed` → 75 (diversified). Inverted scoring rationale: overseas exposure adds diversification (positive) at cost of FX risk (small negative); net positive.

**Inputs.** `{ geographicScope: string }`.

### Task 9.5 — `r_u1-int-coverage.ts`

**Definition.** Same metric as `R_R1` but tighter threshold reflecting UK REIT lower-gearing convention. EBITDA TTM ÷ interestExpense TTM. < 2.0× → 0; 2.0–3.5× → 50; > 3.5× → 100.

**Inputs.** `{ ttmEbitda: number, ttmInterestExpense: number }`. Note: this could share implementation with `R_R1` via a parameterised threshold. Prefer a thin per-family wrapper that imports `r_r1-int-coverage.ts`'s helper — keeps each file's threshold visible at read time. Document the shared helper at the top of `r_u1-int-coverage.ts`.

### Day 9 end-of-day checklist

- [ ] 5 UK REIT signal modules + tests committed
- [ ] Glenn-QA'd `uk-reit-classification.json` confirmed present in the worktree (pre-flight item 1)
- [ ] Commit: `Phase 4 Sprint 2 Day 9: UK REIT signals (Q_U1 Q_U2 C_U1 C_U2 R_U1)`

---

## Day 10 — Orchestrator + quality gates + composite Resilience

**Outcome.** `compute-vehicle-score.ts` orchestrator that, given a ticker + vehicleType + the fundamentals snapshot, produces a `VehicleScoreResult`. Quality gates enforced. Composite score = quality-gated weighted average of Q/D/C/R categories.

### Task 10.1 — `vehicle-quality-gates.ts`

**Files.** `lib/scoring/vehicle-quality-gates.ts` + test file.

**Definition.** Registry keyed by vehicleType, returning `{ passed: boolean, failedGates: string[] }` given the same inputs the signals consume.

Gates per the phase plan:
- `G_R1`: FFO payout ratio ≤ 100%
- `G_R2`: No dividend cut in last 5y
- `G_B1`: NII coverage ≥ 0.95
- `G_B2`: No regular-distribution cut in last 5y
- `G_U1`: LTV ≤ 50% (sector-aware: industrial REITs ≤ 40%, healthcare/social-housing ≤ 60%; sector → threshold map keyed off `vehicle_universe.sub_sector`)
- `G_U2`: No dividend cut in last 5y

**TDD.** ~10 tests covering each gate + sector-aware UK LTV variations.

### Task 10.2 — `vehicle-assemble-inputs.ts`

**Files.** `lib/scoring/vehicle-assemble-inputs.ts` + test.

**Definition.** Takes raw Supabase rows (`vehicle_universe`, latest `vehicle_fundamentals`, recent `vehicle_prices`, dividend history via `fetchVehicleDividendHistory`) and returns a per-vehicleType input bundle for the signal functions. Mirrors `lib/scoring/assemble-inputs.ts` (the equity engine's equivalent) in shape.

For US REIT/BDC the bundle includes TTM aggregates (sum last 4 quarters from fundamentals). For UK REIT the bundle uses the latest annual / semi-annual row.

### Task 10.3 — `compute-vehicle-score.ts`

**Files.** `lib/scoring/compute-vehicle-score.ts` + test.

**Definition.** Single entrypoint per vehicle:

```ts
export interface VehicleScoreResult {
  ticker: string;
  vehicleType: VehicleType;
  resilienceScore: number | null;       // null when gate fails
  qualityGatePassed: boolean;
  failedGates: string[];
  signals: { code: string; rawScore: number | null; weight: number; contribution: number; humanLabel: string }[];
  dataQuality: 'full' | 'partial' | 'sparse';
}

export async function computeVehicleScore(
  supabase: SupabaseClient,
  ticker: string,
  vehicleType: VehicleType,
): Promise<VehicleScoreResult>;
```

**Flow.**
1. Pull inputs via `vehicle-assemble-inputs.ts`.
2. Run quality gates via `vehicle-quality-gates.ts`.
3. Dispatch signals per vehicleType (shared trio + family-specific 5 = 8 signals).
4. Aggregate Q/D/C/R categories via existing `redistribute-weights.ts` (already vehicle-agnostic per the phase plan).
5. R signals sign-inverted at composite time.
6. If gate failed → `resilienceScore: null`, otherwise rounded composite (0–100).

**TDD.** ~8 tests: one happy path per family (anchor ticker fixture, expected score within ±3 of hand calc); gate-fail returns null; degraded data quality flagged when signals cascade.

### Day 10 end-of-day checklist

- [ ] vehicle-quality-gates.ts, vehicle-assemble-inputs.ts, compute-vehicle-score.ts all committed
- [ ] Spot-check 3 anchors (O, ARCC, BLND.L) — scores plausible vs gut
- [ ] Commit: `Phase 4 Sprint 2 Day 10: orchestrator + quality gates + composite`

---

## Day 11 — Scoring cron + history persistence

**Outcome.** Daily 09:00 UTC cron runs after the price cron (08:00). Persists results to `vehicle_scores` (upsert), `vehicle_score_signals` (append), `vehicle_score_history` (one row per ticker per day).

### Task 11.1 — `app/api/internal/refresh-vehicle-scores/route.ts`

Mirrors `refresh-vehicle-prices/route.ts` exactly. Iterates universe, calls `computeVehicleScore(supabase, ticker, vehicleType)`, persists. Pacing: scoring is CPU-bound, not FMP-bound, so `TICKER_PAD_MS = 0` is fine (but keep the env override for symmetry). Sentry on per-ticker failure.

Response shape: `{ ok, tickerCount, successfulTickerCount, failedTickerCount, scoredCount, gateFailedCount, durationMs }`.

**TDD.** 3 tests (401, happy, partial failure) matching the Sprint 1 route-test pattern.

### Task 11.2 — `vehicle.json` cron registration

Add `{ "path": "/api/internal/refresh-vehicle-scores", "schedule": "0 9 * * *" }`. 09:00 UTC = 1 hour after price cron.

### Task 11.3 — Persistence helpers

Extend `vehicle-persist.ts` with:
- `upsertVehicleScore(sb, result)` — onConflict ticker
- `appendVehicleScoreSignals(sb, rows)` — onConflict (ticker, signal_code, observed_at)
- `appendVehicleScoreHistory(sb, row)` — onConflict (ticker, observed_at), captures `resilience_score` + `price_nav_ratio`

3 unit tests, same stub-supabase pattern as Sprint 1.

### Day 11 end-of-day checklist

- [ ] Route + cron + persistence committed
- [ ] Manually invoke cron on dev: `curl -H "Authorization: Bearer $CRON_SECRET" https://dividendmapper.com/api/internal/refresh-vehicle-scores` (or local equivalent). Confirm summary response, then `select count(*) from vehicle_scores where computed_at::date = current_date` returns ~91 (full+partial tickers).
- [ ] Commit: `Phase 4 Sprint 2 Day 11: scoring cron + persistence`

---

## Day 12 — End-to-end run + spot-check

**Outcome.** All ~100 tickers scored at least once. 10 vehicles hand-checked vs FMP raw data. Calibration gaps logged for Day 13.

### Task 12.1 — Full live scoring run

Invoke the Day 11 cron. Wait for completion. Run the Verify SQL block at the bottom of this plan.

### Task 12.2 — Spot-check matrix

Pick 10 tickers — 4 us_reit (O, PLD, AMT, SPG), 3 us_bdc (ARCC, MAIN, OBDC), 3 uk_reit (BLND.L, LAND.L, SGRO.L). For each:

1. Pull FMP raw via the existing fmp-client / fundamentals snapshot.
2. Hand-compute the 8 signals on paper / in a spreadsheet.
3. Compare to `vehicle_score_signals` rows for the ticker.
4. Tolerate ±3 points difference per signal (rounding); flag anything ≥ 5.

Emit `planning/research/vehicle-scoring-spotcheck.md` with one section per ticker — hand vs engine numbers per signal, and any signed deltas worth investigating.

### Task 12.3 — Quality-gate sanity

Run `select ticker, vehicle_type, failed_gates from vehicle_scores where not quality_gate_passed order by vehicle_type`. The gate-failed list should be **defensible**:

- BDCs trading well below NAV with strained NII coverage (OXSQ, PSEC historically) — expected.
- REITs that have cut in the last 5y — match against known recent cuts (e.g., SPG cut in Apr 2020 → out of 5y window now; AGNC cut 2024).
- UK REITs over LTV 50% — expected for the highly-geared sub-sector (e.g., LXi). Sector-aware threshold should let healthcare/social-housing through up to 60%.

Anything that fails a gate and shouldn't is a Day 13 calibration item.

### Day 12 end-of-day checklist

- [ ] Spotcheck matrix written to planning/research/
- [ ] Gate-failed list defensible
- [ ] Commit: `Phase 4 Sprint 2 Day 12: end-to-end run + spot-check`

---

## Day 13 — Buffer / calibration

**Outcome.** Day 12 findings folded back into signal thresholds or quality gates. No new files — adjustments only.

### Likely calibration work (estimate 1–3 issues per family)

- **FFO payout banding** — historical REIT data may show median FFO payout > 80%, in which case Day 7's banding is too generous. Recalibrate against the actual distribution from `vehicle_fundamentals`.
- **BDC NII heuristic** — `q_b1` may need to use a different field combo (probe FMP's BDC income statements more carefully — some BDCs report NII directly, others require derivation).
- **UK REIT EPRA proxy** — `q_u1` proxy might over- or under-state cover vs published EPRA EPS. Sample-check against 3 UK REITs' annual reports.
- **R_B2 special-mix heuristic** — modal-amount detection might mis-classify on tickers with multiple-rate regular schedules. If misfires > 1, revisit the heuristic.

### Day 13 end-of-day

- [ ] Calibration commits one per issue (small, reviewable diffs)
- [ ] Re-run cron, re-run Verify SQL → results within expected ranges
- [ ] Sprint 2 PR rebased onto current main, opened against main: `gh pr create --base main --head phase-4/sprint-2 --title "Phase 4 Sprint 2 — Scoring Engine"`
- [ ] PR body: Sprint 2 Verify SQL output, gate-failed list, spot-check matrix highlights

---

## Sprint 2 Verify

```sql
-- Per-family scoring breakdown
select vehicle_type,
       count(*) filter (where resilience_score is not null) as scored,
       count(*) filter (where resilience_score is null) as gate_failed
from vehicle_scores group by vehicle_type;
-- expect: majority scored per family, defensible gate-failed list

-- Score distribution
select vehicle_type,
       min(resilience_score) as min_score,
       round(avg(resilience_score)::numeric, 1) as avg_score,
       max(resilience_score) as max_score
from vehicle_scores where resilience_score is not null
group by vehicle_type;
-- expect: each family's average score 50–65, range 0–100 spread

-- Signal coverage — no signal should be universally null
select signal_code,
       count(*) filter (where raw_score is not null) as scored,
       count(*) filter (where raw_score is null) as cascaded
from vehicle_score_signals
where observed_at = current_date
group by signal_code
order by signal_code;
-- expect: scored > cascaded for every signal; C_R2 may show high cascade
--         rate because FMP geographic segmentation is patchy

-- Today's history snapshot exists for all scored tickers
select count(*) from vehicle_score_history where observed_at = current_date;
-- expect: ~91 (matches Sprint 1 coverage matrix full+partial count)
```

## Carry-forward to Sprint 3

- Per-vehicle pages consume `vehicle_score_signals` for the Pro-gated breakdown — Sprint 3 Day 14.
- Q/D/C/R category aggregates surface in the spider chart — pre-compute and store as a JSON column on `vehicle_scores` if Sprint 3 reads it more than once per page render.
- The 9 EDGAR-missing tickers' `data freshness` UX falls back to NULL last_filing_date — Sprint 3 needs a graceful empty state.

## Deferred (NOT this sprint)

- **AFFO normalisation** — V1 trusts FMP's FFO as-reported. V1.1 reconciles against XBRL companyfacts.
- **BDC non-accrual %** — V1.1.
- **REIT debt-maturity wall** — V1.1.
- **EPRA NAV for UK REITs** — V1.1 (replaces book NAV in `D_S1` for UK family).

## References

- Phase plan: [planning/08-phase-4-income-vehicle-scoring.md](../08-phase-4-income-vehicle-scoring.md)
- Sprint 1 shipped: [PR #15](https://github.com/grodgers1-ctrl/dividendmapper/pull/15), [planning/research/vehicle-coverage-sprint1.md](../research/vehicle-coverage-sprint1.md)
- Day-plan format reference: [planning/plans/2026-05-29-phase-2.75-equity-scoring-days-2-9.md](2026-05-29-phase-2.75-equity-scoring-days-2-9.md)
- Existing engine references — orchestrator: `dividendmapper/lib/scoring/compute-buy-score.ts`; signal: `dividendmapper/lib/scoring/signals/a1-yield-percentile.ts`; route: `dividendmapper/app/api/internal/refresh-equity-scores/route.ts`; weight redistribution: `dividendmapper/lib/scoring/redistribute-weights.ts`
- Sprint 1 ingestion: `dividendmapper/lib/scoring/vehicle-fmp.ts`, `vehicle-persist.ts`, `vehicle-edgar.ts`
