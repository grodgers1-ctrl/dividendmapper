# FMP Coverage Matrix

_Generated 2026-05-29T09:47:14.608Z via scripts/scoring/fmp-coverage-matrix.js_

| Endpoint | AAPL | MSFT | SCHD | JEPI | ULVR.L | LGEN.L | VOD.L | IMB.L | BATS.L | GSK.L |
|---|---|---|---|---|---|---|---|---|---|---|
| ratios-ttm | ✅ full | ✅ full | ⚪ empty | ⚪ empty | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full |
| dividends | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full |
| income-statement-q | ✅ full | ✅ full | ⚪ empty | ⚪ empty | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full |
| cash-flow-q | ✅ full | ✅ full | ⚪ empty | ⚪ empty | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full |
| balance-sheet-q | ✅ full | ✅ full | ⚪ empty | ⚪ empty | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full |
| profile | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full |
| analyst-estimates | ✅ full | ✅ full | ⚪ empty | ⚪ empty | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full |
| discounted-cash-flow | ✅ full | ✅ full | ⚪ empty | ⚪ empty | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full |
| levered-dcf | ✅ full | ✅ full | ⚪ empty | ⚪ empty | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full |
| sma-200 | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full |
| historical-eod | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full |
| rsi-14 | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full |
| price-target-consensus | ✅ full | ✅ full | ⚪ empty | ⚪ empty | ⚪ empty | ⚪ empty | ⚪ empty | ⚪ empty | ⚪ empty | ⚪ empty |
| grades | ✅ full | ✅ full | ⚪ empty | ⚪ empty | ✅ full | ⚪ empty | ✅ full | ✅ full | ✅ full | ✅ full |
| insider-trading | ✅ full | ✅ full | ⚪ empty | ⚪ empty | ⚪ empty | ⚪ empty | ⚪ empty | ⚪ empty | ⚪ empty | ⚪ empty |
| search | ❌ error | ❌ error | ❌ error | ❌ error | ❌ error | ❌ error | ❌ error | ❌ error | ❌ error | ❌ error |

## Gate decision

- LSE coverage: **77/96 cells (80.2%)** — gate threshold 60% → ✅ PASS
- US coverage: 40/64 cells (62.5%)

**If LSE PASS:** proceed to Day 1 afternoon (schema + cron + FMP client).
**If LSE FAIL:** STOP. Escalate to Glenn. Options: ship US-only, accept degradation matrix, or abort FMP swap and keep EODHD.
