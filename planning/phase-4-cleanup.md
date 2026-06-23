# Phase 4 cleanup — deferred items + calibration backlog

Central list of issues to revisit after the V1 launch. Each item is a self-contained patch — none block Sprint 3 or Sprint 4 unless flagged otherwise. Severity reflects user impact after the public pages ship.

**Updated:** 2026-06-23 (post Sprint 2 ship + first full-universe run).

---

## Calibration — signal accuracy

### CAL-3 — Q_S1 streak signal uses raw sums (vulnerable to FMP quirks)
**Severity.** Medium — surfaces wrong streak length on display, doesn't affect the gate.
**Symptom.** O (Realty Income, a Dividend Aristocrat with ~30y growth streak) shows "2y consecutive dividend streak" because FMP returned a stray 13th payment in one calendar year. Same vulnerability affects any monthly payer.
**Fix.** Port the modal-normalisation pattern from Sprint 2 Day 13's `hasDividendCutInLast5Years` into `lib/scoring/signals/q_s1-streak.ts`. Compare `mode(amount) × mode(count)` rather than raw `sum(amount)`. Update the 5 tests in `__tests__/q_s1-streak.test.ts` to reflect modal-normalised behaviour.
**Effort.** ~2 hours.
**Files.** `dividendmapper/lib/scoring/signals/q_s1-streak.ts`, `__tests__/q_s1-streak.test.ts`.

### CAL-4 — C_R1 / C_R2 should cascade when FMP returns a single-bucket response
**Severity.** Low — currently scores 0 for many US REITs that shouldn't be penalised.
**Symptom.** SPG's C_R1 = 0 (Property HHI 10000) because FMP returns one bucket "rental income" rather than property-type segmentation. Currently engine reads that as a single-segment monopoly. Should treat single-bucket as "no segmentation data" and cascade (null).
**Fix.** In `vehicle-assemble-inputs.ts`'s `segmentationShares()` helper, return `[]` when `Object.keys(entry.data).length === 1`. Add a unit test fixture for the single-bucket case.
**Effort.** ~1 hour.
**Files.** `dividendmapper/lib/scoring/vehicle-assemble-inputs.ts`, `__tests__/vehicle-assemble-inputs.test.ts`.

### CAL-5 — R_B1 yield drift uses 2y fundamentals window, not 3y
**Severity.** Low — produces noisy "drift" values for BDCs.
**Symptom.** MAIN reports +16.1pp yield drift, OBDC +15pp — implausible. The "prior" anchor is the oldest stored fundamentals row, which Sprint 1 backfilled at limit=8 (= 2y of quarters). True 3y prior needs limit=12.
**Fix.** Either (a) extend the Sprint 1 backfill to 12 quarters and rerun, or (b) cascade R_B1 to null when `fundamentals.length < 12`. (b) is safer for V1.
**Effort.** ~1 hour for (b); ~4 hours for (a) including a re-backfill.
**Files.** `dividendmapper/lib/scoring/vehicle-assemble-inputs.ts` (for option b).

### CAL-6 — D_S1 misleading for tower / data centre REITs
**Severity.** Low — UX/methodology issue, not an engine bug.
**Symptom.** AMT priceNavRatio = 9.69. Technically correct (price ÷ book NAV per share). But tower REITs trade on FFO multiples, not NAV — book NAV is meaningless for AMT, CCI, SBAC, and (debatably) data centre names like EQIX, DLR.
**Fix.** Either flag in methodology copy at per-ticker page, or cascade D_S1 to null based on sub_sector for `tower` / `data_center`. The latter changes scoring behaviour; methodology copy is safer for V1.
**Effort.** Methodology copy = baked into Sprint 3 Day 18. Sub-sector cascade = ~1 hour if pursued later.

### CAL-7 — BDC G_B1 fires for 60% of universe (likely modal-filter issue)
**Severity.** Medium — too many "no score" cells on `/bdcs` page hurts the product.
**Symptom.** 15 of 25 BDCs fail G_B1 (NII coverage < 0.95). Some are genuine (PSEC, OXSQ historical); most aren't (BCSF, BXSL, FSK, TSLX are well-run names).
**Hypothesis.** `ttmRegularDps` is being inflated because the modal-amount heuristic treats base + supplemental as one "regular" payment. ARCC pattern (base $0.48 + supplemental $0.06) has modal = $0.54, not $0.48 — so the denominator over-counts.
**Fix.** Refine the modal detection in `vehicle-assemble-inputs.ts` `ttmRegularDps()`: when payments in a year cluster into 2 distinct amount tiers (within ±20% of each other), take the LOWER tier as the regular and the upper as supplemental. Add 4–5 BDC fixture tests covering ARCC, MAIN, OBDC patterns.
**Effort.** ~3 hours including probing FMP for 5–8 BDC payment patterns.
**Files.** `dividendmapper/lib/scoring/vehicle-assemble-inputs.ts`, `__tests__/vehicle-assemble-inputs.test.ts`.

---

## V1.1 feature work (from Sprint 2 plan "Deferred" section)

### AFFO normalisation
V1 trusts FMP's FFO as-reported (= netIncome + D&A). V1.1 reconciles against XBRL companyfacts for an AFFO line (subtracts maintenance capex). Probably most accurate via SEC's `data.sec.gov/api/xbrl/companyfacts/CIK{...}.json` endpoint.

### BDC non-accrual %
Surface non-accrual loan share as a new signal. Currently buried inside fundamentals. Likely needs EDGAR 10-Q parsing.

### REIT debt-maturity wall
Concentration of debt maturing in next 24 months. New signal. Pulled from fundamentals' debt schedule (FMP may not expose; falls back to EDGAR).

### EPRA NAV for UK REITs
V1's UK D_S1 uses book NAV per share. Real EPRA NAV is published in each annual report. Manual scrape into a per-ticker JSON, refreshed semi-annually. Improves UK Price/NAV signal materially.

### Q_U1 EPRA EPS upgrade
Sprint 2 ships V1 with `Q_U1 = net rental income / dividends paid` as the proxy. Real EPRA EPS / DPS lives in annual reports — same scrape as EPRA NAV. Sample-check against 3 UK REITs' annual reports first to confirm proxy isn't too generous or too penal.

### R_B2 special-mix heuristic upgrade
Sprint 2 uses the modal-amount filter (≥ 1.5× modal = special). Tied to CAL-7 above. V1.1 may swap in EDGAR 8-K parsing — BDCs file special-distribution announcements as 8-Ks, which would give us labelled data rather than a heuristic.

---

## Data / infra debt

### EDGAR backfill for 9 missing tickers
HTGC, SLRC, GAIN, KIO, SAR, DLR, GLPI, FR, REXR — all have null `cik` in `vehicle_universe` because FMP's `profile.cik` was null for them. Sprint 1 pre-flight item that was skipped as optional. Affects only the "data freshness" badge — scores work fine without it.
**Fix.** Add a `--from-sec-tickers` mode to `scripts/scoring/backfill-vehicle-edgar.mjs` that reads SEC's `company_tickers.json`. One-off run, then UPDATE the 9 rows.
**Effort.** ~2 hours.

### Migration 0017 drop
`scripts/sanity/apply-0017-drop.mjs` is sitting untracked at the repo root since before Sprint 2 started. Confirm with Glenn whether this is intentional. If so, either track it or delete it.

### Sprint 1 fundamentals backfill at limit=12
Tied to CAL-5. Sprint 1 stored 8 quarters; storing 12 unlocks true 3y R_B1 drift + better Q_B2 NAV trend window.

---

## Process / docs

### Run `nextjs-seo-aeo-audit` on the new family routes (Sprint 3 Day 20 already)
Not deferred — explicit Day 20 task in Sprint 3 plan. Listed here only for traceability.

### Glenn's QA flag on uk-reit-classification.json
The 25-entry JSON still lacks `reviewed_by_glenn: true` flags. Sprint 1 pre-flight item. Now that vehicle pages are about to surface this data publicly, worth confirming the `overseas_exposed` and `uk_only` calls. Spot-check the 7 overseas_exposed entries (SGRO.L, HMSO.L, SAFE.L, PHP.L, SUPR.L, CLI.L, SERE.L) against the latest annual reports.
**Effort.** ~30 min.
**Files.** `dividendmapper/lib/scoring/data/uk-reit-classification.json`.

### Methodology page (Sprint 3 Day 18) should call out every CAL-* item above as "known limits"
So users see we're honest about what V1 doesn't capture yet. Each CAL- becomes a 1–2 sentence bullet.

---

## Triage — recommended order for V1.1 (post-launch)

1. **CAL-7 BDC modal filter** — biggest user-visible impact (60% BDC blank-out).
2. **CAL-3 Q_S1 streak** — high-visibility wrong number on every monthly payer.
3. **CAL-4 C_R1 single-bucket cascade** — cosmetic but misleading scores.
4. **EDGAR backfill** — small, mechanical.
5. **CAL-5 R_B1 fundamentals window** — option (b) is cheap, do it with CAL-7.
6. **EPRA NAV for UK REITs** — meaningful UK D_S1 upgrade.
7. Everything else as time permits.
