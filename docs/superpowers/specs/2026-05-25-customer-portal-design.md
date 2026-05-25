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

## Scope

In scope:

- A new `POST /api/billing/portal` route that creates a Stripe billing-portal
  session and 303-redirects the browser to it.
- An account-page change: replace the "email hello@…" cancellation sentence with
  a **Manage billing** button for Pro, non-founding members, plus an inline
  error notice when a portal session can't be created.
- A one-time Stripe Dashboard configuration step (live mode), done by Glenn.

Out of scope:

- The founding-member-converts-to-Stripe display bug (backlog item B). First
  founder expiry is 2026-11-25, so it is not launch-blocking and is untouched
  here.
- Any change to the founding-member block or codes UI.
- API-managed portal configuration (we chose dashboard config; see Decisions).

## Decisions

1. **Portal configured via the Stripe Dashboard, not the API.** Live mode
   requires a saved portal configuration before `billingPortal.sessions.create`
   succeeds. Glenn configures it once in the dashboard, matching how the
   product, prices, and coupon were set up. No configuration code in the repo.
2. **Server-driven form submit, not client fetch.** The button is a plain
   `<form action="/api/billing/portal" method="POST">` submit, mirroring the
   existing `/api/billing/checkout` pattern (303-redirect to a Stripe-hosted
   URL). No client component, no JS.
3. **Button shown only to `tier === "pro" && !isFoundingMember`.** Founding
   members have no Stripe customer/subscription, so they get no portal button;
   their existing block is unchanged.

## Components

### 1. `app/api/billing/portal/route.ts` (new)

Mirrors `app/api/billing/checkout/route.ts`.

- `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.
- `POST(req)`:
  1. `createSupabaseServerClient()` → `getClaims()` → `userId`. No `userId` →
     303 to `${SITE_URL}/login?next=${encodeURIComponent("/app/account")}`.
  2. Read `profiles.stripe_customer_id` for `userId` (`maybeSingle`).
     - Lookup error or no profile → log, 303 to
       `${SITE_URL}/app/account?billing_error=1`.
     - No `stripe_customer_id` → log, 303 to
       `${SITE_URL}/app/account?billing_error=no_customer`. (Defensive: every
       real Stripe subscriber has one, written by the webhook on
       `checkout.session.completed`.)
  3. `getStripe().billingPortal.sessions.create({ customer: stripeCustomerId,
     return_url: ${SITE_URL}/app/account })`.
  4. Success with a `url` → `NextResponse.redirect(session.url, 303)`.
  5. Missing `url` or thrown error (e.g. portal not yet configured in live
     mode) → log, 303 to `${SITE_URL}/app/account?billing_error=1`.

### 2. `app/app/account/page.tsx` (edit)

- Add `stripe_customer_id` to the `profiles` select and to `ProfileRow`
  (`stripe_customer_id: string | null`).
- Read `billing_error` from `searchParams` (extend the
  `searchParams: Promise<{ welcome?: string; billing_error?: string }>` type).
- In the `tier === "pro" && !isFoundingMember` block:
  - Keep the "You're on Pro until {date}." / "You're on Pro." heading.
  - Keep "Renews automatically." Drop the sentence "To cancel before the next
    renewal, email hello@dividendmapper.com. The self-serve dashboard lands in
    a couple of weeks."
  - Add a **Manage billing** button: a `<form action="/api/billing/portal"
    method="POST">` with a submit button styled like the existing Sign out
    button (secondary: `border border-border bg-background … hover:bg-secondary`).
  - When `billing_error` is set, render an inline notice above the button:
    "Couldn't open the billing portal — email hello@dividendmapper.com and
    we'll sort it." (Same copy for both `1` and `no_customer`; the distinction
    is for logs, not the user.)

### 3. Stripe Dashboard configuration (Glenn, one-time, live mode)

Settings → Billing → Customer portal, in **live** mode:

- **Cancellations:** allow customers to cancel subscriptions (immediately or at
  period end — recommend "at end of billing period").
- **Payment methods:** allow customers to update their payment method.
- **Invoice history:** show invoice history.
- **Subscription update / switch plans:** allow switching between the Pro
  monthly (`price_1Taa3MPblTYo14ejlPL2xKeo`) and Pro annual
  (`price_1Taa3MPblTYo14ejIptmrw7a`) prices.
- **Save** — this creates the default live configuration that
  `sessions.create` needs.

## Data flow

```
Account page (Pro, non-founding)
  └─ Manage billing form submit (POST /api/billing/portal)
       └─ resolve userId → profiles.stripe_customer_id
            └─ stripe.billingPortal.sessions.create({ customer, return_url })
                 └─ 303 → Stripe-hosted portal
                      └─ user manages billing
                           └─ return_url → /app/account
                                └─ (cancel/plan-change fires
                                    customer.subscription.updated/deleted →
                                    existing webhook handler reconciles tier)
```

No new webhook handling is needed: cancellations and plan switches made in the
portal fire `customer.subscription.updated` / `customer.subscription.deleted`,
already handled by `app/api/webhooks/stripe/route.ts`.

## Error handling

| Condition | Behaviour |
|---|---|
| No session / expired cookie | 303 → `/login?next=/app/account` |
| Profile lookup fails | log, 303 → `/app/account?billing_error=1` |
| No `stripe_customer_id` | log, 303 → `/app/account?billing_error=no_customer` |
| Stripe throws / no portal config | log, 303 → `/app/account?billing_error=1` |
| Session created without `url` | log, 303 → `/app/account?billing_error=1` |

All error paths return the user to the account page with a friendly inline
notice rather than a JSON error body, because the entry point is a browser form
submit.

## Verification

- `npx tsc --noEmit` (or the project's typecheck script) clean.
- `npm run lint` clean (per [[reference-next16-lint]], `next lint` is removed in
  Next 16).
- Em-dash discipline: any new user-facing copy runs clean through the humaniser
  conventions (no em dashes in product copy).
- Manual live verification is deferred to Glenn: it requires a live Stripe
  customer (Glenn's own Stripe-sourced Pro account or a throwaway paid signup,
  then refund). Founding-member-only accounts can't exercise the button.

## Notes / constraints

- Next.js 16.2.4 + React 19.2.4. Read `node_modules/next/dist/docs/` before
  writing Next-specific code (per `dividendmapper/AGENTS.md`).
- `SITE_URL` comes from `@/lib/site`, as in the checkout route.
- No `apiVersion` pin on the Stripe client (`lib/billing/stripe.ts`); the
  account-dashboard version governs event/object shapes.
