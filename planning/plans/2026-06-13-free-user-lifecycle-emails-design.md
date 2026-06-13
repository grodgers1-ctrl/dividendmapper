# Free-user lifecycle emails — design

**Date:** 2026-06-13
**Status:** Spec, awaiting review
**Author:** Glenn + Claude (brainstorm)

## Problem

DividendMapper currently sends no welcome or lifecycle email to free signups. Of 11 non-test free users on prod today:

- 6 added zero holdings (never crossed the activation threshold)
- 4 added 1–2 holdings (toe in the water)
- 1 added 8 holdings (genuinely activated)
- 0 have returned since their signup day

There is no automated path that converts a curious signup into either an activated user or a Pro upgrade. Founding-member welcomes are handled outside the app; the Stripe webhook welcomes paid Pro signups; free users get only their Supabase magic-link sign-in email and silence afterwards.

This document specifies a Resend-driven lifecycle program that does three things:

1. Welcomes free signups and pushes them toward activation (adding holdings).
2. Sends a time-delayed Pro upgrade pitch once they have something to upgrade.
3. Keeps engaged free users in touch via a monthly value drip + one final discounted upgrade window.

## Goals

- **Activation lift:** raise the % of free signups that add ≥1 holding within 7 days.
- **Conversion lift:** convert activated free users to Pro within 60 days.
- **Retention bridge:** keep activated-but-non-paying users hearing from us monthly without feeling marketed at.
- **Brand-safe:** every email reads like Glenn wrote it. Humaniser-linter clean. No spammy patterns. One-click unsubscribe.

## Non-goals (v1)

- WhatsApp for free users (founding-member-only stays the right framing).
- A separate monthly newsletter stream (the day-30 recap covers this need).
- Behaviour-triggered emails outside the time program (e.g. "you hit the free cap"). Worth doing later, not in v1.
- A founder-personal day-60 email. Unsustainable at scale, dropped.

## Architecture

### Sequence definition

The 6 steps live as a typed array in `dividendmapper/lib/email/lifecycle/sequence.ts`:

```ts
type LifecycleStep = {
  key: string;                    // 'welcome_free', 'activation_nudge', ...
  daysAfterSignup: number;        // 0, 3, 7, 14, 30, 60
  subject: string;
  template: ComponentType;
  transactional: boolean;         // ignores unsubscribe flag if true
  skipGate?: (ctx: SkipContext) => boolean;  // pure function
};
```

`SkipContext` is `{ profile, holdingsCount, lastSignInAt, now }`. Skip-gates are pure and unit-tested in isolation.

### Cron + dispatch

- New endpoint: `POST /api/internal/send-lifecycle-emails` (auth: `CRON_SECRET` like the others).
- Vercel cron: daily at **07:30 UTC**, 30 minutes after the scoring cron so day-30 recap emails read fresh `equity_score_history` rows.
- Algorithm per run:
  1. Load all free-tier users with `created_at <= now - 1 day`.
  2. For each user, for each step in the sequence:
     - Skip if `now - created_at < daysAfterSignup` (not yet due).
     - Skip if step is non-transactional AND `profile.lifecycle_emails_unsubscribed = true`.
     - Skip if `skipGate(ctx)` returns true.
     - Skip if `sent_emails` already has `send_key = lifecycle_<step.key>_<user_id>` (idempotency).
     - Otherwise call `sendIdempotent({ template, sendKey, userId, to, body, supabase, listUnsubHeader })`.
  3. Catch-up behaviour: if the cron misses a day, the next run still sends day-N emails for users whose signup was N days ago or earlier. No tight "must fire exactly on day N" requirement.
- Concurrency: process in small batches (e.g. 25 users in parallel) to keep within Vercel function timeout. Failures on one user don't block others.

### Idempotency

Reuse the existing `sent_emails` table. Send keys are namespaced:

```
lifecycle_welcome_free_<user_id>
lifecycle_activation_nudge_<user_id>
lifecycle_score_explainer_<user_id>
lifecycle_pro_pitch_1_<user_id>
lifecycle_monthly_recap_<user_id>
lifecycle_pro_pitch_final_<user_id>
```

The unique constraint on `send_key` guarantees one send per (user, step) for life. Replays of the cron are safe.

### Schema additions

One migration (`0013_lifecycle_emails.sql`):

```sql
alter table public.profiles
  add column lifecycle_emails_unsubscribed boolean not null default false;
```

No new tables — `sent_emails` already does the audit job.

## The 6-email sequence

### Email 1 — `welcome_free` (T+0, on first sign-in)

- **Subject:** `Welcome to DividendMapper`
- **Transactional:** yes (always sends, ignores unsub flag)
- **Skip-gate:** never skip
- **Trigger nuance:** Day-0 send is not on Supabase signup, it's on first sign-in (after magic-link click), so we know they actually own the inbox. Same cron, same idempotency, just gates on `auth.users.last_sign_in_at IS NOT NULL`.
- **Delay caveat:** because the cron runs once daily at 07:30 UTC, a user who signs in just after the cron tick waits up to ~24 hours for their welcome. Acceptable for v1 (better than 0 emails today). If the lag bites, the fix is a Supabase auth-hook that triggers an immediate send on first sign-in, bypassing the cron — out of scope here.
- **Tone reference:** `super_user/sends/2026-06-08-bernard-themis-welcome.txt` (without the founding-member-specific bits)
- **Body sketch:**

> Welcome to DividendMapper.
>
> The app does one thing well: it scores your dividend holdings on resilience so you know which are quietly safe to compound and which want watching.
>
> The fastest way to see what it does is to add 1 or 2 holdings:
>
> [Add a holding] → /app
>
> Free tier covers up to 10 holdings. Pro is for when you want the full portfolio view across ISA, SIPP, and GIA, plus Buy / Trim / Reinvest recommendations on each one.
>
> Standing ask: if anything looks broken or off, just reply to this email.
>
> Glenn at DividendMapper

### Email 2 — `activation_nudge` (T+3)

- **Subject:** `Add a holding to see what the score does`
- **Transactional:** yes
- **Skip-gate:** `holdingsCount >= 1` → skip
- **Body sketch:**

> Quick nudge.
>
> The resilience score is the bit that turns DividendMapper from interesting to useful, and it only kicks in once you have at least one holding in there.
>
> [Add a holding] → /app
>
> Takes about a minute. If your broker is Trading 212 and you're Pro, the sync pulls them all automatically — but adding one by hand on Free works fine too.
>
> Glenn at DividendMapper

### Email 3 — `score_explainer` (T+7)

- **Subject:** `Here's what your resilience score is telling you`
- **Transactional:** no (respects unsub)
- **Skip-gate:** `holdingsCount === 0` → skip
- **Body:** anchors to *their lowest-scoring holding*. The cron query reads `equity_score_history` for that user, picks the holding with the lowest resilience score, and templates the email around it:

> Your portfolio's lowest-scoring holding right now is [TICKER] at [SCORE]/100.
>
> Here's what that means. The resilience score blends three things: dividend cover, payout-vs-cashflow, and balance-sheet headroom. A score under 50 means at least one of those is stretched. It doesn't mean "sell" — it means "this is the one to read on next earnings call".
>
> [See the full breakdown] → /app/holdings/[ticker]
>
> Glenn at DividendMapper

- **Fallback:** if equity_score_history is empty for them (scoring hasn't run on their tickers yet), defer to next cron run rather than send a generic email.

### Email 4 — `pro_pitch_1` (T+14)

- **Subject:** `Here's what Pro would say about your portfolio today`
- **Transactional:** no
- **Skip-gate:** `holdingsCount === 0` → skip. Also `profile.tier === 'pro'` → skip.
- **Body:** the first real Pro pitch, framed as *concrete output Pro would give them right now*. Not feature list — actual specifics from their data:

> Across your [N] holdings, Pro would flag:
>
> - [TICKER A]: BUY (score [X], 3 of 8 signals strong this month)
> - [TICKER B]: HOLD (score [X])
> - [TICKER C]: TRIM (score [X], concentration > 25%)
>
> Plus a Reinvest Recommender that picks which of your holdings would best absorb next month's contribution based on Quality, price, and concentration.
>
> [Try Pro for £x/month] → /pricing
>
> Free continues to cover the basics for as long as you want.
>
> Glenn at DividendMapper

- **Implementation note:** the per-ticker Buy/Trim flags come from the same `equity_score_history` table the chip drawer reads. If we can't generate at least 2 specific lines, defer.

### Email 5 — `monthly_recap` (T+30)

- **Subject:** `Your DividendMapper recap`
- **Transactional:** no
- **Skip-gate:** `holdingsCount === 0` → skip. `profile.tier === 'pro'` → skip (Pro users have their own score-alert track).
- **Body:** what changed in their portfolio this month — score moves, ex-div coming up, dividend updates. Pure value, no Pro pitch. Builds the habit of opening DividendMapper emails.

> This month in your holdings:
>
> - [TICKER X]: resilience score moved from [A] → [B] (+ reason if known: e.g. "dividend cover improved on the new interim")
> - [TICKER Y]: ex-div on [DATE], payment [DATE] of [£X]
> - [TICKER Z]: dividend announcement — [details]
>
> [Open your portfolio] → /app
>
> Glenn at DividendMapper

- **Implementation note:** if we can't generate at least one substantive line, skip the send for this user this month and try again at T+60 (re-key the send so it's not blocked by idempotency — `lifecycle_monthly_recap_<user_id>_<YYYYMM>` instead). **NB:** this is the one email whose send_key includes month, so a user could in principle get more than one monthly recap if they stay on free a long time. We cap by only running steps 1–6, so a user who survives past day 60 stops getting them. Acceptable.

### Email 6 — `pro_pitch_final` (T+60)

- **Subject:** `50% off your first month of Pro`
- **Transactional:** no
- **Skip-gate:**
  - `profile.tier === 'pro'` → skip
  - Fully dormant (`last_sign_in_at < now - 30 days` AND `holdingsCount === 0`) → skip (no point — they've ghosted)
- **Body:** soft final nudge with a single-use 50% off code for the first month of Pro. The discount is small enough not to cannibalise founding-member positioning, large enough to be a clear last-chance signal.

> Last automated nudge from me — promise.
>
> If you've been meaning to give Pro a go, here's a one-time 50% off your first month code. Valid for 7 days:
>
> **[CODE]**
>
> [Use code at checkout] → /pricing
>
> If Pro isn't right for you, no hard feelings — free continues to cover the basics for as long as you want, and the monthly recap keeps you in the loop.
>
> Glenn at DividendMapper

- **Stripe prereq:** new coupon `lifecycle_day60_50off_first_month` (one-time, 50% off, applies to first invoice only). Distinct from the existing `founding_member_50_off_pro_6mo`.
- **Code generation:** single-use codes generated per recipient using Stripe `promotionCodes.create` with `expires_at = now + 7 days`. Stored in a new column on `sent_emails` or in a sibling `lifecycle_pro_codes` table — TBD in implementation plan.

## Voice anchors

Reference files for tone and pattern (read before drafting any template):

- `super_user/sends/2026-06-08-bernard-themis-welcome.txt` — most recent founding-member welcome, cleanest example of current voice
- `super_user/sends/2026-05-15-roland-head-welcome.txt` — older but shows the warm-but-direct convention
- `super_user/templates/welcome-reply.txt` — canonical welcome-reply template
- `dividendmapper/emails/welcome-founding-member.tsx` — production React Email implementation
- `dividendmapper/emails/welcome-paid.tsx` — Pro welcome, useful for tone on Pro pitches

Hard voice rules (already mandatory per memory):

- Run `scripts/lint/humaniser.js` on every drafted email body before commit
- No em dashes — colons or pipes instead
- No filler words: "simply", "just" (in the soft sense), "really", "actually" (as throat-clearer)
- No marketing copula avoidance ("DividendMapper helps you...")
- Sign-off: `Glenn at DividendMapper` (matching existing templates)

## Compliance + deliverability

### One-click unsubscribe

Every lifecycle email (transactional or marketing) includes:

- `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers — required by Gmail/Yahoo bulk-sender rules in 2024+
- Visible footer link with HMAC-signed token: `https://dividendmapper.com/unsubscribe?u=<user_id>&t=<hmac>`
- A `/unsubscribe` route that flips `profiles.lifecycle_emails_unsubscribed = true` and shows a confirmation

Transactional emails (1, 2) include the header for compliance but the visible footer is replaced with: "This is a transactional email about your DividendMapper account. To stop all non-essential emails, [unsubscribe here]." — so the user understands why a transactional one is still arriving.

### Sender + domain

No change. Continue using `"DividendMapper" <hello@dividendmapper.com>` via the existing Resend integration. Reply-to: `hello@dividendmapper.com`.

### Volume guard

The cron logs a count per run. If a single run would send more than 100 lifecycle emails (sanity check — current pace is < 5/day), it logs a Sentry warning. Doesn't block, just flags for inspection.

## In-app additions (complement to email)

Two lightweight additions that compound with the email program:

### 1. In-app activation banner

- **Where:** top of `/app` dashboard
- **Who:** signed-in users with `holdingsCount === 0`
- **Copy:** "Add 1 holding to see your first resilience score." + [Add holding] button
- **Behaviour:** dismissible (cookie), reappears next session if still 0 holdings
- **Why it matters:** complements activation_nudge (email 2); converts at higher rate because user is already in-app

### 2. In-app Pro nudge on score chips

- **Where:** scoring chip/drawer for free-tier users on the holdings page
- **Who:** free users with `holdingsCount >= 3` (i.e. activated)
- **Copy:** "Pro shows Buy / Trim / Reinvest for this holding" as a passive small badge with a `[See Pro]` link
- **Behaviour:** passive, no popup — appears alongside the chip
- **Why it matters:** catches them in the moment of curiosity; complements pro_pitch_1 (email 4)

Both are minor frontend changes. Spec'd here but should be sequenced AFTER the email program ships, in a follow-up plan.

## PostHog instrumentation

New server-side events:

- `lifecycle_email_sent` — `{ template, user_id, days_after_signup }`
- `lifecycle_email_skipped` — `{ template, user_id, reason }` — useful for tuning skip-gates
- `lifecycle_email_unsubscribed` — `{ user_id, source }` (source = 'one_click' | 'footer_link')
- `lifecycle_pro_code_redeemed` — `{ user_id, code, days_to_redeem }` — for measuring email 6 conversion

Existing events (`signup`, `holding_added`, `subscription_started`) already let us build the funnel.

## Stripe prereqs

Before email 6 can ship:

1. Create coupon: `lifecycle_day60_50off_first_month` — 50% off, applies to first invoice only, one-time
2. Code generation pattern: `promotionCodes.create({ coupon: <id>, max_redemptions: 1, expires_at: <now + 7d> })`
3. Code format: human-readable prefix like `DM60-XXXXXX` (matches existing founding-member code aesthetic)

## Testing strategy

- **Unit tests:** each skip-gate as a pure function; sequence ordering; idempotency key generation
- **Integration test:** mock Supabase + Resend, replay 90 days of cron runs against a fixture user, assert the expected 6 emails fire on the expected days with the expected skip-gates
- **Email preview:** every template gets a route under `/dev/email-preview/<template>` (already exists for other templates, follow that pattern) so we can eyeball renders without sending
- **Live smoke:** before turning the cron on, send each template to `grodgers1+lifecycle@gmail.com` and verify render in Gmail + Outlook + ProtonMail
- **First-week monitoring:** Sentry alert if `lifecycle_email_sent` events drop to 0 for > 36 hours (cron likely broken)

## Rollout

1. Ship migration + cron skeleton + welcome_free + activation_nudge — verify these two work on a 2-user pilot (a test address + your grodgers1@gmail.com free account)
2. Ship score_explainer + pro_pitch_1 next iteration, enable on pilot
3. Ship monthly_recap + pro_pitch_final third iteration, enable on pilot
4. After 7 days of clean pilot runs, enable the cron for all free users
5. Watch PostHog funnel for 2 weeks, tune skip-gates or copy as needed

## Open questions for implementation plan

- Where to store generated 50%-off codes (sent_emails column vs sibling table)?
- Exact copy for the unsubscribe confirmation page
- Email preview route — does one already exist or do we need to build it?
- Cron concurrency limit — 25/batch is a guess; right number depends on Vercel function timeout
- Whether email 5 (monthly recap) should ever send to Pro users (currently skipped — could be valuable for Pro retention too, but out of scope here)

## Out of scope (deferred)

- Behaviour-triggered emails (cap-reached, score-crossing for free users)
- Re-engagement campaign for users who unsubscribed
- A/B testing different subject lines
- Localisation (currently UK-only audience)
- WhatsApp invitations for free users

