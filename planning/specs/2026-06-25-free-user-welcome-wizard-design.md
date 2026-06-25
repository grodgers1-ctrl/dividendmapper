# Free-User Welcome Wizard: Design Spec

**Date:** 2026-06-25
**Status:** Approved through brainstorming (Glenn, 2026-06-25). Pending implementation plan.
**Related:**
- [Lifecycle email sequence](../../dividendmapper/lib/email/lifecycle/sequence.ts): the 6-step email chain the wizard complements
- [Pro personalisation wizard](../../dividendmapper/lib/scoring/preferences.ts): separate, untouched (this is for free-user onboarding only)

---

## Goal

Convert first-visit free users into activated users (one holding added) inside the same session as their magic-link signup, without being salesy. Reuses the existing app shell. Shows a Pro taster honestly. Reinforces the in-flight lifecycle email chain rather than duplicating it.

## Non-goals (v1)

- Onboarding for new Pro signups. They get backfill-dismissed and a separate flow ships later.
- Replacing or restructuring the lifecycle email chain. The wizard runs in-session; emails run cross-session as backstops.
- Capturing user preferences (goals, horizon, risk appetite). Those belong to the Pro personalisation wizard at [lib/scoring/preferences.ts](../../dividendmapper/lib/scoring/preferences.ts) and stay there.
- Writing user locale to the database. Locale already lives in localStorage via [lib/locale/context.tsx](../../dividendmapper/lib/locale/context.tsx); the wizard points users at the existing toggle.
- Email opt-in or notification preferences. Separate concern.

---

## Architecture

### Single client island in the `/app/*` layout

`app/app/layout.tsx` extends to render a `<WelcomeWizard initialState={...}/>` client island below its main content, gated on a server-side check. The check fires once per layout render via React's `cache()` (same pattern as `getCurrentUser`). When the gate is closed, nothing renders.

```
shouldShow = user.tier === 'free'
  AND no row exists in welcome_wizard_dismissals for user.id
```

No new route. The modal opens on top of whichever `/app/*` page the user landed on (typically `/app/portfolio` per the magic-link callback default at [app/auth/callback/route.ts:5](../../dividendmapper/app/auth/callback/route.ts:5)).

### Tier filter: Pro never sees it

New Pro signups get a backfill-dismissal at signup via a server hook (or, simpler, the migration's existing-user backfill keeps any future signup that isn't free silent until we ship a Pro-specific wizard). v1 implementation: dismissal row written for all existing users in the migration, plus a `INSERT IGNORE`-style guard in the wizard's server-side check skips Pro tiers.

### Reuses, never modifies

- Locale: read-only via existing `useLocale()` hook. Step 2 is a tour stop pointing at the existing toggle in [components/site-header.tsx](../../dividendmapper/components/site-header.tsx) and [components/locale-toggle.tsx](../../dividendmapper/components/locale-toggle.tsx).
- Add-holding: step 3 form POSTs to the existing `/api/portfolio/holdings` endpoint with the same payload shape as `AddHoldingLauncher`.
- Auth: server-side checks use the existing `getCurrentUser()` + `requireUser()` helpers.
- Analytics: events fire via the existing `captureClientEvent` + `captureServerEvent` helpers.

### Files (high level)

- `app/app/_components/welcome-wizard/welcome-wizard.tsx`: modal frame + step state machine
- `app/app/_components/welcome-wizard/step-1-welcome.tsx`
- `app/app/_components/welcome-wizard/step-2-locale.tsx`
- `app/app/_components/welcome-wizard/step-3-add-holding.tsx`
- `app/app/_components/welcome-wizard/step-4-tour.tsx`
- `app/app/_components/welcome-wizard/step-5-pro-taster.tsx`
- `app/app/_components/welcome-wizard/__tests__/`: RTL component tests
- `app/app/layout.tsx`: extends to render the wizard island conditionally
- `lib/onboarding/load-welcome-state.ts`: pure-ish server helper for the trigger + initial data
- `lib/onboarding/__tests__/load-welcome-state.test.ts`
- `app/api/onboarding/welcome/route.ts`: dismissal/completion server action
- `app/api/onboarding/welcome/__tests__/route.test.ts`
- `supabase/migrations/00NN_welcome_wizard_dismissals.sql`: table + RLS + backfill

Migration number determined at execution time. Latest on `main` at spec write was `0020_saved_screens.sql`. If the Calendar v2 migration (`0021_equity_scores_projection.sql`) merges first, this becomes `0022`.

---

## The five steps

All user-facing copy below has cleared the humaniser pass. Em dashes ✓ none. AI vocab ✓ none. Templated structure ✓ broken by Glenn-voice register matching the lifecycle email tone ("takes about a minute", "nice", "heads up").

### Modal frame

- Centred, ~480px wide on desktop. Full-height sheet under the Tailwind `sm` breakpoint.
- Backdrop click does NOT dismiss (avoids accidental close mid-form).
- X button top-right + ESC key dismiss for the session only (no DB write).
- Progress dots at the top: `1 · 2 · 3 · 4 · 5` with current step filled.
- Footer always shows an optional Back button (steps 2–5) plus the step's primary button.
- Animations: fade plus slight scale-in on mount (200ms). Step transitions slide horizontally (160ms). All respect `prefers-reduced-motion`.

### Step 1: Welcome

- Headline: *"Welcome to DividendMapper."*
- Body: *"Let's get you to your first Quality score. Takes about a minute. You can close this any time and it'll be here when you're back."*
- Primary button: *"Let's go"*
- Bottom-right link: *"Skip the tour"* (sets dismissal row with `reason='dismissed'`, closes permanently)

### Step 2: Pick your locale (tour stop, not a form)

- Headline: *"Heads up. This toggle controls the wrappers and currency we show."*
- Visual: small arrow + screenshot-style callout of the existing locale toggle in the header
- Body: *"Set to {UK | US} based on your browser. Switch any time from the header."* (current locale interpolated from `useLocale()`)
- Primary button: *"Got it"* (advances to step 3, no writes)

### Step 3: Add your first holding

- Headline: *"Add a holding so the app has something to work with."*
- Sub-head: *"Takes about a minute. You can add more later."*
- Inline mini-form, fields mirroring `AddHoldingLauncher` exactly:
  - Ticker (text + existing autocomplete)
  - Quantity (number, ≥0.0001)
  - Wrapper (locale-aware dropdown)
  - Cost basis (price per share + currency: included because it cannot be added post-hoc)
  - Purchase date if the existing form has it
- POSTs to the existing `/api/portfolio/holdings` endpoint with the same payload.
- Primary button: *"Add holding"* (changes to *"Saving"* while in flight)
- Secondary link: *"I'll add later"* (advances without writing)
- Smart-skip variant: if `existingHoldingsCount > 0` at modal mount, the form is replaced by a card reading *"You've already got {N} holding{s}. Nice."* with a *"Continue"* button.
- On success, advance to step 4 and trigger `revalidatePath('/app/portfolio')`.

### Step 4: A few things worth knowing

- Headline: *"A few things worth knowing while you're here."*
- Three small horizontal cards (stacked on mobile):
  1. *"Your income chart"* with caption *"Projected income per month lives under your Ledger."* Link to `/app/portfolio#income-chart`.
  2. *"Public scoring"* with caption *"Per-ticker resilience pages, free. No signup needed for any ticker we cover."* Link to `/scoring`.
  3. *"Income vehicle hub"* with caption *"REITs, BDCs, UK REITs. Scored and searchable."* Link to `/income-vehicles`.
- All card links open in a new tab (`target="_blank" rel="noopener"`) so the wizard isn't lost.
- Primary button: *"Continue"* (always available)

### Step 5: Here's what Pro adds

- Headline: *"When you're ready, here's what Pro adds."*
- Sub-head: *"Nothing on this page is locked behind a paywall. Just so you know what's there."*
- Four mini-tiles in a 2×2 grid (1-col stack on mobile):
  1. *"Resilience scores"* · *"Every holding, every night."*
  2. *"Quality, Trim, Risk"* · *"Scores on every equity holding."*
  3. *"Dividend calendar"* · *"18 months out, projected."*
  4. *"Unlimited holdings and watchlist"* · *"With threshold alerts."*
- Bottom row:
  - Left, muted link: *"Don't show this again."* Sub-text: *"This is separate from your email preferences."*
  - Outline button: *"See pricing"* (opens `/pricing` in new tab, writes dismissal with `reason='completed'`)
  - Primary button: *"Finish"* (writes dismissal with `reason='completed'`, closes)

---

## Data model

### Migration `00NN_welcome_wizard_dismissals.sql`

```sql
create table public.welcome_wizard_dismissals (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  recorded_at  timestamptz not null default now(),
  reason       text not null check (reason in ('completed','dismissed','backfilled'))
);

alter table public.welcome_wizard_dismissals enable row level security;

create policy "welcome_wizard_dismissals_select_own"
  on public.welcome_wizard_dismissals for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies: writes happen only from server actions
-- using the service role, so we control the `reason` value end-to-end.

-- Backfill: every existing auth.users row gets a 'backfilled' dismissal so
-- the wizard appears only for genuinely new signups going forward.
insert into public.welcome_wizard_dismissals (user_id, reason)
select id, 'backfilled' from auth.users
on conflict (user_id) do nothing;

comment on table public.welcome_wizard_dismissals is
  'Records that the welcome wizard has either been completed or explicitly dismissed for a user. Existence = do not show. Absence = show on next /app/* visit.';
comment on column public.welcome_wizard_dismissals.reason is
  'completed = user reached step 5 finish/pricing. dismissed = user chose Skip the tour or Don''t show this again. backfilled = existed before the wizard shipped.';
```

### State loader contract

```ts
// lib/onboarding/load-welcome-state.ts
export interface WelcomeWizardState {
  shouldShow: boolean;
  existingHoldingsCount: number;
}

export async function loadWelcomeWizardState(userId: string, tier: 'free' | 'pro' | 'premium'): Promise<WelcomeWizardState>;
```

Returns `shouldShow: false` immediately for any non-free tier. For free users, reads `welcome_wizard_dismissals` for the user_id and `holdings` count in a single round-trip (parallel `Promise.all`).

### Smart-skip cross-tab guard

If a user dismisses the modal in tab A, switches to tab B, adds a holding through the normal `AddHoldingLauncher`, then returns to tab A or opens a new `/app/*` page in another tab, the wizard should NOT show them an empty add-holding form at step 3. The `existingHoldingsCount` value at modal mount drives a swap to the "You've already got N. Nice." confirmation card on step 3. This is a one-shot read per render, not a live subscription.

### Existing tables relied on, untouched

- `auth.users` for the backfill `select id from auth.users`.
- `holdings` for the smart-skip count.
- `user_preferences` (the Pro personalisation wizard's table) is untouched. The two features share no columns and no semantic overlap.

---

## Telemetry

PostHog events via the existing `captureClientEvent` + `captureServerEvent` helpers.

| Event | Trigger | Props |
|---|---|---|
| `welcome_wizard_shown` | Layout renders the wizard island (server-side capture) | `tier`, `first_step` |
| `welcome_wizard_step_advanced` | Continue/Add/Got it button | `from_step`, `to_step` |
| `welcome_wizard_step_back` | Back button | `from_step`, `to_step` |
| `welcome_wizard_dismissed_session` | X or ESC (no DB write) | `from_step` |
| `welcome_wizard_dismissed_permanent` | "Skip the tour" or "Don't show this again" | `from_step` |
| `welcome_wizard_completed` | Finish on step 5 | `path_through_steps` |
| `welcome_wizard_holding_added` | Step 3 form POST returns 200 | `wrapper`, `currency` |
| `welcome_wizard_holding_skipped` | "I'll add later" on step 3 | none |
| `welcome_wizard_tour_card_clicked` | Step 4 card click | `card_key` |
| `welcome_wizard_pricing_clicked` | Step 5 "See pricing" | none |

Drop-off funnel: `shown` → `step_advanced (1→2)` → `step_advanced (2→3)` → `holding_added | holding_skipped` → `step_advanced (3→4)` → `step_advanced (4→5)` → `completed`.

---

## Accessibility

- Modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the step `<h2>`.
- Focus trap inside the modal while open. First focus lands on the primary button (or the first form input on step 3).
- ESC dismisses for the session. X carries `aria-label="Close welcome tour"`.
- Progress dots in `<ol role="list">` with `aria-current="step"` on the active dot.
- Visually-hidden `aria-live="polite"` region announces each step transition (*"Step 2 of 5: Where you're investing from."*).
- Form fields (step 3) carry visible `<label for=...>` associations. Inline errors tied via `aria-describedby`.
- No colour-only signal anywhere. Tier and wrapper badges always include text labels.
- All animations respect `prefers-reduced-motion`.
- Keyboard path: Tab cycles through controls in DOM order. Enter activates primary. ESC closes.

---

## Mobile

- Full-height sheet under Tailwind `sm` (640px). Slides up from the bottom on mount; slides down on close.
- Primary button bottom-anchored within the sheet (one-tap thumb reach). Back link sits above it.
- Tour cards (step 4) stack vertically. Pro mini-tiles (step 5) collapse from 2×2 to a single column.
- Touch targets minimum 44px height (Tailwind `min-h-11`).
- Step 3 form behaviour with on-screen keyboard: the sheet's inner scroll container handles overflow so the bottom-anchored primary stays reachable.

---

## Reliability

- **Optimistic UI on dismiss/complete.** The modal closes immediately and the server action fires in the background. If the write fails, the modal re-opens on the next `/app/*` visit. No user-visible error toast: the cost of seeing it twice is lower than the cost of a scary error.
- **Step 3 form failures are surfaced.** Same inline-error pattern as the existing `AddHoldingLauncher`. The button re-enables and the user can retry.
- **No race with the lifecycle email chain.** The Day 3 `activation_nudge` email already gates on `holdingsCount >= 1` per [skip-gates.ts:34](../../dividendmapper/lib/email/lifecycle/skip-gates.ts:34), so if the wizard adds a holding successfully, the email is correctly suppressed.

---

## Testing strategy

~31 new tests across five layers.

### Pure module (TDD per [reference_equity_scoring_spec])

**`lib/onboarding/load-welcome-state.ts`** (~5 tests):
- Returns `shouldShow: false` for any non-`free` tier.
- Returns `shouldShow: false` when a `welcome_wizard_dismissals` row exists.
- Returns `shouldShow: true` when tier is `free` AND no dismissal row.
- `existingHoldingsCount` reflects the holdings table accurately.
- Handles a missing user gracefully (returns `shouldShow: false`, count `0`).

### Component tests (RTL)

**Modal frame** (~3 tests):
- ESC fires `welcome_wizard_dismissed_session`, does NOT write the DB row.
- X button does the same.
- Focus trap: tabbing past the last focusable element wraps to the first; backdrop clicks do not dismiss.

**Step 1: Welcome** (~2 tests):
- Primary "Let's go" advances to step 2 and fires `step_advanced`.
- "Skip the tour" calls the dismissal server action with `reason='dismissed'` and closes.

**Step 2: Locale tour stop** (~2 tests):
- Renders the current locale from a mocked `useLocale()` and inserts it into the body copy.
- "Got it" advances without any write.

**Step 3: Add holding** (~5 tests):
- Renders the form with wrapper options matching the current locale.
- Validation: empty ticker, zero quantity, missing wrapper each block the primary.
- Successful POST advances to step 4 and fires `welcome_wizard_holding_added` with `wrapper` + `currency` props.
- POST failure leaves the modal open, surfaces the inline error, button re-enabled.
- Smart-skip variant: when `existingHoldingsCount > 0`, the form is replaced by the "You've already got N" card with a single Continue button.

**Step 4: Tour** (~2 tests):
- Renders all three cards with `target="_blank" rel="noopener"`.
- Card click fires `welcome_wizard_tour_card_clicked` with the correct `card_key`.

**Step 5: Pro taster** (~3 tests):
- Renders all four mini-tiles with the locked copy (Quality, Trim, Reinvest etc.).
- "Don't show this again" calls the dismissal server action with `reason='dismissed'`.
- "See pricing" and "Finish" both call the completion server action with `reason='completed'`.

### Server action tests (~4 tests)

**`app/api/onboarding/welcome/route.ts`**:
- Inserts the dismissal row idempotently (second call is a no-op, no error).
- Rejects requests with no authenticated user (401).
- Validates the `reason` enum (rejects unknown values with 400).
- Captures the corresponding PostHog event server-side.

### Layout integration (~2 tests)

- Wizard island renders on `/app/*` when `loadWelcomeWizardState(...)` returns `shouldShow: true`.
- Renders nothing when `shouldShow: false`.

### Database / migration

Hand-verified at apply time rather than unit-tested:
- Dry-run with `npx supabase db push --dry-run` shows no destructive changes.
- Backfill row count matches `auth.users` count (one-shot manual check).
- RLS policy allows `select` by self, denies all writes.

### Anti-pattern guards (memory entries)

- `next build` locally before pushing any Supabase-touching code per [feedback_supabase_promiselike_chain].
- No `useState` + `useEffect` for derived state per [feedback_set_state_in_effect_workaround]. The wizard's step state is local `useState` only, no derived effects.
- `/app/*` page auth guard pattern preserved per [reference_app_page_auth_guard]. The wizard renders FROM the layout, but the layout still calls `requireUser`.

---

## Risks + open questions

- **New Pro signups don't get backfill-dismissed at signup.** The migration backfills *existing* users at apply time. A user who signs up Pro after the migration but before any Pro-onboarding ships will technically see the welcome wizard. Mitigation: the runtime check in `loadWelcomeWizardState` short-circuits on `tier !== 'free'`, so the wizard never renders for them regardless of dismissal-row state. The `welcome_wizard_dismissals` table for these users stays empty until they downgrade or until we ship the Pro-specific flow. Acceptable.
- **Smart-skip relies on `existingHoldingsCount` being accurate at mount.** If the user adds a holding in another tab while the wizard is already open on step 3, the form does not auto-update. Acceptable: they'll submit, the existing endpoint will either accept the duplicate-keyed row (CSV-import-style) or reject it; either way they advance. The "two holdings instead of one" case is recoverable from the Ledger.
- **No cap on backdrop interaction during step 3.** A user opening DevTools during the modal lifetime could `localStorage.setItem('dm_locale', ...)` mid-flow and see step 2's headline copy become stale. Edge case, no real harm.
- **Lifecycle email Day 0 vs wizard step 1 redundancy.** Both greet the user. Different channels, different timing. We're not deduping: both serve as reinforcement. If telemetry later shows the email is opened consistently before the wizard appears (i.e. user reads email first, then clicks in), we may want to soften step 1's headline. v2 concern.

---

## Acceptance criteria

**Done when:**

- Migration `00NN_welcome_wizard_dismissals.sql` applied to prod. Backfill row count matches `auth.users` count.
- Wizard renders for new free signups on first `/app/*` visit.
- Wizard does NOT render for: existing users (backfilled), Pro/Premium tiers, anyone with a dismissal row.
- All five steps render with locked copy. Smart-skip variant on step 3 fires when `existingHoldingsCount > 0`.
- Dismissal server action writes the row with correct `reason`. Optimistic UI closes the modal immediately.
- Telemetry events fire correctly through the funnel (verify in PostHog: `shown` → `completed`).
- All ~31 tests pass.
- Manual: full happy path completes on desktop and mobile. ESC closes on session. "Don't show this again" closes permanently. The X never accidentally writes a row.
- `npm run lint` clean. `npm run build` clean. `next build` locally before push (Supabase-touching code).

---

## Memory cross-refs

- [feedback_humaniser_mandatory]: all user-facing copy in this spec has cleared the humaniser pass.
- [project_buy_renamed_to_quality]: step 5 tile copy uses "Quality, Trim, Risk" (the equity score triad) not "Buy".
- [reference_app_page_auth_guard]: layout-level guard pattern preserved.
- [reference_app_marketing_chrome_split]: the wizard renders under `/app/*` so it inherits the drawer shell, not marketing chrome.
- [feedback_supabase_promiselike_chain]: `next build` locally before any push touching new tables.
- [feedback_set_state_in_effect_workaround]: wizard step state stays in plain `useState`, no derived effects.
- [feedback_dividendmapper_nextjs_warning]: read `node_modules/next/dist/docs/` before any Next-specific code.
- [reference_supabase_cli_workflow]: Glenn's CLI flow for `db push` of the migration.
- [reference_welcome_email_template]: wizard copy harmonises with the lifecycle email voice.
