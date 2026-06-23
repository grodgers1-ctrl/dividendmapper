# Phase 4 Sprint 2 — Day 12/13 spot-check matrix

**Run date.** 2026-06-23
**Driver.** `dividendmapper/scripts/scoring/score-vehicle-anchors.ts` (computes via `computeVehicleScore` directly against live Supabase + FMP, bypasses the cron route).
**Universe.** 10 anchor tickers — 4 US REIT (O, PLD, AMT, SPG), 3 US BDC (ARCC, MAIN, OBDC), 3 UK REIT (BLND.L, LAND.L, SGRO.L).
**Output.** `.scoring-cache/anchor-scores.json` (10 entries, gitignored).

## Summary — after Day 13 calibration

| ticker  | family   | resilience | gate     | failed gates | dataQuality | priceNavRatio |
|---------|----------|------------|----------|--------------|-------------|---------------|
| O       | us_reit  | 35         | pass     | —            | full        | 1.26          |
| PLD     | us_reit  | 70         | pass     | —            | full        | 1.69          |
| AMT     | us_reit  | 67         | pass     | —            | full        | 9.69          |
| SPG     | us_reit  | 72         | pass     | —            | full        | 8.03          |
| ARCC    | us_bdc   | 60         | pass     | —            | full        | 1.09          |
| MAIN    | us_bdc   | 67         | pass     | —            | full        | 1.70          |
| OBDC    | us_bdc   | **null**   | fail     | G_B1         | full        | 1.01          |
| BLND.L  | uk_reit  | 59         | pass     | —            | full        | 0.67          |
| LAND.L  | uk_reit  | 71         | pass     | —            | full        | 0.71          |
| SGRO.L  | uk_reit  | 59         | pass     | —            | full        | 0.78          |

**9 of 10 pass after calibration** (up from 5 of 10 before). All 10 reach `dataQuality: full`. Gate-failed list: OBDC G_B1 only — NII coverage 0.87× of regular DPS, which is below the 0.95 threshold and reflects Blue Owl's well-documented earnings pressure through 2025. Defensible.

## What changed on Day 13

### CAL-1 ✅ — R_S1 false-cut detection

Two patches:
- **Modal-normalised cut comparison.** `hasDividendCutInLast5Years` now compares `mode(amount) × mode(count_per_year)` rather than raw sums. Stray 13th payments and one-off catch-up amounts no longer inflate a year's baseline.
- **Partial-year guard.** Drops the trailing calendar year from the comparison when its payment count is < 80% of the prior year's count. Catches the case where the in-progress current year + previous semi-annual year are both in window with different completeness.

Both fixes apply to the gate-input cut detection (G_R2, G_B2, G_U2). The gate-side also moves to `excludeSpecials=true` for all three families so prior-year supplementals don't inflate the comparison baseline.

The display-side R_S1 signal still uses raw sums (so the per-signal breakdown is transparent about what FMP returned), which means it can still report a "cut" even when the gate passes. For O specifically, this is what drives the surprisingly low 35 composite: the gate sees no genuine cut, but R_S1 displays a 6% calendar-year drop from FMP's quirky 2023 dividend count.

### CAL-2 ✅ — ARCC NII derivation

Probed FMP's `income-statement` for ARCC at the start of Day 13 — `netInvestmentIncome` is not exposed for ARCC under that name, but `operatingIncome` exactly matches the manual NII calc ($404M × 4 / 718M shares ≈ $2.25/share TTM vs reported DPS ≈ $1.92 → coverage ≈ 1.17×). Updated the BDC assembly chain:

1. `operatingIncome` (preferred — present for ARCC, MAIN, OBDC)
2. `netInvestmentIncome` (used when FMP labels it directly — some smaller BDCs)
3. `revenue − costOfRevenue − operatingExpenses` (final arithmetic fallback)
4. `totalInterestIncome − operatingExpenses` (test-fixture compatibility)

ARCC now scores 60 (gate pass with NII coverage 1.05×).

### Lower-priority items NOT addressed in Sprint 2

- **CAL-3 — Q_S1 streak banding.** Q_S1 uses raw sums and is vulnerable to the same FMP quirks as R_S1. For O, the streak now reads "2y" rather than the actual ~30y track record. Same modal-normalisation fix would apply but it requires updating the signal tests; deferred to V1.1.
- **CAL-4 — C_R1 single-bucket cascade.** O / SPG show HHI 10000 because FMP returns a single "rental income" bucket rather than property-type segmentation. Should cascade rather than score 0. Deferred.
- **CAL-5 — R_B1 yield drift noise.** MAIN reports +16pp drift, ARCC +3.7pp. The current "prior" anchor is the oldest stored fundamental row, which can be 2y back not 3y. Tightening the lookup is a V1.1 fix.
- **CAL-6 — D_S1 directionality for tower REITs.** AMT P/NAV 9.69 is technically correct but not meaningful — tower REITs trade on FFO multiples, not book NAV. Methodology copy will flag this at the per-ticker page.

## Gate-failed list defensibility — post calibration

| ticker | gate  | failure cited                   | defensible? |
|--------|-------|---------------------------------|-------------|
| OBDC   | G_B1  | NII coverage 0.87× regular DPS  | **YES**     — matches Blue Owl's earnings pressure through 2025 |

## What was NOT done

- Did not invoke the production cron route or persist to `vehicle_scores` (left to Glenn after this PR ships).
- Did not score the full ~91 V1 universe — only the 10 anchor names, to keep the diagnostic surface tight.
- Did not run the Sprint 2 Verify SQL block — gated on a full cron run.
- Did not patch Q_S1 / R_S1 signal-display behaviour (CAL-3); only the gate-input path was hardened.

## Methodology — re-running the spot-check

1. Edit `ANCHORS` in `scripts/scoring/score-vehicle-anchors.ts` to add or remove tickers.
2. From `dividendmapper/`:
   ```sh
   npx tsx scripts/scoring/score-vehicle-anchors.ts
   ```
   ~10s per ticker (one FMP fetch chain each). Writes `.scoring-cache/anchor-scores.json`.
3. Hand-verify each ticker:
   - Q_R1 / Q_B1 / Q_U1 — confirm the TTM ratio against the latest 10-K / annual report.
   - Q_R2 / C_B1 / Q_U2 — confirm leverage from the latest balance sheet.
   - C_R1 / C_R2 — confirm segmentation buckets in the segments table.
   - D_S1 — sanity-check P/NAV ratio against an investor-relations factsheet.
   - R_S1 / R_B2 / R_U1 — confirm cut absence against the dividend history page.
4. Flag any signal where the engine and hand-calc differ by ≥ 5 points.
