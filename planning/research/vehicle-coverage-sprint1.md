# Phase 4 Sprint 1 Coverage Matrix

Generated: 2026-06-23T16:39:54.307Z  Tickers: 100

## Summary by family × data quality

| Family | Full | Partial | Sparse |
|---|---:|---:|---:|
| us_reit | 46 | 4 | 0 |
| us_bdc | 20 | 5 | 0 |
| uk_reit | 25 | 0 | 0 |

## Anchor sanity check

9 anchor tickers (3 per family) must show full data for Sprint 2 to proceed.

| Anchor | Family | Latest period | NAV/sh | Debt | Equity | EBITDA | Int.Exp. | Verdict |
|---|---|---|---:|---:|---:|---:|---:|---|
| O | us_reit | 2026-03-31 | 45.58 | 30.17B | 41.24B | 1,269.35M | 284.97M | ✅ |
| PLD | us_reit | 2026-03-31 | 62.23 | 34.67B | 57.95B | 2,078.58M | 254.29M | ✅ |
| AMT | us_reit | 2026-03-31 | 22.21 | 45.13B | 10.36B | 1,825.2M | 344.4M | ✅ |
| ARCC | us_bdc | 2026-03-31 | 19.59 | 15.85B | 14.07B | 710M | 213M | ✅ |
| MAIN | us_bdc | 2026-03-31 | 34.13 | 2.54B | 3.09B | 89.26M | 34.04M | ✅ |
| OBDC | us_bdc | 2026-03-31 | 14.34 | 8.45B | 7.15B | 111.25M | 133.9M | ✅ |
| BLND.L | uk_reit | 2026-03-31 | 5.93 | 3.11B | 5.93B | 572M | 122M | ✅ |
| LAND.L | uk_reit | 2026-03-31 | 8.8 | 4.5B | 6.54B | 473M | 124M | ✅ |
| SGRO.L | uk_reit | 2025-12-31 | 9.07 | 5.03B | 12.27B | 670M | 93M | ✅ |

## Sparse / partial tickers

| Ticker | Family | Label | Price rows (90d) | Fund fields | EDGAR | Reason hint |
|---|---|---|---:|---:|:---:|---|
| HTGC | us_bdc | partial | 62 | 5/5 | ✗ | no EDGAR filing date |
| SLRC | us_bdc | partial | 62 | 5/5 | ✗ | no EDGAR filing date |
| GAIN | us_bdc | partial | 62 | 5/5 | ✗ | no EDGAR filing date |
| KIO | us_bdc | partial | 62 | 5/5 | ✗ | no EDGAR filing date |
| SAR | us_bdc | partial | 62 | 5/5 | ✗ | no EDGAR filing date |
| DLR | us_reit | partial | 62 | 5/5 | ✗ | no EDGAR filing date |
| GLPI | us_reit | partial | 62 | 5/5 | ✗ | no EDGAR filing date |
| FR | us_reit | partial | 62 | 5/5 | ✗ | no EDGAR filing date |
| REXR | us_reit | partial | 62 | 5/5 | ✗ | no EDGAR filing date |

## Counts query (Sprint 1 verify)

```sql
select vehicle_type, count(*) from vehicle_universe
where included_in_v1 group by vehicle_type;
```

Result this run:

- uk_reit: 25
- us_bdc: 25
- us_reit: 50
