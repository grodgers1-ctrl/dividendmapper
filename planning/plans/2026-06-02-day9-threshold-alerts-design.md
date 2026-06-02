# Phase 2.75 Day 9 — Threshold Alert Emails + Notification Preferences — Design

**Date:** 2026-06-02
**Status:** Approved (brainstorm complete; ready for implementation plan)
**Base:** prod tip `4bc31e3` (public /scoring pages). Engine FROZEN — Day 9 is read-only over persisted scores.

## Goal

Let Pro users opt in to email alerts when one of their holdings' resilience scores
deteriorates past a threshold, or when a holding goes ex-dividend (cash to redeploy).
One consolidated daily digest per user, sent by a new cron, with a managed-preferences
page. This is the parked "Day 9" deliverable from `planning/07-phase2.75-and-3-synopsis.md`.

## Hard constraints (carried from the kickoff)

1. **Engine is frozen.** No change to what the 22:30 scoring cron computes. Day 9 reads
   the already-persisted `equity_scores` / `equity_score_history`.
2. **Reframe is live.** Scores are a RESILIENCE CHECK, never advice. No "Buy/Sell/Recommend"
   in any email or UI string. "Not financial advice" in every alert email.
3. **Outward-facing + compliance-heightened.** Every email/prefs string carries resilience
   framing + "Not financial advice" + a one-click manage/unsubscribe link. Alerts are
   OPT-IN only. Humaniser `--strict` audit shown before any copy is presented.
4. **Known-data-issue guard.** Alerts must not fire on a `degraded_uk` holding whose move
   is an artifact of missing UK fundamentals (the frozen GATE_4 default-to-0 bug).

## Resolved decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Email shape | **One consolidated daily digest per user**, sectioned by type. |
| B | Trigger | **Crossing** between the two most-recent `equity_score_history` rows (not "currently beyond"). |
| C | Defaults / overrides | **Risk ≥ 75, Quality < 30.** Per-ticker `notification_overrides` **deferred** (v1 = one global threshold per event type). |
| D | Send time / quiet hours | **07:00 UTC cron**; `quiet_hours` column **unused in v1** (a once-daily morning digest doesn't need it). |
| E | Per-user cap | One email/user/day, inherent in A; enforced by `sendKey`. |
| F | Unsubscribe | **HMAC signed-token one-click** disable (no login) + "manage preferences" link. |
| G | Free tier | Prefs page **visible** to Free with disabled toggles + upgrade CTA (mirrors Day-8 wizard). |
| H | Reinvest trigger | Reuse `buildReinvestCard` — a holding goes **ex-dividend within the window**. |

## Architecture

Five units, each independently understandable and testable.

### 1. Pure decision module — `lib/alerts/build-digest.ts` (no I/O)

The risky, heavily-unit-tested core. Pure function; injected data only.

```
interface AlertPrefs {
  riskEnabled: boolean;    riskThreshold: number;    // default 75
  qualityEnabled: boolean; qualityThreshold: number; // default 30
  reinvestEnabled: boolean;
}

interface HoldingObservation {
  ticker: string;
  prevRisk: number | null;    currRisk: number | null;
  prevQuality: number | null; currQuality: number | null; // null = gate-failed
  dataQuality: 'full' | 'degraded_uk' | 'sparse'; // from current equity_scores row
}

interface DigestTrigger { ticker: string; from: number; to: number; }

interface Digest {
  riskCrossings: DigestTrigger[];
  qualityCrossings: DigestTrigger[];
  reinvest: ReinvestCard | null; // from buildReinvestCard, passed in
}

buildDigest(prefs, holdings, reinvestCard): Digest | null  // null if nothing fired
```

**Crossing rules** (only when `*Enabled`):
- **Risk** fires when `prevRisk < T && currRisk >= T` (rose into the elevated band).
- **Quality** fires when `prevQuality >= T && currQuality < T` (fell below the floor),
  **numeric→numeric only**. Transitions to/from `null` (gate-state changes) are NOT
  alerted in v1 — that path is entangled with the frozen GATE_4 default-to-0 bug, so
  skipping it sidesteps the known-data issue cleanly.

**Guards:**
- **No prior observation** (`prev*` null because there is no second history row) → no
  crossing detectable → no alert. Kills the first-run spam wave.
- **degraded_uk** → suppress *all* score crossings for that holding (reinvest still allowed,
  it's ex-div-driven, not score-driven).

Note: `data_quality` is read from the current `equity_scores` row (history rows don't carry
it). `prev/curr` scores come from the two most-recent `equity_score_history` rows.

### 2. Prefs API — `GET/PUT /api/notifications`

RLS-scoped, validated against the `notification_preferences` CHECK enums + threshold 0–100.
Modeled on the existing `/api/preferences` route. Returns/accepts the per-event-type rows
(`buy_threshold_crossed` = Quality, `risk_threshold_crossed` = Risk, `reinvest_opportunity`).

### 3. Prefs page — `/app/account/notifications`

`requireUser("/app/account/notifications")` self-guard (the layout guard doesn't re-run on
soft navs). Pro tier (read `profiles.tier` like `app/app/layout.tsx`) sees enabled toggles +
threshold inputs for Quality / Risk / Reinvest. Free sees them disabled + an upgrade CTA.
Account entry link added (AccountWizardEntry pattern). base-ui components.

### 4. Email template — `emails/score-alert.tsx`

One React Email digest template (`_layout.tsx` + `@react-email/components`), tone matched to
`welcome-paid.tsx` / `founder-step-one.tsx`. Sections render only for fired + enabled types:
- **Quality fell below your floor** — ticker, from→to, resilience framing.
- **Risk rose into the elevated band** — ticker, from→to.
- **Dividend landing soon** — reinvest card (hygiene framing, diversification, never alpha).
Footer: "Not financial advice", manage-preferences link, one-click unsubscribe link.

### 5. Send cron — `/api/internal/send-score-alerts` (`0 7 * * *`)

Auth `Authorization: Bearer ${CRON_SECRET}` (copy the scoring route's guard). Per run:
1. Load `notification_preferences` where `enabled=true`, joined to `profiles` where
   `tier` ∈ (Pro/founding), excluding rows where `paused_until > now`.
2. For each such user: load their holdings → fresh `equity_scores` + the two most-recent
   `equity_score_history` rows per ticker → build `HoldingObservation[]`.
3. If `reinvest_opportunity` enabled, assemble a `ReinvestCard` via `buildReinvestCard`
   (reuses the portfolio analytics loader). **This is the heaviest task** — built last and
   independently shippable; Quality + Risk ship even if reinvest assembly slips.
4. `buildDigest(...)` → if non-null, `sendIdempotent({ sendKey: ${userId}:digest:${yyyy-mm-dd}, ... })`.
5. On `ok: true`, update `last_sent_at` on the contributing pref rows.

Add to `vercel.json`: `{ path: /api/internal/send-score-alerts, schedule: "0 7 * * *" }`.
(Confirm the Vercel plan allows a second cron before deploy.)

### 6. Unsubscribe route — `GET /api/notifications/unsubscribe?token=…`

HMAC-verify the token (`userId` signed with a server secret). On valid token, set all of
that user's `notification_preferences.enabled = false` and render a confirmation page. No
login required. Token minted in the email footer + `List-Unsubscribe` header.

### 7. Pricing flip

`app/pricing/page.tsx` (~line 242): "alerts — Coming soon" → live.

## Reuse (do NOT rebuild)

- `lib/email/send.ts` `sendIdempotent({to, subject, template, sendKey, userId, body, supabase})`.
- `lib/email/resend.ts` (`EMAIL_FROM`, `EMAIL_REPLY_TO`, `getResend`), `emails/_layout.tsx`.
- `sent_emails` idempotency ledger (migration 0003).
- `lib/reinvest/build-card.ts` `buildReinvestCard` + `build-suggestions.ts`.
- `equity_score_history` (already written daily by the 22:30 cron — verified).
- `/api/preferences` (GET+PUT RLS pattern), `requireUser`, `profiles.tier` Pro detection.

## Schema

**Likely ZERO new migrations.** Migration 0004 already has `notification_preferences`
(enabled, threshold_value, quiet_hours_*, paused_until, last_sent_at, UNIQUE(user_id,
event_type)) and `notification_overrides`. `sent_emails` (0003) is the email ledger. Confirm
before adding any migration.

## Out of scope (parked)

Engine changes; `trim_threshold_crossed` / `weekly_digest` / `watchlist_alert` (enum exists,
parked); `notification_overrides` honouring (deferred); quiet-hours/snooze UI; Upstash;
anything on `phase-2.75-backtest` / `scripts/analyst-dashboard` / `scripts/backtest`.

## Verification (before deploy)

`npx vitest run` (target > 472), `npx tsc --noEmit` clean, `npm run build`, humaniser
`--strict` on ALL email + UI copy (show the 24-pattern audit), lint shows only the 3
pre-existing errors. Manual cron test: trigger with Bearer `CRON_SECRET` against a test user
with enabled prefs + a holding whose score crossed; confirm exactly one email (idempotent on
re-run), correct copy, working unsubscribe; tear down test rows.

## Deploy model (unchanged)

Commit to the worktree branch → FF `main` (clean fast-forward, not force) → `git push origin
main` = PRODUCTION deploy (confirm with Glenn first). Verify via Vercel MCP (`get_deployment`
READY + `dividendmapper.com` in `alias`; projectId `prj_BLaQ11IfxVGzFy3wRtRXV8pilf9J`,
teamId `team_BzpvDy7iiVyx0Ufq2TEsOYQX`). Never publish analyst/backtest commits.
