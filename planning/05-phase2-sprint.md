# Phase 2 Sprint Spec — DividendMapper.com

**Window:** 12 working days following Phase 1 launch
**Theme:** Auth, manual portfolio, Pro tier (Premium and annual deferred to polish backlog)
**Revenue target:** ~£600 MRR by end of Month 2 (~40 Pro subs at £15/mo)
**Cost step-up:** ~£38/mo → ~£74–102/mo (Vercel Pro + Supabase Pro + Stripe + Resend)

Phase 1 shipped free, anonymous calculators that worked entirely in the browser. Phase 2 turns the site into a logged-in product: users save state, log holdings against the existing tax-wrapper math, see projected income, and pay for the bits beyond the free tier.

---

## Scope — What Ships in Phase 2

### What ships at launch (Day 12)

1. **Auth.** Supabase Auth, **magic link only**. Calculators and blog stay public; everything portfolio-related sits behind auth.
2. **Manual portfolio entry — Add and Delete only.** Wrapper picker (ISA / SIPP / GIA / 401(k) / IRA / Roth IRA / Brokerage). Free tier capped at 10 holdings.
3. **Projected income view — per-wrapper aggregates only.** Per-holding income column deferred. Recycles the Phase 1 income-breakdown chart against real holdings, summed per wrapper. Source currency displayed as-is (no FX conversion).
4. **Stripe billing — Pro tier only, monthly only.** Pro at £15/mo. No customer portal at launch (cancel-by-email handled manually for the first ~30 days).
5. **Founding-member onboarding.** 6 months free Pro for the ~16 confirmed candidates, tracked in-house. Tier auto-rolls to Free at month 6 (cron and "Stay on Pro" email built later — ~5 months of runway before they're needed).
6. **Founding-member referral codes.** Three unique 50% off Pro codes per founding member, valid for 6 months, max 1 redemption each. Stripe coupons under the hood.
7. **Transactional email — minimum viable set.** Resend + React Email: `magic_link` (Supabase override), `welcome_paid`, `welcome_founding_member`. Other lifecycle emails in the polish backlog.
8. **Auth-gated pages have `noindex,nofollow`.** Sitemap unchanged from Phase 1.

### Deferred to "Phase 2 polish backlog" (Days 13+)

These are **part of Phase 2 design** but explicitly cut from the 12-day launch:

- **Premium tier (£45/mo).** All architecture supports it (price IDs, tier enum, webhook tier-mapping); the Stripe price + the Premium column on `/pricing` ship later. **Reason:** Premium's headline features (AI analyst, HMRC/IRS reports, multi-portfolio, PDF exports) all say "coming soon" anyway — launching Premium without them on the page sells a tier that's currently the same product as Pro. Better to launch Premium when there's a real differentiator to attach.
- **Annual pricing at both tiers.** Stripe annual prices created at launch (so the IDs exist); the pricing-page toggle UI ships in Days 13–15.
- **Google OAuth.** Magic link only at launch. OAuth in Days 13+ if Reddit launch conversion data shows the friction matters.
- **Edit holding.** Add + Delete only at launch. Edit (re-entry) ships Days 13–15.
- **Per-holding income column** in the holdings table. Per-wrapper aggregate is the launch view.
- **Currency conversion display** ($120/yr ≈ £94). Source currency only at launch.
- **Customer portal launcher.** Cancellations come to `hello@dividendmapper.com` for the first ~30 days. Portal wired Days 13–15.
- **Lifecycle emails:** `payment_succeeded` (renewals), `payment_failed`, `subscription_canceled`, `stay_on_pro`, `tier_expired`. Stay-on-pro and tier-expired aren't load-bearing for ~5 months. Payment-failed and canceled handled by-hand for the first month of paying users (small numbers).
- **Cron infrastructure.** Tier-expires sweep + stay-on-pro send. Built before month 5 — well after launch.

### What does NOT ship in Phase 2 at all (Phase 3+ work)

- **Broker auto-sync.** Phase 3 (Trading 212) and Phase 4 (SnapTrade for US brokers).
- **Dividend payment ingestion at the holding level.** Projected income uses public dividend yield data per ticker, not actual paid dividends per user. Per-payment ingestion arrives with broker sync.
- **CSV import.** Phase 3 polish, alongside broker sync.
- **AI analyst, tax reports (HMRC/IRS), multi-portfolio, PDF exports.** Premium-tier features arrive in Phase 6.
- **Dividend calendar / ex-dividend alerts.** Roadmap'd in the FAQ but not P0 for Phase 2.
- **Email drip sequence.** Marketing belongs to `03-marketing-plan.md` Month 2 work and runs in parallel; the build-side Phase 2 only ships transactional emails.
- **Public portfolio pages.** Phase 6.
- **Mobile app.** Web-only.

---

## Pricing — Locked

| Tier | Monthly | Annual | Annual saves | Status at Day 12 launch | Audience |
|---|---|---|---|---|---|
| Free | £0 | — | — | ✅ live | Calculators + 10 holdings |
| Pro | £15 | £150 | £30 (~2 mo) | ✅ monthly live, annual deferred to Days 13–15 | The "vs Sharesight" wedge |
| Premium | £45 | £450 | £90 (~2 mo) | ⏸ deferred — ships when AI analyst / tax reports have real content | Power users (full feature ramp through Phase 6) |

**Pro positioning:** everything Sharesight Premium does (£21/mo) plus broker sync that actually syncs, for £6/mo less. This is the headline "great value vs Sharesight" line.

**Premium positioning (when it ships):** the upsell tier — AI analyst, HMRC/IRS tax reports, multi-portfolio, PDF exports. Don't compare it to Sharesight Premium; the feature sets diverge. Premium is "I want everything," not "Sharesight + a bit."

Annual prices are exactly 10× monthly (so the "two months free" framing holds at both tiers). The annual Stripe prices are created at launch even though the pricing page only shows monthly — keeps the ID layer ready for the Day 13–15 toggle add.

### Founding-member offer (locked)

- **6 months of Pro, free, from public launch day.** Tracked in-house via `tier='pro'` + `tier_expires_at = launch + 6 months` on `profiles`. No Stripe subscription is created during this window — saves us trial-end webhook gymnastics and means founding members never have to enter card details to get the free period.
- **Three 50% off Pro codes per founding member.** Valid for 6 months from redemption. Pro tier only (not Premium). One redemption per code. Implemented as Stripe coupons + promotion codes (see "Coupon scheme" below).
- **At month 6:** subscription expires to Free. Account stays, holdings stay (capped to first 10 if they have more, with "upgrade to keep all your holdings visible" in the UI). "Stay on Pro" email goes out at month 5 with a one-click checkout link.

---

## Auth Boundary — Public vs Private

The split is locked: calculators and blog stay outside auth (SEO-load-bearing), everything portfolio-related sits behind auth.

### Public (indexable, no auth required)

| Path | Purpose |
|---|---|
| `/` | Marketing home |
| `/tools/retirement-calculator` | Phase 1 |
| `/tools/dcf-calculator` | Phase 1 |
| `/blog`, `/blog/[slug]` | SEO content |
| `/waitlist` | Pre-launch only — phase out post-launch |
| `/pricing` | New in Phase 2 |
| `/privacy`, `/terms` | Legal |
| `/login`, `/signup`, `/auth/callback` | Auth pages (no `noindex` — they show "DividendMapper sign in" and shouldn't surprise crawlers) |
| `/api/*` (most) | Public read endpoints stay open; write endpoints check the user session |

Calculators **must** stay fully usable without auth. The "Save your inputs" button shows a sign-in modal that round-trips inputs through `sessionStorage` so signed-in users land back on the calculator with their state intact.

### Auth-required (`noindex,nofollow`)

| Path | Purpose |
|---|---|
| `/app` | Authenticated dashboard root — redirects to `/app/portfolio` or `/app/onboarding` based on profile state |
| `/app/portfolio` | Holdings table + projected income view |
| `/app/portfolio/new`, `/app/portfolio/[id]` | Add / edit holding |
| `/app/account` | Tier, billing, founding-member codes, sign-out |
| `/app/account/billing` | Stripe customer portal launcher |
| `/api/portfolio/*` | Holding CRUD — server-side session check |
| `/api/billing/*` | Checkout-session creation, portal-link generation |
| `/api/webhooks/stripe` | No session check (signature verification instead) |

### Implementation notes

- **Middleware** on the `/app/*` and write-side `/api/*` prefixes only. Don't middleware-guard the public site — it adds latency to every page load for no gain. Per `dividendmapper/AGENTS.md`: read `node_modules/next/dist/docs/01-app/...` (especially the auth guide and the middleware/proxy section) before writing the middleware code; Next 16 changed middleware bundling and may have rebranded "middleware" to "proxy" in the docs — match what the installed version says.
- **`noindex` headers** on auth-required routes via `metadata.robots = { index: false, follow: false }` in the `/app/layout.tsx` route group. Don't rely on robots.txt — it's a directive, not a guarantee, and Google has indexed authenticated pages before.
- **Sitemap** in `app/sitemap.ts` keeps emitting only the public set. Don't list `/app/*`.
- **Sign-in redirect:** `/login?next=/tools/dcf-calculator` pattern, with the `next` param validated against an allow-list to avoid open-redirect.

---

## Supabase — Schema and RLS

Adds onto the Phase 1 `waitlist` table. All new tables use Postgres `uuid` primary keys and `auth.uid()` ownership — no integer IDs anywhere.

### Tables

```sql
-- Mirrors auth.users; owns tier + billing state and any user-shaped settings.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  tier text not null default 'free' check (tier in ('free','pro','premium')),
  tier_source text not null default 'free' check (tier_source in ('free','stripe','founding_member')),
  tier_expires_at timestamptz,            -- only set for founding_member rows
  stripe_customer_id text unique,
  founding_member boolean not null default false,
  created_at timestamptz not null default now()
);

-- One holding = one row. Wrapper is part of the row, not a parent table — same
-- ticker can appear in ISA AND SIPP, those are two rows.
create table holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,                   -- raw, e.g. "ULVR.L" or "SCHD"
  ticker_market text,                     -- normalised, e.g. "LSE" / "NASDAQ"; nullable while we resolve
  quantity numeric(18,6) not null check (quantity > 0),
  avg_cost numeric(18,4) not null check (avg_cost >= 0),
  cost_currency text not null check (length(cost_currency) = 3),
  wrapper text not null check (wrapper in ('isa','sipp','gia','401k','ira','roth_ira','brokerage')),
  broker_label text,                      -- free-text, e.g. "T212 ISA"
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index holdings_user_id_idx on holdings(user_id);

-- Stripe-side state, mirrored locally so we can render billing UI without
-- round-tripping to Stripe on every page load. Webhook is the writer.
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_subscription_id text unique not null,
  stripe_price_id text not null,
  tier text not null check (tier in ('pro','premium')),
  billing_period text not null check (billing_period in ('monthly','annual')),
  status text not null,                   -- mirrors Stripe statuses
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Founding-member referral codes. Three rows per founding member at provision time.
create table founding_member_codes (
  id uuid primary key default gen_random_uuid(),
  member_user_id uuid not null references auth.users(id) on delete cascade,
  stripe_promotion_code_id text unique not null,
  code text unique not null,              -- human-readable, e.g. "GLENN-3K7QPA"
  redeemed_by_user_id uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
create index founding_member_codes_member_idx on founding_member_codes(member_user_id);
```

### RLS policies

Every table is `enable row level security` from creation. Default-deny is the rule.

```sql
-- profiles: a user can read and update their own row only.
create policy profiles_self_select on profiles for select using (auth.uid() = id);
create policy profiles_self_update on profiles for update using (auth.uid() = id);
-- Insert is handled by a Supabase trigger on auth.users insert — no client-side insert.

-- holdings: full CRUD on own rows only.
create policy holdings_self_all on holdings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- subscriptions: read-only for the owning user. Webhook bypasses RLS via service role key.
create policy subscriptions_self_select on subscriptions for select using (auth.uid() = user_id);

-- founding_member_codes: a user sees their own codes (the ones they were granted).
create policy founding_member_codes_self_select on founding_member_codes for select
  using (auth.uid() = member_user_id);
```

### Free-tier holding cap (10)

Enforced at the API write layer, not in the DB. Reasoning: a hard DB constraint would block Stripe webhook downgrades from succeeding when a Premium user with 50 holdings churns to Free. The API write check returns 402 with a clear "upgrade to add more holdings" message; the dashboard hides holdings 11+ with a "5 more holdings hidden — upgrade to see all" banner.

### Profile auto-provisioning

Supabase trigger on `auth.users` insert creates the `profiles` row with `tier='free'`, `email = NEW.email`. Founding members get their tier upgrade in a separate manual flow (see "Founding-member onboarding" below).

---

## Auth Implementation

### Providers

- **Magic link via email.** Supabase Auth's built-in. Email sender is Resend (configured in Supabase dashboard's SMTP settings; reuses the Resend domain).
- **Google OAuth.** Supabase Auth's built-in OAuth provider. One client ID configured in Google Cloud Console. Redirect URI: `https://[supabase-ref].supabase.co/auth/v1/callback`.
- **No password.** Audience size + magic-link friction don't justify a third option. Adds a CRUD surface for "forgot password," "change password," password breach checks, none of which deserve build time in a 6-week sprint.

### Frontend pieces

- `app/(auth)/login/page.tsx` — single page with email field + "Continue with Google" button. Both options visible, magic link is primary CTA.
- `app/auth/callback/route.ts` — handles the OAuth + magic link return. Exchanges code for session, redirects to `next` param or `/app/portfolio`.
- `app/(auth)/layout.tsx` — minimal layout (logo + "Already have an account?" / "Need an account?" toggle). No global header/footer — auth pages don't need site chrome.
- `components/auth/sign-in-modal.tsx` — used by "Save your inputs" CTA on calculators. Triggers same magic link flow without leaving the calculator. On successful sign-in, the modal closes and the inputs persist via `sessionStorage` round-trip.

### Calculator state preservation

When an unauthenticated user clicks "Save your inputs" on a calculator:

1. Inputs serialized to `sessionStorage` under a versioned key (`dm_pending_save_v1`)
2. Modal opens, magic link sent (or Google OAuth redirect initiated)
3. On return to the callback URL, `next` includes the calculator path
4. Calculator page rehydrates from `sessionStorage` if the key is present
5. After rehydrating, the page calls `POST /api/portfolio/save-snapshot` to actually persist

Storing in `sessionStorage` not `localStorage`: the snapshot dies when the tab closes, so we don't accidentally surface a stale half-typed state to a returning user a week later.

### Linking the waitlist

Phase 1 collected emails into `waitlist` rows with no auth association. On first sign-in, a Postgres trigger checks for matching email in `waitlist` and sets `profiles.founding_member = true` if the email matches the curated founding-member list (see "Founding-member onboarding"). Plain waitlist emails just stay in the waitlist table — no auto-promotion to founding member.

---

## Manual Portfolio Entry

### Inputs per holding

| Field | Type | UI | Notes |
|---|---|---|---|
| Ticker | text | Autocomplete (Phase 3 — for Phase 2, free text + manual blur to validate) | Lowercased + uppercased on save; `.L` suffix preserved |
| Quantity | number | Number field, 6 decimal places allowed (fractional shares) | T212 supports fractional, accept it |
| Average cost | currency | Number field, prefix from `cost_currency` | Per-share, not total cost basis |
| Cost currency | select | GBP / USD only in Phase 2 | EUR + others in later phase if requested |
| Wrapper | select | ISA / SIPP / GIA / 401(k) / IRA / Roth IRA / Brokerage | Filtered by user's locale by default but all options available |
| Broker label | text | Optional free text, e.g. "T212 ISA" | Helps when user has same wrapper at multiple brokers |
| Notes | text | Optional, 500 chars | Personal context |

### UX

- **Add holding:** modal triggered from the portfolio table. Single column, ~7 fields. Submit → `POST /api/portfolio/holdings`, optimistic insert in the table.
- **Edit:** click a row → same modal pre-filled. `PUT /api/portfolio/holdings/:id`.
- **Delete:** trash icon in row, native `confirm()` (not a custom modal — it's a destructive action with no undo, the browser dialog does the job).
- **Empty state:** "No holdings yet — add your first" + a 30-second screencast GIF showing the add flow. No "import" button until CSV ships.
- **Free-tier 10-holding cap:** once at 10, "Add holding" is disabled with "Upgrade to Pro for unlimited holdings" inline.

### Ticker validation

- On blur of the ticker field: `GET /api/market/quote?ticker=XXX` (the same endpoint Phase 1 uses for the DCF calculator).
- If the response is `ok` and has a `name`, show "Looks like XXX · Unilever PLC" inline. If it returns `lse_unavailable` or `error`, show a soft warning ("Couldn't verify this ticker — saving anyway") but don't block the save.
- Don't auto-fill avg cost or quantity from the API — those are user-only fields.

### What we don't validate

- Cost basis vs current price sanity (a £0.01 cost on a £40 share is unusual but legal — could be a long-held position).
- Date of purchase (Phase 2 doesn't model CGT — irrelevant until tax reports ship in Phase 6).
- Wrapper-vs-currency consistency (USD holdings in an ISA are perfectly legal; we don't know whether their broker accepted it).

---

## Projected Income View

Recycles the Phase 1 income-breakdown chart (`app/tools/retirement-calculator/_components/income-breakdown-chart.tsx`) but feeds it real holdings instead of a single `dividendYield` slider input.

### Per-holding annual income

For each holding:
1. Fetch current price + most recent annual dividend per share via `/api/market/quote?ticker=X` (cached 24h).
2. Annual dividend = `quantity × annualDividendPerShare`.
3. Yield = `annualDividend / (quantity × currentPrice)`.

Quantities and dividends in the holding's `cost_currency`. Convert to the user's locale currency at display time using `frankfurter.app` cached daily rates (already in `00-overview.md` tech stack).

### Per-wrapper aggregate

Sum holdings per `wrapper`, group into:

- **UK locale:** ISA, SIPP, GIA — same buckets the retirement calc uses.
- **US locale:** 401(k) + IRA + Roth IRA grouped as "Retirement," Brokerage as "Taxable." Same buckets the retirement calc uses.

Tax notes per bucket (mirroring the retirement calc):
- ISA: tax-free
- SIPP: drawdown counts as income (note about lump sum — but no PCLS calculation here, that's the retirement calc's job)
- GIA: dividend allowance + flag if over
- 401(k): tax-deferred, ordinary income on withdrawal
- Roth IRA: tax-free
- Brokerage: qualified dividend rates

### Dividend data caching

Per-ticker dividend data ages slowly (companies declare quarterly at most). Cache aggressively:

- 24h browser cache via SWR / RSC fetch revalidate.
- 24h server-side cache in the existing in-memory layer (Phase 1's `/api/market/quote` already does 15-min cache; bump TTL to 24h for dividend fields specifically, keep price at 15 min).
- No Redis required for Phase 2; the user count doesn't justify it. Add Redis (Upstash) in Phase 3 when broker sync arrives.

### Edge cases

- **Ticker has no dividend data:** show "—" in the dividend column with a tooltip "no dividend data available." Don't crash, don't omit the row.
- **Ticker lookup fails entirely:** show row with quantity + cost but greyed-out income column with "couldn't fetch — try again later."
- **Currency mismatch:** the holding is in USD, the user's locale is UK. Convert at display, show both: "$120/yr (≈£94)."

---

## Stripe Billing

### Stripe setup (one-time, on Day 7)

In Stripe dashboard:

- **Products:** one at launch — "DividendMapper Pro." Premium product created later when Premium ships.
- **Prices** (2 created at launch, only one wired):
  - `pro_monthly`: £15/mo, recurring monthly — **wired into `/pricing` Day 7**
  - `pro_annual`: £150/yr, recurring annual — **created but not exposed until Days 13–15 toggle add**
  - `premium_monthly` and `premium_annual`: created when Premium ships
- **Tax:** Stripe Tax enabled. UK VAT applies at 20% to UK consumers. Prices are **VAT-inclusive** displayed (so the £15/mo headline is what they pay), Stripe Tax handles the breakdown. Set `tax_behavior: 'inclusive'` on each price.
- **Currency:** GBP for everything in Phase 2. US-resident users see "£15/mo (~$19)" in the UI for clarity but checkout is GBP. Multi-currency pricing in Phase 4 with US broker sync.
- **Customer portal:** enabled in Stripe dashboard at launch (zero engineering cost to enable). The **launcher route** (`POST /api/billing/portal` + the button on `/app/account/billing`) ships Days 13–15. For the first ~30 days, cancellations come to `hello@dividendmapper.com` and are handled by hand — small numbers, low cost.
  Permissions when the portal goes live:
  - Update payment method ✓
  - Update billing address ✓
  - Cancel subscription ✓
  - Pause subscription ✗ (not worth the engineering for the user count)
  - Switch plans ✓ (Pro monthly ↔ annual at launch; Pro ↔ Premium when Premium ships)
  - Invoice history ✓
- **Webhook endpoint:** `https://dividendmapper.com/api/webhooks/stripe`. At launch, listening to **3 critical events**:
  - `checkout.session.completed` — links Stripe customer to our user
  - `customer.subscription.updated` — covers create + update + tier changes
  - `customer.subscription.deleted` — downgrades to free
  Additional events wired in the polish backlog:
  - `invoice.payment_succeeded` — for renewal email (welcome covers first payment)
  - `invoice.payment_failed` — for payment-failed email + status indicator

Webhook secret stored in `STRIPE_WEBHOOK_SECRET` env var. API key in `STRIPE_SECRET_KEY`. Publishable key in `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (only used if we ship in-app payment elements later — Checkout doesn't need it client-side).

### Checkout flow

1. User on `/pricing` clicks "Start Pro" or "Start Premium."
2. Server route `POST /api/billing/checkout` reads selected price ID from the request body, validates the user has a session, creates a Stripe Checkout session with:
   - `mode: 'subscription'`
   - `line_items: [{ price: <selected>, quantity: 1 }]`
   - `customer: profile.stripe_customer_id` (or `customer_email: profile.email` if first-time)
   - `client_reference_id: profile.id` (links back to our user on webhook)
   - `success_url: https://dividendmapper.com/app/account?welcome=1`
   - `cancel_url: https://dividendmapper.com/pricing`
   - `allow_promotion_codes: true` (this is what enables the founding-member 50% codes at checkout)
3. Server returns the session URL; client `window.location.href = url`.
4. User completes checkout on Stripe's hosted page.
5. Stripe fires `checkout.session.completed` → our webhook upserts `profiles.stripe_customer_id` and a `subscriptions` row.
6. User redirected to `/app/account?welcome=1` which shows a one-shot "Welcome to Pro / Premium" banner.

### Webhook handler

`app/api/webhooks/stripe/route.ts`:

1. Verify signature with `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`.
2. Switch on `event.type`:
   - `checkout.session.completed` → upsert profile's `stripe_customer_id` from `event.data.object.customer`.
   - `customer.subscription.updated` → upsert `subscriptions` row, derive `tier` from price ID (small lookup map: `pro_monthly_id → 'pro'`, `pro_annual_id → 'pro'`, etc.), update `profiles.tier` and clear `profiles.tier_expires_at`. This event covers create, plan changes, and trial transitions.
   - `customer.subscription.deleted` → set `subscriptions.status = 'canceled'`, downgrade `profiles.tier = 'free'`. Holdings stay in DB (no destructive cleanup); UI hides holdings 11+ behind upgrade prompt.
   - **Polish-backlog events:** `invoice.payment_succeeded` (renewal email), `invoice.payment_failed` (payment-failed email). At launch these aren't subscribed; webhook handler returns `200` for any unhandled type so subscribing more later doesn't require redeploys.
3. Always respond `200` quickly. Long work goes through a fire-and-forget pattern, not in the request thread.

### Tier resolution at request time

A `profiles.tier` row is the single source of truth at request time. The webhook is the only writer (via Supabase service role key, bypassing RLS). Pages call `getCurrentTier()` on the server which reads `profiles.tier` for the auth'd user — never round-trip to Stripe synchronously.

For founding members:
- `tier = 'pro'`, `tier_source = 'founding_member'`, `tier_expires_at` set.
- A nightly cron (Vercel Cron or Inngest) checks for `tier_source = 'founding_member' AND tier_expires_at < now() AND tier != 'free'` and downgrades to free.
- Same cron sends "Stay on Pro" email at `tier_expires_at - 30 days` if no Stripe subscription exists yet.

---

## Founding-Member Coupon Scheme

### The 50% off codes

Implemented as Stripe coupons + promotion codes. One coupon (the rule), many promotion codes (the user-facing strings).

**Coupon (created once, in Stripe dashboard or via API):**
- ID: `founding_member_50_off_pro_6mo`
- Type: percent off, 50%
- Duration: `repeating`, `duration_in_months: 6`
- Applies to: Pro prices only (`pro_monthly`, `pro_annual`) — set via `applies_to.products: [pro_product_id]`
- Max redemptions: unset (controlled per promotion code)

**Promotion codes (3 per founding member, generated at provisioning):**
- Code format: `<MEMBERSLUG>-<6CHARRANDOM>`, e.g. `GLENN-3K7QPA`
- `coupon: founding_member_50_off_pro_6mo`
- `max_redemptions: 1`
- `expires_at: launch_date + 12 months` (gives recipients time to redeem)
- `metadata: { founding_member_user_id: '<uuid>' }`
- Mirrored to `founding_member_codes` table immediately after Stripe API call

### Provisioning flow

When a founding member signs up (their email matches the curated list):
1. Postgres trigger sets `profiles.founding_member = true`, `tier = 'pro'`, `tier_source = 'founding_member'`, `tier_expires_at = launch_date + 6 months`.
2. The trigger calls a Supabase Edge Function (or our `/api/internal/provision-founding-member` route) that:
   - Creates 3 Stripe promotion codes against the `founding_member_50_off_pro_6mo` coupon.
   - Inserts 3 rows into `founding_member_codes`.
3. Welcome email goes out (see "Transactional email" below) including the 3 codes.

### Founding member's `/app/account` view

A dedicated "Founding member" section showing:
- "You're on Pro until [date]" + countdown when < 30 days remain
- The 3 codes with redemption status:
  - Unredeemed: code visible, "Copy" button
  - Redeemed: code masked, "Redeemed by [first letter of email]@... on [date]"
- A "Stay on Pro" CTA after month 5 (or always visible) → Stripe Checkout

### What if a founding member redeems their own code?

The Stripe coupon `applies_to.products` blocks them from using it on their existing Pro tier (no active sub to apply it to). If they cancel and re-up, the code is theirs to use — fine. We're not building extra logic to prevent it.

### What about the 6-month free Pro itself — why not a 100%-off Stripe coupon?

Considered. Three reasons we use the in-house `tier_expires_at` instead:

1. **No payment method required.** Stripe trials require either a payment method upfront or `payment_behavior: 'default_incomplete'` which is fiddly. In-house tier means founding members never see a payment screen during their free 6 months.
2. **Cleaner expiry messaging.** A Stripe-managed trial sends a generic "your trial ends in 3 days" email. We want a customised "Stay on Pro" email with founding-member context — easier to send from our own cron than to override Stripe's templates.
3. **No Stripe sub during the free window** = no subscription churn metric pollution in Stripe dashboard. The first row in `subscriptions` for a founding member is the day they actually decide to pay.

---

## Transactional Email — Resend + React Email

### Setup

- Resend account, custom domain `mail.dividendmapper.com` configured (DKIM + SPF). Use a subdomain so a Resend reputation hit doesn't tank the root domain's deliverability for the marketing email used by `glenn@dividendmapper.com` outreach.
- React Email components in `emails/`. Render-to-HTML at send time.
- Sender: `DividendMapper <hello@mail.dividendmapper.com>`.
- Reply-to: `hello@dividendmapper.com` (forwards to Glenn via ImprovMX, per existing memory).

### Templates

**At Day 12 launch (3):**

| Template | Trigger | Send via |
|---|---|---|
| `magic_link.tsx` | Supabase Auth magic-link request | Supabase SMTP (Resend backend) — template overridden in Supabase dashboard |
| `welcome_paid.tsx` | `checkout.session.completed` for Pro | Webhook handler |
| `welcome_founding_member.tsx` | First sign-in matching curated list | Provisioning route |

**Polish backlog (5):**

| Template | Trigger | Send via | Ship by |
|---|---|---|---|
| `payment_succeeded.tsx` | `invoice.payment_succeeded` (renewals only — first payment covered by welcome) | Webhook | Days 16+ |
| `payment_failed.tsx` | `invoice.payment_failed` | Webhook | Days 16+ |
| `subscription_canceled.tsx` | `customer.subscription.deleted` | Webhook | Days 16+ |
| `stay_on_pro.tsx` | Cron, founding-member 30 days from `tier_expires_at` | Cron | Month 4 (5 months runway) |
| `tier_expired.tsx` | Cron, founding-member at `tier_expires_at` | Cron | Month 4 |

All templates clear the humaniser linter (per memory: every outreach/marketing draft must clear the 24 patterns and show the audit). Run `scripts/lint/humaniser.js` against rendered HTML before merging.

### Idempotency

Each transactional send uses a derived key (`payment_succeeded_<invoice_id>`, `stay_on_pro_<user_id>`) tracked in a `sent_emails` audit table to prevent duplicates if a webhook fires twice or a cron retries.

---

## Pricing Page (`/pricing`) — launch shape

New public page. **Two columns at launch** (Free, Pro). Premium column is added when Premium ships.

### Content per column at launch

**Free — £0**
- Calculators (retirement, DCF)
- Manual portfolio (10 holdings)
- Projected income view (per-wrapper aggregate)
- "Get started — free" CTA → `/login?next=/app/portfolio`

**Pro — £15/mo**
- Everything in Free
- **Unlimited holdings**
- Per-wrapper income breakdown (full)
- Email alerts (Phase 3 — "coming soon" tag, honestly)
- Broker sync (Phase 3 — "coming soon" tag, honestly)
- "Start Pro" CTA → Checkout
- Tagline: "Everything Sharesight Premium does, with broker sync that actually syncs, for £6/mo less."

**Premium — coming soon**
- A small "Premium tier coming with AI analyst, HMRC + IRS tax reports, multi-portfolio, and PDF exports — we'll email founding members first" panel below the two columns. Honest about not being live; preserves the marketing narrative for the upsell tier without selling something that doesn't exist yet.

### Locale handling

Pricing page reads `useLocale()`. UK shows £; US shows £ headline + "(~$19/mo at current rates)" parenthetical. No GBP/USD price split in Phase 2 — Stripe is GBP-only until Phase 4.

### Annual toggle — deferred

Stripe `pro_annual` price (£150/yr) is created at launch but the toggle UI ships in Days 13–15. At launch the page shows monthly only ("£15/mo · billed monthly") to keep the surface tiny. The Days 13–15 add inserts a "Monthly · Annual (save £30)" toggle.

### Founding-member visibility

Founding members visiting `/pricing` see a banner: "You're a founding member — you're on Pro until [date]. Use [account link] to view your status and referral codes." No need to hide pricing; transparency is fine.

---

## Public/Private API Surface

### Public endpoints (Phase 1, kept)

- `GET /api/market/quote?ticker=X` — price + dividend lookup. Cached 15min/24h.

### New public endpoints

- `POST /api/auth/magic-link` — passthrough to Supabase, lets us log it.
- `POST /api/billing/checkout` — requires session, creates checkout. Validates `priceId` against allow-list of our 4 prices.
- `POST /api/billing/portal` — requires session, returns Stripe Customer Portal URL.
- `POST /api/webhooks/stripe` — public, signature-verified.

### New auth-required endpoints

- `GET /api/portfolio/holdings` — list current user's holdings.
- `POST /api/portfolio/holdings` — create. Enforces 10-cap for Free.
- `PUT /api/portfolio/holdings/:id` — update. RLS on Supabase enforces ownership.
- `DELETE /api/portfolio/holdings/:id` — delete.
- `GET /api/portfolio/income` — derived view: per-wrapper income roll-up. Caches per user for 5 minutes.

---

## App Router Structure (Phase 2 additions)

```
app/
  (auth)/                      ← route group, auth pages
    login/page.tsx
    layout.tsx                 ← minimal chrome
  app/                         ← authenticated dashboard
    layout.tsx                 ← noindex, robots: { index: false }, requires session
    portfolio/
      page.tsx                 ← holdings table + projected income
      new/page.tsx
      [id]/page.tsx            ← edit
    account/
      page.tsx                 ← tier, founding-member section
      billing/page.tsx         ← portal launcher
  pricing/page.tsx             ← public
  api/
    auth/
      magic-link/route.ts
    billing/
      checkout/route.ts
      portal/route.ts
    portfolio/
      holdings/route.ts
      holdings/[id]/route.ts
      income/route.ts
    webhooks/
      stripe/route.ts
    internal/
      provision-founding-member/route.ts  ← service-role only, called by trigger
auth/
  callback/route.ts            ← OAuth + magic link return
emails/                        ← React Email templates
  magic_link.tsx
  welcome_paid.tsx
  welcome_founding_member.tsx
  payment_succeeded.tsx
  payment_failed.tsx
  stay_on_pro.tsx
  tier_expired.tsx
  subscription_canceled.tsx
lib/
  auth/
    server.ts                  ← getCurrentUser, getCurrentTier
    middleware.ts              ← session check helper
  billing/
    stripe-server.ts           ← Stripe SDK init
    price-map.ts               ← priceId → tier + period lookup
  portfolio/
    income-calc.ts             ← shared with retirement calc
middleware.ts                  ← protects /app/* and write /api/*
```

---

## 12-Day Build Schedule

Compressed from 6 weeks. Premium tier and annual pricing UI deferred to "Phase 2 polish backlog (Days 13+)" to fit the window. Dependency-ordered: auth foundation first, then portfolio, then billing (highest-risk infra last so any slippage is absorbed by the launch buffer day).

### Week 1 — Foundation, auth, portfolio

| Day | Build | Marketing (parallel) |
|---|---|---|
| **Day 1** | **First action: provision `mail.dividendmapper.com` DNS records (DKIM + SPF + MX)** so Resend domain verification has 10 days to propagate before Day 11 sends. Then: Supabase Pro + Vercel Pro upgrade. Schema migration (profiles, holdings, subscriptions, founding_member_codes) + RLS policies + auto-provisioning trigger. Magic-link auth wired end-to-end (login page, Supabase config, callback route, session helper). Logged-in user reaches empty `/app/portfolio`. | Month 2 marketing kickoff per `03-marketing-plan.md`: r/UKInvesting data post draft. Email founding members "Phase 2 is one week out — your access is provisioned automatically when you sign in." |
| **Day 2** | Middleware on `/app/*` and write `/api/*`. `noindex` on `/app/layout.tsx`. Sign-out flow. Account page skeleton. Sign-in modal for calculators with `sessionStorage` round-trip. | First Reddit post lands. |
| **Day 3** | Holdings table read-only on `/app/portfolio`. Empty state + "Add holding" CTA. `GET /api/portfolio/holdings`. Add Holding modal: all 7 fields, validation, ticker blur-check. `POST /api/portfolio/holdings` with 10-cap enforcement. | r/FIREUK tutorial post draft. |
| **Day 4** | Delete flow + optimistic UI. Free-tier 10-cap UX (disabled add, upsell modal, hidden-rows banner). Loading + error states. | r/FIREUK post lands. First SEO post of Month 2 published. |
| **Day 5** | `GET /api/portfolio/income` — per-wrapper income roll-up from holdings + cached `/api/market/quote` (24h TTL on dividend fields). 5-min user cache. Income view UI on `/app/portfolio` — recycle Phase 1 income-breakdown chart, swap in real per-wrapper data. Source-currency display only (no FX conversion at launch). | T212 forum participation. |

### Week 2 — Edge cases, billing, founding members, launch

| Day | Build | Marketing (parallel) |
|---|---|---|
| **Day 6** | Edge cases: ticker with no dividend → "—" not crash; lookup failure → row visible with greyed-out income; mobile responsive pass on portfolio + account. Account page expansion: tier indicator, "you're on Free" / "you're on Pro until [date]" panel, danger-zone delete account (cascades). | YouTube outreach — Tier 1 follow-ups. |
| **Day 7** | Stripe account configured: 1 product (Pro), 2 prices (`pro_monthly` live, `pro_annual` created-but-unused). Webhook endpoint registered (test mode). Tax behaviour set inclusive. `/pricing` page — Free + Pro columns only, monthly only, locale display, founding-member banner. | Second SEO post draft. |
| **Day 8** | `POST /api/billing/checkout` end-to-end on test mode. `allow_promotion_codes: true` so the founding-member 50% codes work at checkout. Successful test purchase visible in `subscriptions` table after manual webhook fire. | Reddit comment engagement (no posts). |
| **Day 9** | Webhook handler: 3 critical events (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`). Signature verification. Idempotency. Tier upserts to `profiles.tier`. Tier-gated UI: holding cap enforced based on tier. | YouTube outreach sends. |
| **Day 10** | Founding-member coupon `founding_member_50_off_pro_6mo` created in Stripe (50% off, 6mo, Pro product only). Provisioning route generates 3 promotion codes per founding member, mirrors to `founding_member_codes`. `/app/account` founding-member section showing 3 codes + redemption status + "Stay on Pro" CTA. | Reddit data post lands. T212 forum: T212 sync anticipation post. |
| **Day 11** | Resend setup: `mail.dividendmapper.com` domain, DKIM + SPF, sender configured. Three React Email templates: `magic_link` (overrides Supabase default), `welcome_paid` (wired to webhook), `welcome_founding_member` (wired to provisioning route). Humaniser audit on all three. Founding-member curated list (~16 emails) loaded into DB. | Final founding-member outreach round: "Phase 2 launches tomorrow." |
| **Day 12** | **Buffer + launch day.** Morning: full happy-path QA (signup → add holdings → see income → upgrade to Pro via Checkout → sign out → return). End-to-end test with one real founding-member email. Stripe live mode switch (re-test webhook with real card). Sentry on webhook + checkout + provisioning routes. PostHog on signup, first_holding_added, pricing_viewed, checkout_started, checkout_completed, founding_member_provisioned. **Afternoon: launch sequence below.** | Launch announcement posts queued. |

---

## Launch Day Sequence (End of Day 12)

| Time (UK) | Action |
|---|---|
| 06:00 | Final smoke tests on production: sign up flow, magic link delivery, calculator save flow, Pro checkout (real card), founding-member welcome (test address). |
| 08:00 | Founding-member welcome emails go out (~16 sends). Each contains: account access link, "you're on Pro until [date]," and the 3 referral codes. |
| 09:00 | Pricing page goes public (was behind a feature flag). |
| 10:00 | Email to full waitlist: "Phase 2 is live — sign in to start your portfolio." Includes link to `/pricing`. |
| 11:00 | r/UKInvesting post: "Update on the dividend tracker — manual portfolios are live, T212 sync is next." |
| 13:00 | T212 forum update post (no DM blast — let the founding members in the group spread organically). |
| 16:00 | Day-end check: PostHog conversion funnel, Stripe dashboard for first paid subs, Sentry for any webhook errors. |

---

## Phase 2 Definition of Done — Day 12 launch

Trimmed to the MVP launch surface. Items marked ⏸ are deferred to "polish backlog (Days 13+)" and tracked separately.

- [ ] User can sign up via magic link
- [ ] First sign-in auto-creates `profiles` row via trigger
- [ ] Calculator "Save your inputs" preserves state through sign-in round-trip
- [ ] Authenticated user can **add and delete** holdings (edit deferred ⏸)
- [ ] Free tier blocks adding an 11th holding with clear upgrade prompt
- [ ] Free tier hides holdings 11+ if downgraded from Pro
- [ ] Projected income view sums correctly **per wrapper** (per-holding column deferred ⏸)
- [ ] Income shown in **source currency** (FX conversion display deferred ⏸)
- [ ] `/pricing` shows Free + Pro columns, **monthly only** (annual toggle deferred ⏸; Premium column deferred ⏸)
- [ ] Stripe Checkout for **Pro** completes end-to-end
- [ ] Webhook upserts `subscriptions` and `profiles.tier` correctly for the 3 critical events
- [ ] Pro users see all holdings; Free users see 10
- [ ] Founding-member sign-up auto-provisions: tier=pro, expires_at, 3 codes generated, welcome email sent
- [ ] Founding members see their 3 codes and redemption status on `/app/account`
- [ ] 50% off codes apply correctly at Stripe Checkout (Pro only, 6 months, 1 redemption)
- [ ] All `/app/*` pages return `noindex,nofollow`
- [ ] Sitemap excludes `/app/*` and `/api/*`
- [ ] Sign-out flow works and clears session
- [ ] Delete account flow cascades correctly (RLS-safe)
- [ ] `magic_link`, `welcome_paid`, `welcome_founding_member` emails clear humaniser linter and deliver via Resend
- [ ] Sentry covers webhook handler, checkout route, and provisioning route
- [ ] PostHog events on: signup, first_holding_added, pricing_viewed, checkout_started, checkout_completed, founding_member_provisioned

### Out of scope for Day 12 (DoD lives elsewhere)

- ⏸ Premium tier ships, with all 4 "coming soon" features turned into reality (Phase 6 work).
- ⏸ Annual pricing toggle UI on `/pricing` (Days 13–15).
- ⏸ Google OAuth provider (Days 13+ if conversion data justifies it).
- ⏸ Edit holding flow (Days 13–15).
- ⏸ Per-holding income column + FX conversion display (Days 13–15).
- ⏸ Customer portal launcher on `/app/account/billing` (Days 13–15).
- ⏸ Lifecycle emails: `payment_succeeded`, `payment_failed`, `subscription_canceled`, `stay_on_pro`, `tier_expired` (built before they're needed; stay-on-pro has 5 months of runway).
- ⏸ Cron infrastructure for tier-expires sweep + stay-on-pro sends.

---

## Key Constraints

- **Stripe is the source of truth for payment state, but `profiles.tier` is the source of truth for what gets rendered.** Webhook is the only writer to `profiles.tier` in the paid path. Don't ever resolve tier by hitting Stripe API on a hot path.
- **No anonymous portfolio entries.** Calculators stay anonymous. Portfolio = auth required. No "try with sample data" path — that's noise.
- **No SMS, no in-app notifications, no PWA.** Phase 2 is web + email only.
- **No partial implementations.** If a Premium-only feature ("AI analyst") isn't ready, the pricing page says "coming soon" honestly. Never half-ship a paid feature.
- **Founding-member experience is the launch narrative.** They're the first 16 users; if their experience breaks, the public launch story breaks. End-to-end test with a real founding member's email before Day 30.

---

## Phase 2 Polish Backlog (Days 13+)

Items cut from the 12-day launch but **part of Phase 2 design** — ship in the weeks immediately after launch, before Phase 3 (broker sync) starts. Ordering inside each band is rough; pull what unblocks the next thing.

### Days 13–15 — fast follow-ups

These are days, not weeks. They restore commitments to the Phase 2 spec:

- **Annual pricing toggle on `/pricing`.** Stripe `pro_annual` price already exists; just add the UI toggle and route the price ID through `POST /api/billing/checkout`. ~half day.
- **Edit holding flow.** Reuse the Add Holding modal, pre-filled. `PUT /api/portfolio/holdings/:id` already in spec. ~half day.
- **Customer portal launcher on `/app/account/billing`.** `POST /api/billing/portal` returns the Stripe-hosted URL. ~quarter day plus testing.
- **Per-holding income column** in the holdings table. Already-cached `/api/market/quote` data per ticker; column just renders the per-row product. ~half day.
- **FX conversion display** ($120/yr ≈ £94). frankfurter.app daily-cached rates. ~half day.

### Days 16+ — lifecycle hardening

Lower urgency, but build before usage scales:

- **Lifecycle emails: `payment_succeeded` (renewals only — first payment is `welcome_paid`), `payment_failed`, `subscription_canceled`.** Wire to webhook events already being received. Templates + idempotency. ~1 day.
- **Cron infrastructure** (Vercel Cron, lightweight). ~half day to set up.
- **`stay_on_pro` and `tier_expired` emails + the cron that fires them.** Has ~5 months of runway from launch (founding members hit `tier_expires_at - 30 days` at month 5). Build by month 4 to be safe. ~1 day.
- **Google OAuth provider.** Only if launch-week conversion data shows magic-link friction is hurting signups from cold traffic. Cost is ~half a day plus Google review delay.

### After Pro is steady — Premium tier launch

Not a date; a readiness gate. Ship Premium when at least two of its four "coming soon" features have real content:

- **AI dividend analyst.** Probably built on top of the Anthropic SDK with prompt caching (per existing skills). Phase 6 work currently.
- **HMRC + IRS tax reports.** Genuine UK CGT and dividend allowance reports for HMRC; US 1099-DIV-style summary for IRS. Big surface, depends on holding-level dividend payment data which itself depends on broker sync.
- **Multi-portfolio.** Schema-light (just adds a `portfolios.user_id` join), UI-heavy (portfolio switcher, per-portfolio income view, "compare portfolios" surface).
- **PDF exports.** Library choice (`@react-pdf/renderer`?), template design, export queue if reports are expensive to generate.

When Premium ships: add the Premium column to `/pricing`, create the `premium_monthly` and `premium_annual` Stripe prices, wire the webhook tier-mapping (already supports it via the price-ID lookup), email founding members first.

---

## Phase 3+ backlog

Items intentionally not Phase 2 at all — listed here so they don't get accidentally attempted during the polish window.

### CSV import for holdings

**Phase:** 3, alongside broker sync. CSV is the natural bridge — same data shape as a broker import, with a manual upload step instead of an OAuth one. Building it standalone in Phase 2 would be wasted work.

### EUR cost currency

**Phase:** opportunistic — add when a real user asks. Add to enum + currency formatter (already supports via Intl). ~1 day.

### "Sample portfolio" demo for unauthenticated users

**Phase:** experiment — only build if Free → Pro conversion turns out lower than ~5% in months 1–2. Adds read-only-state complexity and is unproven. Test without it first.

### Referral programme beyond founding members

**Phase:** ~Month 6 per `03-marketing-plan.md:33`. Founding-member codes are the Phase 2 referral surface. Broader scheme waits for traction signal.

### Multi-currency Stripe pricing

**Phase:** 4, alongside US broker sync. UK GBP is enough for Phase 2's UK-anchored launch; US users tolerate £ pricing if the value is clear.

---

## Tech Stack Additions (for `00-overview.md` update)

| Layer | Technology | Phase introduced |
|---|---|---|
| Auth | Supabase Auth (magic link + Google OAuth) | 2 |
| Payments | Stripe Checkout + Customer Portal + Webhooks | 2 |
| Transactional email | Resend + React Email | 2 |
| Cron | Vercel Cron (lightweight, no Inngest yet) | 2 |
| Plan upgrades | Vercel Hobby → Pro, Supabase Free → Pro | 2 |
