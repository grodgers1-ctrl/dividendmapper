# Customer Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Stripe-subscribed Pro members self-manage billing (cancel, update card, view invoices, switch monthly↔annual) via Stripe's hosted Customer Portal, after first shipping the `/privacy` and `/terms` pages the portal's cancel feature requires.

**Architecture:** Four ordered parts. (1) Legal pages as MDX route group `app/(legal)/{privacy,terms}/page.mdx` (reuses the blog's `mdx-components.tsx` typography). (2) A one-time live Stripe portal configuration created via direct API call (the CLI is sandbox-paired). (3) A `POST /api/billing/portal` route that mirrors the existing checkout route and 303-redirects to a portal session. (4) Account-page button replacing the "email to cancel" placeholder. Portal cancellations/switches flow through the existing Stripe webhook; no new webhook handling.

**Tech Stack:** Next.js 16.2.4 (App Router, MDX via `@next/mdx`), React 19.2.4, Tailwind v4, Stripe SDK `^22.1.1`, Supabase SSR. No unit-test harness in this project; verification is `npx tsc --noEmit` + `npm run lint` + `npm run build` + targeted curl/manual checks.

---

## Conventions for every task

- All paths are relative to `C:\Users\grodg\dividend_mapper_plan` unless noted. The Next app and `.vercel` link live in `dividendmapper/`.
- Run npm/vercel/tsc/curl commands **from `dividendmapper/`** (`cd /c/Users/grodg/dividend_mapper_plan/dividendmapper`).
- `.env.local` is at `dividendmapper/.env.local`. Load it with `set -a; source .env.local; set +a` (Git Bash). `STRIPE_SECRET_KEY` is `sk_live_…`; `VERCEL_TOKEN` is present.
- Deploys: the Vercel plugin intercepts scope, and the GitHub auto-deploy webhook is flaky, so deploy with the token-fronted CLI from `dividendmapper/`.
- Product copy stays em-dash-free (house style). Legal copy below already avoids em dashes; keep it that way.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `dividendmapper/app/(legal)/layout.tsx` | Shared chrome for legal pages: container + Home breadcrumb | Create |
| `dividendmapper/app/(legal)/privacy/page.mdx` | Privacy policy content + metadata | Create |
| `dividendmapper/app/(legal)/terms/page.mdx` | Terms of service content + metadata | Create |
| `dividendmapper/app/api/billing/portal/route.ts` | Create a billing-portal session and 303 to it | Create |
| `dividendmapper/app/app/account/page.tsx` | Add Manage billing button + billing_error notice; read `stripe_customer_id` | Modify |
| Stripe live account | One-time billing-portal configuration (default) | Create via API |

The `(legal)` route-group segment does not appear in the URL, so the pages resolve at `/privacy` and `/terms` (the URLs the footer already links).

---

## Part 1 — Legal pages

### Task 1: Legal route-group layout

**Files:**
- Create: `dividendmapper/app/(legal)/layout.tsx`

- [ ] **Step 1: Create the layout**

```tsx
import Link from "next/link";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background">
      <div className="border-b border-border bg-card">
        <nav
          aria-label="Breadcrumb"
          className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 text-sm md:px-6"
        >
          <Link
            href="/"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Home
          </Link>
        </nav>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-12">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /c/Users/grodg/dividend_mapper_plan/dividendmapper && npx tsc --noEmit`
Expected: no errors (exit 0).

### Task 2: Privacy page

**Files:**
- Create: `dividendmapper/app/(legal)/privacy/page.mdx`

- [ ] **Step 1: Create the privacy MDX page**

```mdx
export const metadata = {
  title: "Privacy Policy",
  description:
    "How DividendMapper collects, uses, and protects your data under UK GDPR.",
  alternates: { canonical: "/privacy" },
};

# Privacy Policy

_Last updated 25 May 2026_

DividendMapper ("we", "us") provides dividend portfolio tools for UK and US investors. This policy explains what personal data we collect, why we collect it, and your rights under UK GDPR. We are the data controller. For any privacy question, email hello@dividendmapper.com.

## What we collect

**Account details.** Your email address. We use it to sign you in (we use passwordless magic links and one-time codes, not passwords) and to send you service emails.

**Portfolio data.** The holdings, amounts, and account types you choose to enter. You decide what to add, and you can delete any of it at any time.

**Subscription and payment data.** If you upgrade to Pro, our payment processor handles your card details. We never see or store full card numbers. We keep a record of your subscription status and a Stripe customer reference.

**Usage and diagnostics.** Basic analytics about how the app is used, and error reports when something breaks, so we can fix problems and improve the product.

## Who processes your data

We use a small set of trusted providers, each acting on our instructions:

- **Supabase** for our database and authentication, which stores your account and portfolio data.
- **Stripe** for payment processing and subscription billing.
- **Resend** for transactional emails such as sign-in links, receipts, and account notices.
- **PostHog** for product analytics.
- **Sentry** for error monitoring.
- **Vercel** for application hosting.

Some providers may process data outside the UK. Where they do, they rely on appropriate safeguards such as the UK International Data Transfer Agreement or equivalent.

## Why we can use your data

We rely on two legal bases. To provide the service you asked for (performing our contract with you): running your account, storing your portfolio, and billing Pro subscriptions. And our legitimate interests: keeping the app secure, fixing errors, and understanding usage so we can improve it.

## How long we keep it

We keep your account and portfolio data for as long as your account is open. When you delete your account, we delete your profile, holdings, and subscription records. Some limited records, such as payment records that Stripe must retain for tax and accounting, may be kept by our providers as required by law.

## Your rights

Under UK GDPR you can ask us to access the data we hold about you, correct it, delete it, restrict or object to how we use it, or provide it in a portable format. You can delete your account, and all the data tied to it, yourself from the Account page at any time. To exercise any other right, email hello@dividendmapper.com. You also have the right to complain to the Information Commissioner's Office at ico.org.uk.

## Cookies and analytics

We use essential cookies to keep you signed in, and analytics to understand which features are used. We do not sell your data and we do not use it for third-party advertising.

## Changes

We may update this policy as the product changes. The "last updated" date above always shows the current version.
```

- [ ] **Step 2: Verify it has no em dashes**

Run: `cd /c/Users/grodg/dividend_mapper_plan/dividendmapper && grep -n "—" "app/(legal)/privacy/page.mdx" || echo "CLEAN"`
Expected: `CLEAN`.

### Task 3: Terms page

**Files:**
- Create: `dividendmapper/app/(legal)/terms/page.mdx`

- [ ] **Step 1: Create the terms MDX page**

```mdx
export const metadata = {
  title: "Terms of Service",
  description:
    "The terms governing your use of DividendMapper, including the not-financial-advice notice and Pro subscription terms.",
  alternates: { canonical: "/terms" },
};

# Terms of Service

_Last updated 25 May 2026_

These terms govern your use of DividendMapper. By using the site or creating an account, you agree to them. For any question, email hello@dividendmapper.com.

## Not financial or tax advice

**DividendMapper provides informational tools only. Nothing on the site is financial, investment, or tax advice.** Figures, projections, and scores are estimates based on the data you enter and on assumptions that may not fit your circumstances. Past performance is not a reliable indicator of future results. Always do your own research and consult a qualified adviser before making investment decisions.

## Who can use it

You must be at least 18 and able to enter into a contract. You are responsible for keeping your account secure and for activity that happens under it.

## Your account

We sign you in with passwordless magic links and one-time codes. You are responsible for the data you add. You can delete your account, and all associated data, from the Account page at any time.

## Pro subscriptions

- Pro costs £15 per month or £150 per year. Prices include any applicable tax.
- Subscriptions renew automatically at the end of each billing period until you cancel.
- You can cancel any time from the billing portal on your Account page. Cancellation takes effect at the end of the current billing period, and you keep Pro access until then.
- We do not generally give refunds for partial periods, except where required by UK consumer law.
- We may change prices or features. We will give reasonable notice of any change that affects an active subscription, and the new price applies from your next renewal.

## Acceptable use

Do not misuse the service. That means no attempting to break or overload it, no scraping at scale, no unlawful use, and no reselling access without our agreement.

## Our content

The site, its design, and its tools are our intellectual property. The portfolio data you enter remains yours.

## Disclaimers and liability

The service is provided "as is". We do not warrant that figures are accurate or that the service will be uninterrupted or error-free. To the extent the law allows, we are not liable for any loss arising from your use of the service or your reliance on its outputs, including investment losses. Nothing in these terms limits any liability that cannot be limited by law.

## Changes to these terms

We may update these terms as the product evolves. The "last updated" date shows the current version. Continued use after a change means you accept the updated terms.

## Governing law

These terms are governed by the laws of England and Wales, and any disputes are subject to the courts of England and Wales.
```

- [ ] **Step 2: Verify it has no em dashes**

Run: `cd /c/Users/grodg/dividend_mapper_plan/dividendmapper && grep -n "—" "app/(legal)/terms/page.mdx" || echo "CLEAN"`
Expected: `CLEAN`.

### Task 4: Build and commit the legal pages

**Files:** none new.

- [ ] **Step 1: Typecheck**

Run: `cd /c/Users/grodg/dividend_mapper_plan/dividendmapper && npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 2: Lint**

Run: `cd /c/Users/grodg/dividend_mapper_plan/dividendmapper && npm run lint`
Expected: no errors.

- [ ] **Step 3: Build (compiles MDX, confirms the routes exist)**

Run: `cd /c/Users/grodg/dividend_mapper_plan/dividendmapper && npm run build`
Expected: build succeeds and the route list includes `/privacy` and `/terms`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/grodg/dividend_mapper_plan
git add "dividendmapper/app/(legal)/layout.tsx" "dividendmapper/app/(legal)/privacy/page.mdx" "dividendmapper/app/(legal)/terms/page.mdx"
git commit -m "$(cat <<'EOF'
Phase 2 Day 13: add /privacy and /terms legal pages

MDX route group reusing the blog's mdx-components typography. Fixes the
dead footer links and satisfies the Stripe portal cancel-feature
requirement for ToS + privacy URLs. Copy is a first draft for review.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Part 3 — Portal route (built before deploy; depends only on the route file)

### Task 5: Billing portal API route

**Files:**
- Create: `dividendmapper/app/api/billing/portal/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/billing/portal
//
// Form-submit endpoint from /app/account. Resolves the signed-in user's
// Stripe customer id and creates a Billing Portal session, then 303s the
// browser to Stripe's hosted portal. The portal uses the account's default
// configuration (created once via the Stripe API), so no configuration id is
// passed here. Errors redirect back to /app/account with a billing_error flag
// rather than returning JSON, because the entry point is a browser form.

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) {
    return NextResponse.redirect(
      `${SITE_URL}/login?next=${encodeURIComponent("/app/account")}`,
      303,
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle<{ stripe_customer_id: string | null }>();
  if (profileError || !profile) {
    console.error("[billing/portal] profile lookup failed", profileError);
    return NextResponse.redirect(`${SITE_URL}/app/account?billing_error=1`, 303);
  }
  if (!profile.stripe_customer_id) {
    console.warn("[billing/portal] no stripe_customer_id for user", userId);
    return NextResponse.redirect(
      `${SITE_URL}/app/account?billing_error=no_customer`,
      303,
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${SITE_URL}/app/account`,
    });
    if (!session.url) {
      console.error("[billing/portal] session created without url");
      return NextResponse.redirect(
        `${SITE_URL}/app/account?billing_error=1`,
        303,
      );
    }
    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error("[billing/portal] session creation failed", err);
    return NextResponse.redirect(`${SITE_URL}/app/account?billing_error=1`, 303);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /c/Users/grodg/dividend_mapper_plan/dividendmapper && npx tsc --noEmit`
Expected: exit 0. (Confirms `getStripe().billingPortal.sessions.create` exists on Stripe SDK 22.x and the Supabase types line up with the checkout route's usage.)

---

## Part 4 — Account page button

### Task 6: Add Manage billing button + billing_error notice

**Files:**
- Modify: `dividendmapper/app/app/account/page.tsx`

- [ ] **Step 1: Add `stripe_customer_id` to the `ProfileRow` type**

Find (lines 16-22):

```tsx
type ProfileRow = {
  email: string;
  tier: "free" | "pro" | "premium";
  tier_source: "free" | "stripe" | "founding_member";
  tier_expires_at: string | null;
  founding_member: boolean;
};
```

Replace with:

```tsx
type ProfileRow = {
  email: string;
  tier: "free" | "pro" | "premium";
  tier_source: "free" | "stripe" | "founding_member";
  tier_expires_at: string | null;
  founding_member: boolean;
  stripe_customer_id: string | null;
};
```

- [ ] **Step 2: Add `billing_error` to the page's searchParams type**

Find (lines 44-46):

```tsx
interface AccountPageProps {
  searchParams: Promise<{ welcome?: string }>;
}
```

Replace with:

```tsx
interface AccountPageProps {
  searchParams: Promise<{ welcome?: string; billing_error?: string }>;
}
```

- [ ] **Step 3: Read the `billing_error` flag**

Find (lines 53-55):

```tsx
  const params = await searchParams;
  const showWelcome = params.welcome === "1";
  const pricingPublic = isPricingPublic();
```

Replace with:

```tsx
  const params = await searchParams;
  const showWelcome = params.welcome === "1";
  const billingError = typeof params.billing_error === "string";
  const pricingPublic = isPricingPublic();
```

- [ ] **Step 4: Select `stripe_customer_id` in the profile query**

Find (lines 61-65):

```tsx
    supabase
      .from("profiles")
      .select("email, tier, tier_source, tier_expires_at, founding_member")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>(),
```

Replace with:

```tsx
    supabase
      .from("profiles")
      .select(
        "email, tier, tier_source, tier_expires_at, founding_member, stripe_customer_id",
      )
      .eq("id", user.id)
      .maybeSingle<ProfileRow>(),
```

- [ ] **Step 5: Replace the Pro non-founding block with the Manage billing UI**

Find (lines 211-224):

```tsx
        {tier === "pro" && !isFoundingMember && (
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="font-display text-sm font-semibold text-foreground">
              {expiresLabel
                ? `You're on Pro until ${expiresLabel}.`
                : "You're on Pro."}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Renews automatically. To cancel before the next renewal, email
              hello@dividendmapper.com. The self-serve dashboard lands in a
              couple of weeks.
            </p>
          </div>
        )}
```

Replace with:

```tsx
        {tier === "pro" && !isFoundingMember && (
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="font-display text-sm font-semibold text-foreground">
              {expiresLabel
                ? `You're on Pro until ${expiresLabel}.`
                : "You're on Pro."}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Renews automatically. Manage your plan, payment method, and
              invoices in the billing portal.
            </p>
            {billingError && (
              <p role="alert" className="mt-3 text-sm text-negative">
                Couldn&apos;t open the billing portal. Email
                hello@dividendmapper.com and we&apos;ll sort it.
              </p>
            )}
            <form action="/api/billing/portal" method="POST" className="mt-3">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Manage billing
              </button>
            </form>
          </div>
        )}
```

- [ ] **Step 6: Verify no em dashes were introduced**

Run: `cd /c/Users/grodg/dividend_mapper_plan/dividendmapper && grep -n "—" app/app/account/page.tsx || echo "CLEAN"`
Expected: `CLEAN`.

### Task 7: Build and commit route + account button

- [ ] **Step 1: Typecheck**

Run: `cd /c/Users/grodg/dividend_mapper_plan/dividendmapper && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Lint**

Run: `cd /c/Users/grodg/dividend_mapper_plan/dividendmapper && npm run lint`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `cd /c/Users/grodg/dividend_mapper_plan/dividendmapper && npm run build`
Expected: build succeeds; route list includes `/api/billing/portal`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/grodg/dividend_mapper_plan
git add dividendmapper/app/api/billing/portal/route.ts dividendmapper/app/app/account/page.tsx
git commit -m "$(cat <<'EOF'
Phase 2 Day 13: Customer Portal route + Manage billing button

POST /api/billing/portal mirrors the checkout route, 303-ing to a Stripe
billing-portal session using the account's default config. Account page
replaces the "email to cancel" placeholder with a Manage billing form
submit and an inline billing_error notice.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Part 2 — Deploy, then create the live portal configuration

### Task 8: Deploy to production and verify legal pages are live

- [ ] **Step 1: Deploy via the token-fronted CLI**

```bash
cd /c/Users/grodg/dividend_mapper_plan/dividendmapper
set -a; source .env.local; set +a
npx vercel deploy --prod --token "$VERCEL_TOKEN" --yes
```
Expected: a production deployment URL is printed and the build completes.

- [ ] **Step 2: Verify the legal pages return 200 (footer links no longer 404)**

```bash
curl -s -o /dev/null -w "privacy %{http_code}\n" https://dividendmapper.com/privacy
curl -s -o /dev/null -w "terms %{http_code}\n" https://dividendmapper.com/terms
```
Expected: `privacy 200` and `terms 200`.

### Task 9: Create the live billing-portal configuration

This is a one-time live-account mutation. The first portal configuration created becomes the account default automatically, so the route needs no configuration id. Run only after Task 8 confirms the legal pages are live.

- [ ] **Step 1: Create the configuration via the Stripe API**

```bash
cd /c/Users/grodg/dividend_mapper_plan/dividendmapper
set -a; source .env.local; set +a
curl -s https://api.stripe.com/v1/billing_portal/configurations \
  -u "$STRIPE_SECRET_KEY:" \
  -d "business_profile[privacy_policy_url]=https://dividendmapper.com/privacy" \
  -d "business_profile[terms_of_service_url]=https://dividendmapper.com/terms" \
  -d "features[invoice_history][enabled]=true" \
  -d "features[payment_method_update][enabled]=true" \
  -d "features[customer_update][enabled]=false" \
  -d "features[subscription_cancel][enabled]=true" \
  -d "features[subscription_cancel][mode]=at_period_end" \
  -d "features[subscription_update][enabled]=true" \
  -d "features[subscription_update][default_allowed_updates][]=price" \
  -d "features[subscription_update][proration_behavior]=create_prorations" \
  -d "features[subscription_update][products][0][product]=prod_UYH4LmCH8oF9Eq" \
  -d "features[subscription_update][products][0][prices][]=price_1Taa3MPblTYo14ejlPL2xKeo" \
  -d "features[subscription_update][products][0][prices][]=price_1Taa3MPblTYo14ejIptmrw7a" \
  > /tmp/portal-config.json
python -c "import json; d=json.load(open('/tmp/portal-config.json')); print('id:', d.get('id')); print('is_default:', d.get('is_default')); print('active:', d.get('active')); print('livemode:', d.get('livemode')); print('error:', d.get('error'))"
```
Expected: `id: bpc_…`, `is_default: True`, `active: True`, `livemode: True`, `error: None`.

- [ ] **Step 2: Branch on the result**

  - If `is_default: True` and `livemode: True` → done. Record the `bpc_…` id for the EOD note.
  - If `error` is non-null → read the message. A "terms of service" / "privacy policy" complaint means the URLs were rejected; confirm Task 8 returned 200 for both and re-run. A key error means `STRIPE_SECRET_KEY` did not load as `sk_live_`; re-source `.env.local`.
  - If `is_default: False` → a default portal config already exists on the account. **Stop and report** rather than shipping: the route relies on the default, so we would need to either pass this config id explicitly via a new `STRIPE_PORTAL_CONFIGURATION_ID` env var (and add `configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID` to `sessions.create`) or reconcile the existing default. Surface this to Glenn for a decision.

### Task 10: Live verification handoff

Manual live verification needs a Stripe-sourced Pro account; founding-member-only accounts (including Glenn's own) do not see the Manage billing button. This step is Glenn's to run.

- [ ] **Step 1: Hand off the click-test checklist to Glenn**

Ask Glenn to, using a live Stripe-subscribed Pro account (his own Stripe-sourced account or a throwaway paid signup that he later refunds):
1. Open `/app/account` and confirm the **Manage billing** button shows in the Pro section.
2. Click it and confirm Stripe's hosted portal opens showing: cancel subscription, update payment method, invoice history, and switch monthly↔annual.
3. Click "return to DividendMapper" and confirm it lands back on `/app/account`.
4. Optionally cancel-at-period-end in the portal and confirm the account page still reads "You're on Pro." (tier flips to free only at period end via `customer.subscription.updated`).

- [ ] **Step 2: Record the outcome**

After Glenn confirms, write an EOD memory capturing: the live `bpc_…` configuration id, that the portal is wired and verified, and that `reference_stripe_ids` should be updated with the portal config id. Link `[[state-2026-05-24-eod-day12-phase2-launch]]`.

---

## Self-review notes

- **Spec coverage:** Part 1 (legal pages) → Tasks 1-4. Part 2 (live config) → Tasks 8-9. Part 3 (route) → Task 5. Part 4 (account button) → Task 6. Verification section → Tasks 4, 7, 8, 9, 10. All spec sections map to tasks.
- **Type consistency:** `ProfileRow.stripe_customer_id` (Task 6 Step 1) matches the `.select(...)` column (Step 4) and the route's `maybeSingle<{ stripe_customer_id: string | null }>()` (Task 5). `billingError` (boolean, Task 6 Step 3) matches its use in the JSX (Step 5). `billing_error` query values (`1`, `no_customer`) emitted by the route (Task 5) match the page's presence-check (any string → notice).
- **No new webhook work:** confirmed portal cancel/switch events (`customer.subscription.updated|deleted`) are already handled in `app/api/webhooks/stripe/route.ts`.
