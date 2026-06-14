# Weekly Resilience Digest — design

**Date:** 2026-06-14
**Status:** Approved, ready for implementation plan
**Track:** Phase 3.5 — Track A #1 (the last piece of the alert set; closes the `weekly_digest`
notification enum). See `planning/plans/2026-06-11-phase-3.5-backlog-remaining.md`.

## Summary

An opt-in, Pro-gated **weekly** email that summarises **7-day movement** across a user's holdings
and watchlist tickers. It is a *pure movement recap* — threshold-independent — and is deliberately
different from the existing daily alert (`send-score-alerts`), which is silent unless a score *crosses*
a user-set threshold. The weekly digest answers "here's how my portfolio's resilience drifted this
week", presented as scannable tables and including share-price ± %.

### How it differs from the existing daily alert

| | Daily alert (shipped) | Weekly digest (this spec) |
|---|---|---|
| Send model | Event-driven; silent unless a threshold crosses | Periodic; sends weekly as a recap |
| Comparison | Last two adjacent history rows (≈day-over-day) | Current vs closest snapshot on/before 7 days ago |
| Reported | Threshold crossings only | Any qualifying movement (threshold-independent) |
| Metrics | Resilience + risk scores | Resilience + risk scores **+ share price ± %** |
| Schedule | Daily 07:00 UTC | Sunday 17:00 UTC (own cron) |
| Send key | `${uid}:digest:${date}` | `${uid}:weekly:${isoYearWeek}` |
| Template | `emails/score-alert.tsx` (crossing-worded) | `emails/weekly-digest.tsx` (new) |

## Behaviour

- **Cadence:** Sunday 17:00 UTC, its own weekly cron (`0 17 * * 0`). Independent of the daily 07:00
  alert.
- **Opt-in:** a new `weekly_digest` toggle on `/app/account/notifications`. The enum value already
  exists in `notification_preferences` (migration 0004) — **no migration required**. The toggle has no
  separate threshold (the digest is threshold-independent).
- **Eligibility:** Pro/Premium only (cron skips `tier === 'free'`); skips users whose `paused_until`
  is in the future; honours the existing global unsubscribe token.
- **Inclusion rule (what counts as "moved"):** a ticker appears if, over the window,
  **resilience Δ ≠ 0 OR risk Δ ≠ 0 OR |price Δ%| ≥ 5%**. This captures every meaningful score change
  plus large price swings, while filtering out daily price noise. A ticker that has a current snapshot
  but **no baseline** (added < ~7 days ago, or a history gap) is **silently skipped** until it has a
  week of history — it cannot have a computable delta.
- **Quiet week:** if the user holds/watches tickers but none qualified, **still send** a short
  "all steady this week" note (honours the weekly cadence + reassurance value). If the user has **zero**
  holdings AND **zero** watchlist tickers, **skip** the send entirely (nothing to summarise).

## Layout

Two tables, mirroring the daily email's section structure:

1. **Your holdings** — the user's distinct holding tickers that qualified.
2. **On your watchlist** — qualifying tickers from `watchedNotHeld(tracked, held)` (reuses the existing
   `lib/alerts/watchlist-selection.ts` dedup).

Each row shows all three metrics as current value + delta. Flat metrics render `=`; movers render a
signed delta (scores) or signed percentage (price):

```
YOUR HOLDINGS
Ticker  Resilience   Risk        Price
SHEL    72  +3       41  -2      £28.40  +1.8%
LGEN    55  =        68  =       £2.34   -6.2%

ON YOUR WATCHLIST
Ticker  Resilience   Risk        Price
DGE     61  -4       52  +3      £19.80  -2.1%
```

(A row can qualify on price alone, in which case its score columns show `=`.)

## Data

Read-only over the **frozen scoring engine** — no engine changes. All data from
`equity_score_history` (public-read, indexed `(ticker, observed_at desc)`):

- **Current row:** the latest `observed_at` for the ticker.
- **Baseline row:** the row with the greatest `observed_at` that is **on or before** `today − 7 days`.
  Using on/before (not exactly 7 days) tolerates weekend/holiday snapshot gaps.
- **Metrics:** `buy_score` → resilience, `risk_score` → risk, `current_price` → price.
- **Currency:** the price **% change is currency-agnostic and always shown**. The absolute price uses a
  currency symbol inferred from `equity_scores.ticker_market` (best-effort). Exact GBX-vs-GBP (pence vs
  pounds) handling and the symbol-inference table are an implementation detail to finalise in the plan;
  if currency is uncertain, fall back to the bare number. The % change remains the primary, always-safe
  signal.

## Components

Each unit is isolated, single-purpose, and built test-first (TDD).

1. **`lib/alerts/weekly-digest.ts` (pure, no I/O).** Given a list of per-ticker weekly observations
   (`{ ticker, currResilience, baseResilience, currRisk, baseRisk, currPrice, basePrice, dataQuality }`),
   returns the qualifying movers with computed deltas, or an empty list. Encodes the inclusion rule and
   the noise floor. Mirrors the style of `lib/alerts/build-digest.ts`. Likely shape:
   `selectWeeklyMovers(observations) → Mover[]` where a `Mover` carries the three metric values + their
   deltas + flat/up/down direction per metric. Like the daily digest, it should not emit a mover that
   only moved via a `degraded_uk` data gap (skip `dataQuality === 'degraded_uk'`).

2. **`fetchWeeklyObservations(supabase, tickers, asOfDate)` helper.** Fetches, per ticker, the current
   snapshot and the closest snapshot on/before `asOfDate − 7d`, plus `data_quality` from
   `equity_scores`. New (the existing `buildObservations` only grabs the last two adjacent rows). Lives
   alongside the cron route or in `lib/alerts/`.

3. **`app/api/internal/send-weekly-digest/route.ts` (cron).** `runtime = nodejs`, `maxDuration = 300`.
   Auth `Authorization: Bearer ${CRON_SECRET}`. Steps: load enabled, not-paused `weekly_digest` prefs →
   restrict to Pro/Premium with an email → per user, gather distinct holding tickers + `watchedNotHeld`
   watchlist tickers → `fetchWeeklyObservations` for each set → `selectWeeklyMovers` → render
   `WeeklyDigestEmail` → `sendIdempotent` with `sendKey = ${uid}:weekly:${isoYearWeek}` → on success,
   stamp `last_sent_at` on the `weekly_digest` pref row. Quiet-week + zero-position rules applied before
   send. Errors per-user are caught and sent to Sentry without aborting the batch (same pattern as the
   daily cron).

4. **`emails/weekly-digest.tsx` (new template).** Two metric tables + a quiet-week variant ("all steady
   this week"). Includes the manage-alerts link and unsubscribe link. Copy is resilience-framed ("a
   prompt to look, not advice", "not financial advice"), consistent with `score-alert.tsx`. **Email copy
   must clear the humaniser linter (`scripts/lint/humaniser.js`) before finalising** — project rule.

5. **Notifications UI.** Add a 4th toggle (`weekly_digest`) to the prefs form
   (`app/app/account/notifications/_components/notification-prefs-form.tsx`) and page, and handle
   `weekly_digest` in `/api/notifications` GET/PUT. No threshold control for this toggle.

6. **Cron registration.** Register the weekly cron at `0 17 * * 0` (Sunday 17:00 UTC) wherever the
   existing crons are declared (e.g. `vercel.json`).

## Idempotency

`sendIdempotent` with `sendKey = ${uid}:weekly:${isoYearWeek}` (ISO year + ISO week number, e.g.
`2026-W24`) guarantees one send per user per ISO week even if the cron is retried or fires twice. An
iso-week helper computes the key from the current date inside the cron (app code; `new Date()` is fine
here — the workflow-script restriction does not apply to route handlers).

## Reuse

`sendIdempotent` (+ `sent_emails` dedup), the Pro-gate + `paused_until` + unsubscribe-token stack,
`watchedNotHeld`, `signUnsubToken`, and the `EmailLayout`/`EMAIL_STYLES` email primitives.

## Testing (TDD)

- **`weekly-digest.ts` (pure):** qualifies on score Δ; qualifies on |price Δ%| ≥ 5%; excludes price
  drift < 5% with flat scores; excludes missing-baseline tickers; correct delta signs + flat (`=`)
  direction per metric; `degraded_uk` skipped; empty input → empty (drives quiet-week).
- **Baseline selection:** picks closest row on/before 7d ago; tolerates gaps; null when no baseline.
- **Cron route:** rejects bad/absent bearer; Pro gate (Free excluded); opt-in filter; `paused_until`
  excludes; idempotency (second run sends 0); quiet-week sends the "all steady" note when positions
  exist; zero-positions skips; `last_sent_at` stamped on success.
- **Email render:** snapshot/smoke render of both the populated and quiet-week variants.
- **Live Pro smoke** (post-deploy, Glenn): opt in as Pro, run the cron against a synthetic ticker with a
  ≥5% price move and a score change, confirm the email + idempotent re-run, then tear down (reuse the
  `scripts/smoke/watchlist-alert-dryrun.mjs` harness pattern).

## Out of scope

- No engine/scoring changes (frozen).
- No new migration (`weekly_digest` enum + `current_price` history column already exist).
- No yield column (deferred; resilience + risk + price only).
- No per-toggle threshold for the weekly digest (it is threshold-independent by design).
- The `reinvest_opportunity` alert type stays dropped (Glenn cut it 2026-06-12).
