# FMP Vehicle Coverage Matrix (Phase 4 pre-flight)

_Generated 2026-06-19T11:08:14.157Z via scripts/scoring/fmp-vehicle-coverage-matrix.js_

Probes the FMP `/stable/` endpoints needed to compute Phase 4 Resilience Score across US equity REITs, US BDCs, and UK REITs. See `planning/08-phase-4-income-vehicle-scoring.md` Open Question 1.

## Gate decision

| Family | Critical cells | Full | % | Gate (≥80%) |
|---|---|---|---|---|
| us_reit | 104 | 102 | 98.1% | ✅ PASS |
| us_bdc | 80 | 80 | 100% | ✅ PASS |
| uk_reit | 88 | 72 | 81.8% | ✅ PASS |

- **All families PASS:** proceed to Sprint 1 Day 1 (universe lock + migration 0014).
- **Any family FAIL:** escalate to Glenn. Options: drop the family from V1, shrink the universe to only well-covered tickers, or add a supplementary data source for that family before Sprint 1.

## Signal-critical field spot checks

Endpoint coverage `full` does not guarantee that the specific field used by a signal is populated. Spot-checks below confirm one representative field per family.

| Family | Ticker | Endpoint | Field | Present | Reason needed |
|---|---|---|---|---|---|
| us_reit | O | cash-flow-a | `depreciationAndAmortization` | ✅ yes | FFO = NI + D&A − gains |
| us_reit | O | income-statement-a | `interestExpense` | ✅ yes | R_R1 interest cover |
| us_bdc | ARCC | income-statement-a | `interestIncome` | ✅ yes | BDC NII proxy (investment income) |
| us_bdc | ARCC | balance-sheet-a | `totalDebt` | ✅ yes | C_B1 statutory leverage |
| uk_reit | BLND.L | balance-sheet-a | `totalDebt` | ✅ yes | Q_U2 LTV numerator |
| uk_reit | BLND.L | balance-sheet-a | `propertyPlantEquipmentNet` | ✅ yes | LTV denominator proxy (FMP real estate field varies) |

## us_reit — full coverage matrix

| Endpoint | O | PLD | AMT | EQIX | WELL | SPG | EQR | EXR |
|---|---|---|---|---|---|---|---|---|
| **profile** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **dividends** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **historical-eod** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ratios-ttm** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **income-statement-a** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **income-statement-q** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **balance-sheet-a** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **balance-sheet-q** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **cash-flow-a** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **key-metrics-ttm** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **enterprise-values-a** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **revenue-product-segmentation** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **revenue-geographic-segmentation** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚪ | ⚪ |

_Endpoints in **bold** are critical for this family's signals; non-critical rows are shown for completeness._

## us_bdc — full coverage matrix

| Endpoint | ARCC | MAIN | OBDC | HTGC | GBDC | BXSL | FSK | PSEC |
|---|---|---|---|---|---|---|---|---|
| **profile** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **dividends** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **historical-eod** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ratios-ttm** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **income-statement-a** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **income-statement-q** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **balance-sheet-a** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **balance-sheet-q** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| cash-flow-a | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **key-metrics-ttm** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **enterprise-values-a** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| revenue-product-segmentation | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ |
| revenue-geographic-segmentation | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ |

_Endpoints in **bold** are critical for this family's signals; non-critical rows are shown for completeness._

## uk_reit — full coverage matrix

| Endpoint | BLND.L | LAND.L | SGRO.L | UTG.L | BBOX.L | PHP.L | DLN.L | GPE.L |
|---|---|---|---|---|---|---|---|---|
| **profile** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **dividends** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **historical-eod** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ratios-ttm** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **income-statement-a** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| income-statement-q | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **balance-sheet-a** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| balance-sheet-q | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **cash-flow-a** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **key-metrics-ttm** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **enterprise-values-a** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **revenue-product-segmentation** | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ |
| **revenue-geographic-segmentation** | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ |

_Endpoints in **bold** are critical for this family's signals; non-critical rows are shown for completeness._

## Endpoint legend

| Endpoint | Purpose | Critical for |
|---|---|---|
| `profile` | sector classification + currency | us_reit, us_bdc, uk_reit |
| `dividends` | Q_S1 streak, R_S1 cut, R_B2 special-vs-regular | us_reit, us_bdc, uk_reit |
| `historical-eod` | D_S1 Price/NAV (price half) | us_reit, us_bdc, uk_reit |
| `ratios-ttm` | payout ratio, interest cover, debt ratios | us_reit, us_bdc, uk_reit |
| `income-statement-a` | revenue, interest expense, NII (BDC), FFO components (REIT) | us_reit, us_bdc, uk_reit |
| `income-statement-q` | quarterly cadence for US tickers (UK semi-annual) | us_reit, us_bdc |
| `balance-sheet-a` | debt, equity, NAV/share (all), property assets (UK LTV) | us_reit, us_bdc, uk_reit |
| `balance-sheet-q` | quarterly NAV trend (US) | us_reit, us_bdc |
| `cash-flow-a` | depreciation (FFO proxy for REITs) | us_reit, uk_reit |
| `key-metrics-ttm` | ROE, debt/equity, book value per share | us_reit, us_bdc, uk_reit |
| `enterprise-values-a` | net debt, market cap snapshots | us_reit, us_bdc, uk_reit |
| `revenue-product-segmentation` | C_R1 / C_U1 property-type HHI | us_reit, uk_reit |
| `revenue-geographic-segmentation` | C_R2 / C_U2 geographic HHI | us_reit, uk_reit |

Classification: ✅ full · ⚪ empty · 🚫 blocked (subscription gate) · ❌ error/HTTP-failure.
