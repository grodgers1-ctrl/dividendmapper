# Customer Portal — Design

**Date:** 2026-05-25 (Phase 2, Day 13)
**Backlog item:** A (planning/05-phase2-sprint.md L340, scheduled Days 13–15)
**Status:** Approved, ready for implementation plan

## Goal

Let Pro members whose tier comes from a Stripe subscription self-manage their
billing — cancel, update payment method, view invoice history, and switch
between monthly and annual — through Stripe's hosted Customer Portal. This
replaces the placeholder on the account page that currently tells these members
to email `hello@dividendmapper.com` to cancel.

## Scope evolved during brainstorming

The task started as "wire a Manage billing button." Two findings during design
grew the scope:

1. Enabling the portal's **cancel** feature requires terms-of-service and
   privacy-policy URLs. The site footer already links `/privacy` and `/terms`,
   but **those routes do not exist — they 404** (a pre-existing bug). So legal
   pages must ship first.
2. The Stripe CLI on this machine is paired with the **sandbox** account (Day 12
   finding), so the live portal configuration is created via a direct API call
   with the `sk_live_` key, not the CLI.

Result: four ordered parts.

## Decisions

1. **Legal pages ship first; copy is Claude-drafted, Glenn-reviewed.** Grounded
   in the real stack and UK law. The pages state on-page that they are
   information, and it is understood between us that this is a first draft Glenn
   owns, not legal advice.
2. **Live portal configured via direct API call**, run by Claude using the
   `sk_live_` key from `dividendmapper/.env.local`. The first configuration
   created automatically becomes the account default, so the route needs no
   configuration ID. (The first config is dashboard-editable but not
   API-editable afterward — acceptable.)
3. **Portal feature set** (Glenn-approved): cancel at period end; update payment
   method; invoice history; switch Pro monthly ↔ annual with proration.
   Customer email/address update is **off**, to avoid the Stripe-side email
   diverging from the Supabase auth email.
4. **Server-driven form submit, not client fetch.** The button is a plain
   `<form action="/api/billing/portal" method="POST">`, mirroring the existing
   `/api/billing/checkout` pattern (303-redirect to a Stripe-hosted URL).
5. **Button shown only to `tier === "pro" && !isFoundingMember`.** Founding
   members have no Stripe customer/subscription, so they get no portal button.

## Out of scope

- The founding-member-converts-to-Stripe display bug (backlog B). First founder
  expiry is 2026-11-25, not launch-blocking, untouched here.
- Any change to the founding-member block or codes UI.
- API-managed portal config beyond the one-time create (no config CRUD in repo).
- Cookie-consent banner / analytics opt-out UI (the Privacy page documents
  analytics; a consent UI is separate future work).

## Order of operations

1. Build + deploy `/privacy` and `/terms` (Part 1).
2. Create the live portal configuration via API (Part 2) — after the pages are
   live so the URLs resolve for customers.
3. Wire `/api/billing/portal` route (Part 3) + account-page button (Part 4).
4. Deploy. Glenn does the live click-test.

## Part 1 — Legal pages

### Routes

- `app/(legal)/layout.tsx` — shared chrome: `max-w-3xl` container, Home
  breadcrumb, and a "Last updated 25 May 2026" line. Mirrors blog/account
  typography (`font-display` headings, `text-muted-foreground` body).
- `app/(legal)/privacy/page.tsx` — server component, `metadata` (title, default
  indexable).
- `app/(legal)/terms/page.tsx` — same.

Route group `(legal)` keeps the URLs at `/privacy` and `/terms` (group segment
is not part of the path) while sharing one layout.

### Privacy content (Claude-drafted, Glenn-reviewed)

- What is collected: account email; holdings the user enters; subscription /
  payment data (handled by Stripe — full card details never touch our servers);
  product-usage analytics; error diagnostics.
- Processors named under UK GDPR, each with purpose: Supabase (database + auth),
  Stripe (payments), Resend (transactional email), PostHog (analytics), Sentry
  (error monitoring), Vercel (hosting).
- Legal basis, data retention, user rights (access / rectification / erasure /
  portability / complaint to the ICO), cookies/analytics note, `hello@`
  contact.

### Terms content (Claude-drafted, Glenn-reviewed)

- Service description.
- "Not financial or tax advice / information only" disclaimer, consistent with
  the footer copy (`components/site-footer.tsx:82-89`).
- Eligibility, account responsibilities.
- Pro subscription terms: £15/month, £150/year, auto-renews, cancel any time via
  the in-app portal (cancellation takes effect at period end), no partial-period
  refunds except where required by UK consumer law.
- Acceptable use, intellectual property, disclaimers + limitation of liability,
  changes to terms, governing law **England & Wales**, contact.

## Part 2 — Live portal configuration (one-time API call)

`POST https://api.stripe.com/v1/billing_portal/configurations` with the
`sk_live_` key read from `dividendmapper/.env.local`. Parameters:

| Param | Value |
|---|---|
| `business_profile[privacy_policy_url]` | `https://dividendmapper.com/privacy` |
| `business_profile[terms_of_service_url]` | `https://dividendmapper.com/terms` |
| `features[invoice_history][enabled]` | `true` |
| `features[payment_method_update][enabled]` | `true` |
| `features[customer_update][enabled]` | `false` |
| `features[subscription_cancel][enabled]` | `true` |
| `features[subscription_cancel][mode]` | `at_period_end` |
| `features[subscription_update][enabled]` | `true` |
| `features[subscription_update][default_allowed_updates][]` | `price` |
| `features[subscription_update][proration_behavior]` | `create_prorations` |
| `features[subscription_update][products][0][product]` | `prod_UYH4LmCH8oF9Eq` |
| `features[subscription_update][products][0][prices][]` | `price_1Taa3MPblTYo14ejlPL2xKeo` (monthly) |
| `features[subscription_update][products][0][prices][]` | `price_1Taa3MPblTYo14ejIptmrw7a` (annual) |

- The returned `id` (a `bpc_…`) is recorded in the EOD memory for the record but
  is **not** wired into the app — the config is the account default, so
  `sessions.create` resolves it implicitly.
- Run only after the legal pages are deployed live.
- This is a live-account mutation; the first config becomes the permanent
  default (Glenn approved the feature set above).

## Part 3 — `app/api/billing/portal/route.ts` (new)

Mirrors `app/api/billing/checkout/route.ts`.

- `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.
- `POST(req)`:
  1. `createSupabaseServerClient()` → `getClaims()` → `userId`. No `userId` →
     303 to `${SITE_URL}/login?next=${encodeURIComponent("/app/account")}`.
  2. Read `profiles.stripe_customer_id` for `userId` (`maybeSingle`).
     - Lookup error or no profile → log, 303 to `/app/account?billing_error=1`.
     - No `stripe_customer_id` → log, 303 to
       `/app/account?billing_error=no_customer`. (Defensive: every real Stripe
       subscriber has one, written by the webhook on
       `checkout.session.completed`.)
  3. `getStripe().billingPortal.sessions.create({ customer: stripeCustomerId,
     return_url: ${SITE_URL}/app/account })`.
  4. Success with a `url` → `NextResponse.redirect(session.url, 303)`.
  5. Missing `url` or thrown error → log, 303 to `/app/account?billing_error=1`.

## Part 4 — `app/app/account/page.tsx` (edit)

- Add `stripe_customer_id` to the `profiles` select and `ProfileRow`
  (`stripe_customer_id: string | null`).
- Extend `searchParams` type to `{ welcome?: string; billing_error?: string }`
  and read `billing_error`.
- In the `tier === "pro" && !isFoundingMember` block:
  - Keep the "You're on Pro until {date}." / "You're on Pro." heading and
    "Renews automatically."
  - Drop "To cancel before the next renewal, email hello@dividendmapper.com. The
    self-serve dashboard lands in a couple of weeks."
  - Add a **Manage billing** button: `<form action="/api/billing/portal"
    method="POST">` with a submit button styled like the Sign out button
    (`border border-border bg-background … hover:bg-secondary`).
  - When `billing_error` is set, render an inline notice above the button:
    "Couldn't open the billing portal — email hello@dividendmapper.com and we'll
    sort it." (Same copy for both `1` and `no_customer`; the distinction is for
    logs, not the user.)

## Data flow

```
Account page (Pro, non-founding)
  └─ Manage billing form submit (POST /api/billing/portal)
       └─ resolve userId → profiles.stripe_customer_id
            └─ stripe.billingPortal.sessions.create({ customer, return_url })
                 └─ 303 → Stripe-hosted portal (default config)
                      └─ user cancels / switches plan / updates card
                           └─ return_url → /app/account
                                └─ cancel/switch fires
                                   customer.subscription.updated|deleted
                                   → existing webhook reconciles tier
```

No new webhook handling: portal cancellations and plan switches fire
`customer.subscription.updated` / `customer.subscription.deleted`, already
handled by `app/api/webhooks/stripe/route.ts`.

## Error handling (portal route)

| Condition | Behaviour |
|---|---|
| No session / expired cookie | 303 → `/login?next=/app/account` |
| Profile lookup fails | log, 303 → `/app/account?billing_error=1` |
| No `stripe_customer_id` | log, 303 → `/app/account?billing_error=no_customer` |
| Stripe throws / session has no `url` | log, 303 → `/app/account?billing_error=1` |

All error paths return the user to the account page with a friendly inline
notice rather than a JSON body, because the entry point is a browser form
submit.

## Verification

- `npx tsc --noEmit` (or the project's typecheck script) clean.
- `npm run lint` clean (`next lint` is removed in Next 16; use `npm run lint` /
  eslint).
- New user-facing copy follows em-dash discipline (no em dashes in product
  copy).
- `/privacy` and `/terms` resolve 200 in the deploy preview; footer links no
  longer 404.
- Portal config: confirm the create call returns a `bpc_…` id and `is_default:
  true`.
- Manual live verification deferred to Glenn: open `/app/account` as a
  Stripe-sourced Pro account, click **Manage billing**, confirm the hosted
  portal opens with cancel / payment-method / invoice / plan-switch and returns
  to `/app/account`. Requires a live Stripe customer (Glenn's own account or a
  throwaway paid signup, then refund). Founding-member-only accounts cannot
  exercise the button.

## Notes / constraints

- Next.js 16.2.4 + React 19.2.4. Read `node_modules/next/dist/docs/` before
  writing Next-specific code (per `dividendmapper/AGENTS.md`).
- `SITE_URL` comes from `@/lib/site`, as in the checkout route.
- No `apiVersion` pin on the Stripe client (`lib/billing/stripe.ts`); the
  account-dashboard version governs event/object shapes.
- `.env.local` `STRIPE_SECRET_KEY` is `sk_live_` (backlog item F). Reading it for
  the one-time config call is fine; the broader local-dev safety concern (F) is
  separate and untouched here.
