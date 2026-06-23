# Phase 4 Sprint 2 — Day 12 spot-check matrix

**Run date.** 2026-06-23
**Driver.** `dividendmapper/scripts/scoring/score-vehicle-anchors.ts` (computes via `computeVehicleScore` directly against live Supabase + FMP, bypasses the cron route).
**Universe.** 10 anchor tickers — 4 US REIT (O, PLD, AMT, SPG), 3 US BDC (ARCC, MAIN, OBDC), 3 UK REIT (BLND.L, LAND.L, SGRO.L).
**Output.** `.scoring-cache/anchor-scores.json` (10 entries, gitignored).

## Summary

| ticker  | family   | resilience | gate     | failed gates | dataQuality | priceNavRatio |
|---------|----------|------------|----------|--------------|-------------|---------------|
| O       | us_reit  | **null**   | fail     | G_R2         | full        | 1.26          |
| PLD     | us_reit  | 70         | pass     | —            | full        | 1.69          |
| AMT     | us_reit  | 67         | pass     | —            | full        | 9.69          |
| SPG     | us_reit  | 72         | pass     | —            | full        | 8.03          |
| ARCC    | us_bdc   | **null**   | fail     | G_B1         | full        | 1.09          |
| MAIN    | us_bdc   | 67         | pass     | —            | full        | 1.70          |
| OBDC    | us_bdc   | **null**   | fail     | G_B2         | full        | 1.01          |
| BLND.L  | uk_reit  | **null**   | fail     | G_U2         | full        | 0.67          |
| LAND.L  | uk_reit  | 71         | pass     | —            | full        | 0.71          |
| SGRO.L  | uk_reit  | **null**   | fail     | G_U2         | full        | 0.78          |

5 passed (PLD 70, AMT 67, SPG 72, MAIN 67, LAND.L 71). 5 gate-failed. All 10 reached `dataQuality: full` — assembly pipeline works end-to-end across the three families.

## Calibration findings — for Day 13

### CAL-1 — R_S1 false-cut detection in 2025

**Affected.** O ("cut 2024 6%"), OBDC ("cut 2025 9%"), BLND.L ("cut 2022 9%"), SGRO.L ("cut 2025 8%").

**Symptom.** Five of five R_S1-fired tickers cite year totals that *should not* indicate a cut. O is a Dividend Aristocrat; SGRO has been on a multi-year hike; BLND's 2022 was a known recovery year.

**Hypotheses** (in likely order):
1. **O / OBDC:** specials inflating prior-year totals when `excludeSpecials=false` (the default for R_S1 on REITs and the gate-input cut detection). The fix is to flip `excludeSpecials=true` for the gate-input on US REIT and US BDC alike, so the cut detection works against regular distributions only.
2. **BLND.L 2022:** UK REIT semi-annual ex-dates sometimes straddle calendar years, so calendar-year aggregation produces a one-year dip. Mitigation: drop the leading calendar year from the comparison when its payment count is < the prior year's modal count.
3. **SGRO.L 2025:** if FMP's dividend history under-counts 2025 payments at the moment the cron runs, the calendar-year aggregation in R_S1 sees a "cut". Same mitigation as (2).

**Day 13 action.** Patch `vehicle-assemble-inputs.ts` to:
- Pass `excludeSpecials=true` to the gate-input cut detection on all three families (G_R2, G_B2, G_U2). The R_S1 *display* signal can stay `excludeSpecials=false` for transparency.
- Drop the latest year from the comparison when its payment count is < 80% of the modal prior-year count.

Re-run anchors after the patch — target: O, SGRO.L, BLND.L all pass G_R2/G_U2.

### CAL-2 — ARCC G_B1 false-fire (NII coverage 0.81×)

**Symptom.** ARCC is the bellwether BDC with one of the most well-covered dividends in the sector. NII coverage < 0.95 indicates the field combo `totalInterestIncome - totalOperatingExpenses` is missing components.

**Hypotheses.**
1. ARCC's income statement uses `netInvestmentIncome` directly. Our fallback chain reads `totalInterestIncome` first; if that's reported gross and `totalOperatingExpenses` includes management fees that are netted out of NII, we under-state NII.
2. Other income (dividend income from equity stakes) isn't in `totalInterestIncome`.

**Day 13 action.** Add a probe to `vehicle-assemble-inputs.ts` BDC path: read `netInvestmentIncome` if present, else fall back to `(totalInvestmentIncome - totalOperatingExpenses)`, else the current chain. Document the field choice in the file header. Re-run ARCC — target: NII coverage ≥ 1.0×.

### CAL-3 — Q_S1 streak underweighting recent recoveries

**Symptom.** PLD (17y) and ARCC (17y) score 68. AMT (15y) scores 63. SPG (6y) scores 30. The 5-band [0,5,10,20,25] table compresses 6-9y streaks into the [0,5y]→[5,10y] band's low end. Glenn may want a flatter score curve for long streaks.

**Day 13 action.** Light recalibration only if the 5y→25 / 10y→50 bands feel too penal once the full cron run completes. Not blocking; can defer to V1.1.

### CAL-4 — Property HHI is 0 (concentrated) for too many US REITs

**Symptom.** O, PLD, AMT, SPG all score 0 on C_R1 — HHI ≥ 6000. PLD's 8743 is partially deserved (logistics-heavy); SPG's 10000 (single segment "rental income") suggests FMP returns the income statement total as one bucket, not actual property segmentation.

**Day 13 action.** Probe FMP for SPG / PLD `revenue-product-segmentation` — confirm what the buckets look like. If FMP truly returns one bucket for these, C_R1 should cascade (null) rather than score 0. Likely fix: treat a single-bucket response as "no segmentation data" and cascade.

### CAL-5 — R_B1 yield drift consistently fires on BDCs

**Symptom.** ARCC 3.7pp, MAIN 16.1pp, OBDC 15.0pp drift. The 16pp + 15pp figures are implausible — that would indicate near-doubling of portfolio yields, which didn't happen.

**Hypothesis.** Our "prior interest income" is sourced from the oldest stored fundamentals row (≈ 2-year-back), and "prior debt investments" comes from the same. If the field reads were stale or the dates misaligned, the ratio is computed from mismatched periods.

**Day 13 action.** Either tighten the 3y-prior lookup (fetch annual instead of quarterly) or cascade R_B1 to null when fewer than 12 quarters of fundamentals are stored. The latter is the safer V1 move.

### CAL-6 — D_S1 directionality for high P/NAV tickers

**Symptom.** AMT priceNavRatio 9.69 → D_S1 = 55 ("fair"). AMT is a tower REIT where book NAV is meaningless (telecom infrastructure trades on FFO multiples, not NAV). The ratio is technically correct but not signal-bearing for this sub-sector.

**Day 13 action.** Not a calibration item, but documentation point — D_S1 is unreliable for cell tower REITs (AMT, CCI, SBAC) and possibly data center REITs. Flag in the methodology copy when those names hit production.

## Gate-failed list defensibility

| ticker | gate  | failure cited                  | defensible? |
|--------|-------|--------------------------------|-------------|
| O      | G_R2  | cut 2024 6%                    | **NO**      — calibration CAL-1 |
| ARCC   | G_B1  | NII coverage 0.81×             | **NO**      — calibration CAL-2 |
| OBDC   | G_B2  | regular cut 2025 9%            | maybe       — OBDC did cut supplementals; need to confirm base unchanged. CAL-1 may resolve. |
| BLND.L | G_U2  | cut 2022 9%                    | **NO**      — calibration CAL-1 |
| SGRO.L | G_U2  | cut 2025 8%                    | **NO**      — calibration CAL-1 |

Headline: every gate fail except (possibly) OBDC traces back to two known calibration items.

## Methodology — how to extend the spot-check

1. Add tickers to `ANCHORS` in `scripts/scoring/score-vehicle-anchors.ts`.
2. Run `npx tsx scripts/scoring/score-vehicle-anchors.ts` from `dividendmapper/`. ~10s per ticker (single FMP fetch chain).
3. Output lands in `.scoring-cache/anchor-scores.json`.
4. Hand-verify each ticker:
   - Q_R1 / Q_B1 / Q_U1 — confirm the TTM ratio against the latest 10-K/annual.
   - Q_R2 / C_B1 / Q_U2 — confirm leverage from the latest balance sheet.
   - C_R1 / C_R2 — confirm segmentation buckets in the segments table.
   - D_S1 — sanity-check P/NAV ratio against an investor-relations factsheet.
   - R_S1 / R_B2 / R_U1 — confirm cut absence against the dividend history page.
5. Flag any signal where the engine and hand-calc differ by ≥ 5 points.

## What was NOT done in this run

- Did not invoke the production cron route (would have persisted to `vehicle_scores` etc; left to Glenn after the CAL-1 / CAL-2 fixes ship).
- Did not score the full ~91 V1 universe — only the 10 anchor names, to keep the diagnostic surface tight.
- Did not run the Sprint 2 Verify SQL block — gated on a full cron run.
