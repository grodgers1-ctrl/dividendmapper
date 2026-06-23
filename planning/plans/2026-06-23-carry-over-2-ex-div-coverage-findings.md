# Carry-over #2 — `next_ex_div_date` coverage gap — findings

**Date**: 2026-06-23
**Status**: Investigated against Glenn's live portfolio. **No code change needed for this carry-over.** Surfaces two real product/data questions for separate scopes.

## What the kickoff suspected

[`planning/plans/2026-06-23-dashboard-carry-overs-kickoff-prompt.md`](2026-06-23-dashboard-carry-overs-kickoff-prompt.md) listed four candidates: (1) FMP coverage gaps, (2) 90-day window too narrow, (3) bundle assembly filtering non-US entries, (4) a `nextUpcomingDividend()` bug. The 23 Jun Explore agent ranked (4) as the most likely cause — specifically an LSE `.L` suffix mismatch — and proposed patching the strict equality at [`lib/scoring/next-dividend.ts:13`](../../dividendmapper/lib/scoring/next-dividend.ts:13).

## What the probe actually found

Probe script: [`scripts/sanity/probe-fmp-dividends-calendar.mjs`](../../scripts/sanity/probe-fmp-dividends-calendar.mjs).

It (a) hit FMP `/stable/dividends-calendar` for 90- and 180-day windows, (b) pulled Glenn's 28 active holdings from Supabase, and (c) compared `equity_scores.next_ex_div_date` against both the calendar and FMP's per-symbol historical endpoint.

**Headline result:**

| Glenn's 28 holdings                                       | Count |
| --------------------------------------------------------- | ----- |
| DB has `next_ex_div_date` (working as designed)           | 1     |
| FMP knows but DB missing — i.e. real cron/scoring bug     | **0** |
| FMP doesn't know either — announce gap or coverage gap    | 27    |

The "real bug" count is zero. Every missing entry in the dashboard's Income Calendar is also missing from FMP's source data.

**Why the kickoff hypotheses don't hold:**

- LSE tickers come back from `/stable/dividends-calendar` **with** the `.L` suffix (probe sample: PHP.L → `2026-07-02`, BATS.L → `2026-07-09`, SSE.L → `2026-07-23`, IMB.L → `2026-08-20`). Glenn's holdings table stores them the same way; `nextUpcomingDividend()`'s strict equality matches correctly. The proposed symbol-normalization patch would be a no-op.
- Widening 90d → 180d adds only 17% more rows market-wide. Not worth the API spend.
- `/stable/dividends?symbol=X` returns the same future-announced dates as the calendar. It is not a richer source.

## Why Glenn's portfolio looks especially thin

Of his 28 tickers, **14 are non-dividend growth/tech names** (ADBE, ARQQ, CRM, DLO, DUOL, FOUR, LAES, MNDY, NU, PYPL, QS, RGTI, TEAM, TOST, WISE.L). Correctly no ex-div data anywhere.

Of the remaining ~14 dividend payers, most are UK trusts / REITs / specialised ETFs (HYSD.L, SMIF.L, SREI.L, TRIG.L, UKRE.L, UKW.L, BME.L, TW.L, W7L.L) plus US BDCs (ARCC, HTGC, AOMR). The probe's `last-historical-date` column came back empty for many of these — consistent with the known FMP coverage gaps for UK trusts and ETFs (see `reference_fmp_coverage_matrix.md` in memory).

So the Income Calendar's emptiness reflects two real things, neither of which is fixable in `lib/scoring/next-dividend.ts`:

1. Many of Glenn's holdings don't pay dividends.
2. For the ones that do, FMP either lacks the ticker entirely (UK trusts/ETFs) or hasn't received the next announcement yet.

## Recommendation

**Close carry-over #2 as investigated, no code change.** The symbol-normalization hypothesis was the right thing to chase, but ground truth disproves it.

## Spawned questions (separate scope, separate kickoffs)

1. **Empty-state UX on the Income Calendar.** Right now a non-dividend ticker shows as zero — looks the same as "we don't know yet". Worth distinguishing "this stock pays no dividend" from "no upcoming ex-div announced" in the card, so the calendar doesn't read as broken when half the portfolio is growth-tech.
2. **UK trust / ETF coverage.** FMP doesn't have many of Glenn's holdings on file at all. Phase 4 (income vehicle scoring) already involves picking up REIT/BDC coverage via EDGAR + FMP — worth sweeping UK trusts (`HYSD.L`, `SREI.L`, `TRIG.L`, `UKRE.L`, `UKW.L`) into that data-infra plan rather than treating it as scoring-engine work.

A **predicted-next-ex-div** feature (project from historical cadence when no announcement exists) would also lift the calendar's coverage, but is a real feature with UI labelling implications — propose treating it as its own kickoff rather than smuggling it into the carry-over sweep.

## Artifacts left behind

- This findings doc.
- [`scripts/sanity/probe-fmp-dividends-calendar.mjs`](../../scripts/sanity/probe-fmp-dividends-calendar.mjs) — runnable any time; reads `dividendmapper/.env.local` for `FMP_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Outputs a per-ticker breakdown + a summary of "real bugs" vs "FMP gap" vs "DB OK".
