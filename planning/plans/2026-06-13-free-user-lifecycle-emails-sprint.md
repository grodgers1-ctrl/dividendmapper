# Free-user lifecycle emails — sprint plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a 6-email lifecycle program for free-tier users that welcomes signups, pushes activation, time-delays a Pro pitch, sends a monthly value recap, and ends with a 50% off first-month code at day 60.

**Architecture:** Daily 07:30 UTC cron walks each free user through a typed `sequence` of 6 steps. Each step has a pure skip-gate (e.g. "skip activation nudge if user already has holdings"). Idempotency via the existing `sent_emails` table — one row per (user, step). New React Email templates. One column added to `profiles` for unsubscribe flag. One Stripe coupon for the day-60 code.

**Tech Stack:** Next.js 16 App Router, Supabase (service-role client server-side), Resend, React Email, Vercel Cron, Stripe, vitest, PostHog.

**Reference docs:**

- Design spec: [planning/plans/2026-06-13-free-user-lifecycle-emails-design.md](planning/plans/2026-06-13-free-user-lifecycle-emails-design.md)
- Voice anchors: `super_user/sends/2026-06-08-bernard-themis-welcome.txt`, `super_user/templates/welcome-reply.txt`, `dividendmapper/emails/welcome-founding-member.tsx`
- Pattern to mirror: `dividendmapper/app/api/internal/send-score-alerts/route.ts` (cron + idempotent send loop)
- Humaniser linter: `scripts/lint/humaniser.js` — mandatory pass on every body before commit

---

## Task 1: Database migration — add unsubscribe column

**Files:**
- Create: `dividendmapper/supabase/migrations/0013_lifecycle_emails.sql`

- [ ] **Step 1: Create the migration file using the Supabase CLI**

Run (from `dividendmapper/`):

```bash
set -a && source .env.local && set +a && npx supabase migration new lifecycle_emails
```

Expected: prints `Created new migration at supabase/migrations/<timestamp>_lifecycle_emails.sql`. Rename the file to `0013_lifecycle_emails.sql` to match the project's numbered convention.

- [ ] **Step 2: Write the migration content**

```sql
-- Lifecycle email program: per-user unsubscribe flag for non-transactional sends.
-- Transactional emails (welcome_free, activation_nudge) ignore this flag.
-- Marketing emails (score_explainer, pro_pitch_1, monthly_recap, pro_pitch_final)
-- honour it. The unsubscribe route flips this column to true.

alter table public.profiles
  add column lifecycle_emails_unsubscribed boolean not null default false;
```

- [ ] **Step 3: Apply against the linked Supabase project (dry-run first)**

```bash
set -a && source .env.local && set +a && npx supabase db push --linked --dry-run
```

Expected: prints planned statements, includes the `alter table` from above. No errors.

- [ ] **Step 4: Apply for real**

```bash
set -a && source .env.local && set +a && npx supabase db push --linked --yes
```

Expected: `Applying migration ... 0013_lifecycle_emails.sql` and success message.

- [ ] **Step 5: Verify on the live schema**

```bash
set -a && source .env.local && set +a && npx supabase db query --linked "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='lifecycle_emails_unsubscribed';"
```

Expected: one row, `boolean`, default `false`.

- [ ] **Step 6: Commit**

```bash
git add dividendmapper/supabase/migrations/0013_lifecycle_emails.sql
git commit -m "db(lifecycle): add profiles.lifecycle_emails_unsubscribed"
```

---

## Task 2: Sequence definition (types + step list, no logic yet)

**Files:**
- Create: `dividendmapper/lib/email/lifecycle/sequence.ts`
- Create: `dividendmapper/lib/email/lifecycle/__tests__/sequence.test.ts`

- [ ] **Step 1: Write the failing test**

`dividendmapper/lib/email/lifecycle/__tests__/sequence.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SEQUENCE, type LifecycleStepKey } from "../sequence";

describe("lifecycle SEQUENCE", () => {
  it("has 6 steps in ascending day order", () => {
    expect(SEQUENCE).toHaveLength(6);
    const days = SEQUENCE.map((s) => s.daysAfterSignup);
    expect(days).toEqual([0, 3, 7, 14, 30, 60]);
  });

  it("has unique step keys", () => {
    const keys = SEQUENCE.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("marks the welcome and activation nudge as transactional", () => {
    const byKey = Object.fromEntries(SEQUENCE.map((s) => [s.key, s])) as Record<
      LifecycleStepKey,
      (typeof SEQUENCE)[number]
    >;
    expect(byKey.welcome_free.transactional).toBe(true);
    expect(byKey.activation_nudge.transactional).toBe(true);
    expect(byKey.score_explainer.transactional).toBe(false);
    expect(byKey.pro_pitch_1.transactional).toBe(false);
    expect(byKey.monthly_recap.transactional).toBe(false);
    expect(byKey.pro_pitch_final.transactional).toBe(false);
  });

  it("each step has a non-empty subject", () => {
    for (const step of SEQUENCE) {
      expect(step.subject.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/sequence.test.ts
```

Expected: FAIL — `Cannot find module '../sequence'`.

- [ ] **Step 3: Write the sequence module (types and step list only — no template imports yet)**

`dividendmapper/lib/email/lifecycle/sequence.ts`:

```ts
// The 6-step lifecycle sequence. Each entry is one email. The cron walks every
// free user against this list daily; idempotency via sent_emails.send_key.
// Skip-gates and template components are wired in later tasks.

export type LifecycleStepKey =
  | "welcome_free"
  | "activation_nudge"
  | "score_explainer"
  | "pro_pitch_1"
  | "monthly_recap"
  | "pro_pitch_final";

export interface LifecycleStep {
  key: LifecycleStepKey;
  daysAfterSignup: number;
  subject: string;
  transactional: boolean;
}

export const SEQUENCE: readonly LifecycleStep[] = [
  {
    key: "welcome_free",
    daysAfterSignup: 0,
    subject: "Welcome to DividendMapper",
    transactional: true,
  },
  {
    key: "activation_nudge",
    daysAfterSignup: 3,
    subject: "Add a holding to see what the score does",
    transactional: true,
  },
  {
    key: "score_explainer",
    daysAfterSignup: 7,
    subject: "Here's what your resilience score is telling you",
    transactional: false,
  },
  {
    key: "pro_pitch_1",
    daysAfterSignup: 14,
    subject: "Here's what Pro would say about your portfolio today",
    transactional: false,
  },
  {
    key: "monthly_recap",
    daysAfterSignup: 30,
    subject: "Your DividendMapper recap",
    transactional: false,
  },
  {
    key: "pro_pitch_final",
    daysAfterSignup: 60,
    subject: "50% off your first month of Pro",
    transactional: false,
  },
] as const;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/sequence.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/lib/email/lifecycle/sequence.ts dividendmapper/lib/email/lifecycle/__tests__/sequence.test.ts
git commit -m "feat(lifecycle): sequence definition with 6 steps"
```

---

## Task 3: Skip-gates module (pure functions)

**Files:**
- Create: `dividendmapper/lib/email/lifecycle/skip-gates.ts`
- Create: `dividendmapper/lib/email/lifecycle/__tests__/skip-gates.test.ts`

- [ ] **Step 1: Write the failing test**

`dividendmapper/lib/email/lifecycle/__tests__/skip-gates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { evalSkipGate, type SkipContext } from "../skip-gates";

function ctx(over: Partial<SkipContext> = {}): SkipContext {
  return {
    holdingsCount: 0,
    tier: "free",
    lifecycleUnsubscribed: false,
    lastSignInAtMs: Date.now(),
    nowMs: Date.now(),
    ...over,
  };
}

describe("evalSkipGate", () => {
  describe("welcome_free", () => {
    it("never skips", () => {
      expect(evalSkipGate("welcome_free", ctx())).toBe(false);
      expect(evalSkipGate("welcome_free", ctx({ holdingsCount: 99 }))).toBe(false);
    });
  });

  describe("activation_nudge", () => {
    it("skips if user already has any holdings", () => {
      expect(evalSkipGate("activation_nudge", ctx({ holdingsCount: 1 }))).toBe(true);
    });
    it("does not skip if user has zero holdings", () => {
      expect(evalSkipGate("activation_nudge", ctx({ holdingsCount: 0 }))).toBe(false);
    });
  });

  describe("score_explainer", () => {
    it("skips if user has zero holdings", () => {
      expect(evalSkipGate("score_explainer", ctx({ holdingsCount: 0 }))).toBe(true);
    });
    it("does not skip if user has at least one holding", () => {
      expect(evalSkipGate("score_explainer", ctx({ holdingsCount: 1 }))).toBe(false);
    });
  });

  describe("pro_pitch_1", () => {
    it("skips if zero holdings", () => {
      expect(evalSkipGate("pro_pitch_1", ctx({ holdingsCount: 0 }))).toBe(true);
    });
    it("skips if user is already Pro", () => {
      expect(evalSkipGate("pro_pitch_1", ctx({ holdingsCount: 5, tier: "pro" }))).toBe(true);
    });
    it("does not skip free user with holdings", () => {
      expect(evalSkipGate("pro_pitch_1", ctx({ holdingsCount: 3 }))).toBe(false);
    });
  });

  describe("monthly_recap", () => {
    it("skips if zero holdings", () => {
      expect(evalSkipGate("monthly_recap", ctx({ holdingsCount: 0 }))).toBe(true);
    });
    it("skips if Pro", () => {
      expect(evalSkipGate("monthly_recap", ctx({ holdingsCount: 5, tier: "pro" }))).toBe(true);
    });
    it("does not skip free with holdings", () => {
      expect(evalSkipGate("monthly_recap", ctx({ holdingsCount: 1 }))).toBe(false);
    });
  });

  describe("pro_pitch_final", () => {
    it("skips if Pro", () => {
      expect(evalSkipGate("pro_pitch_final", ctx({ tier: "pro" }))).toBe(true);
    });
    it("skips if fully dormant (no recent sign-in AND no holdings)", () => {
      const day = 24 * 60 * 60 * 1000;
      const now = Date.now();
      expect(
        evalSkipGate(
          "pro_pitch_final",
          ctx({ holdingsCount: 0, lastSignInAtMs: now - 31 * day, nowMs: now }),
        ),
      ).toBe(true);
    });
    it("does not skip a free user with holdings", () => {
      expect(evalSkipGate("pro_pitch_final", ctx({ holdingsCount: 1 }))).toBe(false);
    });
    it("does not skip a free user with no holdings but recent sign-in", () => {
      const day = 24 * 60 * 60 * 1000;
      const now = Date.now();
      expect(
        evalSkipGate(
          "pro_pitch_final",
          ctx({ holdingsCount: 0, lastSignInAtMs: now - 5 * day, nowMs: now }),
        ),
      ).toBe(false);
    });
  });

  describe("unsubscribe", () => {
    it("non-transactional steps skip when unsubscribed", () => {
      const c = ctx({ holdingsCount: 5, lifecycleUnsubscribed: true });
      expect(evalSkipGate("score_explainer", c)).toBe(true);
      expect(evalSkipGate("pro_pitch_1", c)).toBe(true);
      expect(evalSkipGate("monthly_recap", c)).toBe(true);
      expect(evalSkipGate("pro_pitch_final", c)).toBe(true);
    });
    it("transactional steps ignore unsubscribed", () => {
      const c = ctx({ lifecycleUnsubscribed: true });
      expect(evalSkipGate("welcome_free", c)).toBe(false);
      expect(evalSkipGate("activation_nudge", c)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/skip-gates.test.ts
```

Expected: FAIL — `Cannot find module '../skip-gates'`.

- [ ] **Step 3: Write skip-gates.ts**

`dividendmapper/lib/email/lifecycle/skip-gates.ts`:

```ts
// Pure skip-gates per lifecycle step. Each returns true if the email for this
// step should NOT be sent to this user right now. Tested in isolation; the
// cron orchestrator combines these with the time gate and the sent_emails
// idempotency check.

import { SEQUENCE, type LifecycleStepKey } from "./sequence";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SkipContext {
  holdingsCount: number;
  tier: "free" | "pro" | "premium";
  lifecycleUnsubscribed: boolean;
  lastSignInAtMs: number | null;
  nowMs: number;
}

const STEPS_BY_KEY = Object.fromEntries(SEQUENCE.map((s) => [s.key, s])) as Record<
  LifecycleStepKey,
  (typeof SEQUENCE)[number]
>;

export function evalSkipGate(key: LifecycleStepKey, ctx: SkipContext): boolean {
  const step = STEPS_BY_KEY[key];
  if (!step) return true;

  if (!step.transactional && ctx.lifecycleUnsubscribed) return true;

  switch (key) {
    case "welcome_free":
      return false;

    case "activation_nudge":
      return ctx.holdingsCount >= 1;

    case "score_explainer":
      return ctx.holdingsCount === 0;

    case "pro_pitch_1":
      if (ctx.tier !== "free") return true;
      return ctx.holdingsCount === 0;

    case "monthly_recap":
      if (ctx.tier !== "free") return true;
      return ctx.holdingsCount === 0;

    case "pro_pitch_final": {
      if (ctx.tier !== "free") return true;
      const dormantNoHoldings =
        ctx.holdingsCount === 0 &&
        ctx.lastSignInAtMs !== null &&
        ctx.nowMs - ctx.lastSignInAtMs > 30 * DAY_MS;
      return dormantNoHoldings;
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/skip-gates.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/lib/email/lifecycle/skip-gates.ts dividendmapper/lib/email/lifecycle/__tests__/skip-gates.test.ts
git commit -m "feat(lifecycle): pure skip-gate functions per step"
```

---

## Task 4: Reuse + extend `unsub-token` for lifecycle unsubscribe

**Files:**
- Modify: `dividendmapper/lib/alerts/unsub-token.ts:1-29` (rename and broaden) — OR add a sibling module if rename feels invasive.

We'll keep the alerts token intact and add a sibling for lifecycle (separates concerns: an alerts unsub shouldn't also flip the lifecycle flag and vice versa).

**Files:**
- Create: `dividendmapper/lib/email/lifecycle/unsub-token.ts`
- Create: `dividendmapper/lib/email/lifecycle/__tests__/unsub-token.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { signLifecycleUnsubToken, verifyLifecycleUnsubToken } from "../unsub-token";

const SECRET = "test-secret";

describe("lifecycle unsub token", () => {
  it("round-trips a user id", () => {
    const tok = signLifecycleUnsubToken("user-123", SECRET);
    expect(verifyLifecycleUnsubToken(tok, SECRET)).toBe("user-123");
  });
  it("rejects a tampered token", () => {
    const tok = signLifecycleUnsubToken("user-123", SECRET);
    const bad = tok.slice(0, -2) + "ZZ";
    expect(verifyLifecycleUnsubToken(bad, SECRET)).toBeNull();
  });
  it("rejects a token signed with a different secret", () => {
    const tok = signLifecycleUnsubToken("user-123", SECRET);
    expect(verifyLifecycleUnsubToken(tok, "other-secret")).toBeNull();
  });
  it("rejects malformed input", () => {
    expect(verifyLifecycleUnsubToken("", SECRET)).toBeNull();
    expect(verifyLifecycleUnsubToken("no-dot", SECRET)).toBeNull();
  });
  it("namespace-isolates from the alerts token", async () => {
    // An alerts token for the same user must NOT verify as a lifecycle token.
    const { signUnsubToken } = await import("@/lib/alerts/unsub-token");
    const alertsTok = signUnsubToken("user-123", SECRET);
    expect(verifyLifecycleUnsubToken(alertsTok, SECRET)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/unsub-token.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement with a namespace prefix to keep it isolated from alerts**

`dividendmapper/lib/email/lifecycle/unsub-token.ts`:

```ts
import { createHmac, timingSafeEqual } from "crypto";

// Namespace-prefixed sibling of lib/alerts/unsub-token.ts. The 'lc:' prefix
// goes through the HMAC so an alerts token for the same user does not verify
// as a lifecycle token (and vice versa). The cron secret is reused as the
// signing secret, same as alerts.

const NS = "lc:";

export function signLifecycleUnsubToken(userId: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(NS + userId).digest("base64url");
  return `${Buffer.from(userId).toString("base64url")}.${mac}`;
}

export function verifyLifecycleUnsubToken(token: string, secret: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  let userId: string;
  try {
    userId = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!userId) return null;

  const expected = createHmac("sha256", secret).update(NS + userId).digest("base64url");
  const given = Buffer.from(parts[1]);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  return userId;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/unsub-token.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/lib/email/lifecycle/unsub-token.ts dividendmapper/lib/email/lifecycle/__tests__/unsub-token.test.ts
git commit -m "feat(lifecycle): namespaced HMAC unsubscribe token"
```

---

## Task 5: Add custom headers support to `sendIdempotent`

The List-Unsubscribe headers are required by Gmail/Yahoo bulk-sender rules. The current `sendIdempotent` doesn't accept headers; we add an optional param.

**Files:**
- Modify: `dividendmapper/lib/email/send.ts`
- Create: `dividendmapper/lib/email/__tests__/send.test.ts` (only if not present — check first)

- [ ] **Step 1: Check whether send.ts already has tests**

```bash
ls dividendmapper/lib/email/__tests__/ 2>&1
```

If `send.test.ts` exists, append to it. If not, create the file.

- [ ] **Step 2: Write the failing test**

Either create or append:

```ts
import { describe, it, expect, vi } from "vitest";
import { sendIdempotent } from "../send";
import type { ReactElement } from "react";

vi.mock("../resend", () => ({
  EMAIL_FROM: "from@x",
  EMAIL_REPLY_TO: "reply@x",
  getResend: () => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "e1" }, error: null }),
    },
  }),
}));

function fakeSupabase() {
  return {
    from: () => ({
      insert: () => ({
        select: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { id: "row-1" }, error: null }),
        }),
      }),
    }),
  } as never;
}

describe("sendIdempotent headers passthrough", () => {
  it("forwards optional headers to Resend", async () => {
    const { getResend } = await import("../resend");
    const sendSpy = getResend().emails.send as ReturnType<typeof vi.fn>;
    sendSpy.mockClear();

    await sendIdempotent({
      to: "t@x",
      subject: "s",
      template: "tpl",
      sendKey: `tpl_${Math.random()}`,
      userId: "u1",
      body: { type: "div", props: {}, key: null } as unknown as ReactElement,
      supabase: fakeSupabase(),
      headers: {
        "List-Unsubscribe": "<https://x/unsub?t=abc>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const arg = sendSpy.mock.calls[0][0];
    expect(arg.headers).toEqual({
      "List-Unsubscribe": "<https://x/unsub?t=abc>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("does not include headers when caller omits them", async () => {
    const { getResend } = await import("../resend");
    const sendSpy = getResend().emails.send as ReturnType<typeof vi.fn>;
    sendSpy.mockClear();

    await sendIdempotent({
      to: "t@x",
      subject: "s",
      template: "tpl",
      sendKey: `tpl_${Math.random()}`,
      userId: "u1",
      body: { type: "div", props: {}, key: null } as unknown as ReactElement,
      supabase: fakeSupabase(),
    });
    const arg = sendSpy.mock.calls[0][0];
    expect(arg.headers).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to confirm it fails**

```bash
cd dividendmapper && npx vitest run lib/email/__tests__/send.test.ts
```

Expected: FAIL — either `headers` is missing on `SendOptions` (typecheck) or the assertion that Resend received headers fails.

- [ ] **Step 4: Update `send.ts` to accept and forward `headers`**

Edit `dividendmapper/lib/email/send.ts`. Add `headers?: Record<string, string>` to `SendOptions`, then in the Resend call:

```ts
interface SendOptions {
  to: string;
  subject: string;
  template: string;
  sendKey: string;
  userId?: string | null;
  body: ReactElement;
  supabase: SupabaseClient;
  headers?: Record<string, string>;
}

// ... inside sendIdempotent, replace the existing emails.send call:
const result = await getResend().emails.send({
  from: EMAIL_FROM,
  to: opts.to,
  replyTo: EMAIL_REPLY_TO,
  subject: opts.subject,
  html,
  ...(opts.headers ? { headers: opts.headers } : {}),
});
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd dividendmapper && npx vitest run lib/email/__tests__/send.test.ts
```

Expected: both tests pass.

- [ ] **Step 6: Run the broader test suite to confirm no regression**

```bash
cd dividendmapper && npx vitest run lib/email
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add dividendmapper/lib/email/send.ts dividendmapper/lib/email/__tests__/send.test.ts
git commit -m "feat(email): sendIdempotent forwards optional headers to Resend"
```

---

## Task 6: `welcome_free` template

**Files:**
- Create: `dividendmapper/emails/lifecycle-welcome-free.tsx`
- Create: `dividendmapper/emails/__tests__/lifecycle-welcome-free.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { LifecycleWelcomeFreeEmail } from "../lifecycle-welcome-free";

describe("LifecycleWelcomeFreeEmail", () => {
  it("renders the welcome body and the add-holding CTA", async () => {
    const html = await render(
      <LifecycleWelcomeFreeEmail
        addHoldingUrl="https://dividendmapper.com/app"
        unsubscribeUrl="https://dividendmapper.com/api/lifecycle/unsubscribe?token=t"
      />,
    );
    expect(html).toContain("Welcome to DividendMapper");
    expect(html).toContain("https://dividendmapper.com/app");
    expect(html).toContain("Glenn at DividendMapper");
    expect(html).toContain("token=t");
    // Voice rules.
    expect(html).not.toMatch(/—/);
    expect(html).not.toMatch(/\bsimply\b/i);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd dividendmapper && npx vitest run emails/__tests__/lifecycle-welcome-free.test.tsx
```

Expected: FAIL — module missing.

- [ ] **Step 3: Write the template**

`dividendmapper/emails/lifecycle-welcome-free.tsx`:

```tsx
import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Subject: "Welcome to DividendMapper"
//
// Day 0 of the free-user lifecycle. Sent on first sign-in (last_sign_in_at
// is non-null) by /api/internal/send-lifecycle-emails. Transactional: footer
// includes a courtesy unsubscribe link but the email itself ignores the
// unsubscribe flag.

interface LifecycleWelcomeFreeProps {
  addHoldingUrl: string;
  unsubscribeUrl: string;
}

export function LifecycleWelcomeFreeEmail({
  addHoldingUrl = "https://dividendmapper.com/app",
  unsubscribeUrl = "https://dividendmapper.com/api/lifecycle/unsubscribe?token=PREVIEW",
}: Partial<LifecycleWelcomeFreeProps> = {}) {
  return (
    <EmailLayout preview="Welcome to DividendMapper. Add a holding to see your first resilience score.">
      <Text style={EMAIL_STYLES.heading}>Welcome to DividendMapper</Text>
      <Text style={EMAIL_STYLES.text}>
        The app does one thing well: it scores your dividend holdings on
        resilience so you know which are quietly safe to compound and which
        want watching.
      </Text>
      <Text style={EMAIL_STYLES.text}>
        The fastest way to see what it does is to add a holding or two:
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={addHoldingUrl} style={EMAIL_STYLES.button}>
          Add a holding
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.text}>
        Free tier covers up to 10 holdings. Pro is for when you want the full
        portfolio view across ISA, SIPP, and GIA, plus Buy, Trim, and Reinvest
        recommendations on each one.
      </Text>
      <Text style={EMAIL_STYLES.text}>
        Standing ask: if anything looks broken or off, reply to this email and
        let me know.
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
      <Text style={{ ...EMAIL_STYLES.textMuted, marginTop: 24 }}>
        Account email about your DividendMapper signup. You can{" "}
        <a href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          unsubscribe from non-essential emails
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

export default LifecycleWelcomeFreeEmail;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd dividendmapper && npx vitest run emails/__tests__/lifecycle-welcome-free.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Run the humaniser linter on the body copy**

Extract the prose-only body into a temp file and run:

```bash
node scripts/lint/humaniser.js dividendmapper/emails/lifecycle-welcome-free.tsx
```

Expected: clean output, no findings. If it flags anything, edit the template, re-run tests, re-run linter.

- [ ] **Step 6: Commit**

```bash
git add dividendmapper/emails/lifecycle-welcome-free.tsx dividendmapper/emails/__tests__/lifecycle-welcome-free.test.tsx
git commit -m "feat(lifecycle): welcome_free email template"
```

---

## Task 7: `activation_nudge` template

**Files:**
- Create: `dividendmapper/emails/lifecycle-activation-nudge.tsx`
- Create: `dividendmapper/emails/__tests__/lifecycle-activation-nudge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { LifecycleActivationNudgeEmail } from "../lifecycle-activation-nudge";

describe("LifecycleActivationNudgeEmail", () => {
  it("renders a single concrete CTA and Glenn sign-off", async () => {
    const html = await render(
      <LifecycleActivationNudgeEmail
        addHoldingUrl="https://dividendmapper.com/app"
        unsubscribeUrl="https://dividendmapper.com/api/lifecycle/unsubscribe?token=t"
      />,
    );
    expect(html).toContain("Add a holding");
    expect(html).toContain("Glenn at DividendMapper");
    expect(html).toContain("https://dividendmapper.com/app");
    // CTA appears once (one button), not three "Add a holding" buttons.
    expect((html.match(/Add a holding/g) ?? []).length).toBeLessThanOrEqual(3);
    expect(html).not.toMatch(/—/);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd dividendmapper && npx vitest run emails/__tests__/lifecycle-activation-nudge.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write the template**

`dividendmapper/emails/lifecycle-activation-nudge.tsx`:

```tsx
import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

interface LifecycleActivationNudgeProps {
  addHoldingUrl: string;
  unsubscribeUrl: string;
}

export function LifecycleActivationNudgeEmail({
  addHoldingUrl = "https://dividendmapper.com/app",
  unsubscribeUrl = "https://dividendmapper.com/api/lifecycle/unsubscribe?token=PREVIEW",
}: Partial<LifecycleActivationNudgeProps> = {}) {
  return (
    <EmailLayout preview="Quick nudge: add a holding to see what the score does.">
      <Text style={EMAIL_STYLES.heading}>Quick nudge</Text>
      <Text style={EMAIL_STYLES.text}>
        The resilience score is the bit that turns DividendMapper from
        interesting to useful, and it only kicks in once you have at least one
        holding in there.
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={addHoldingUrl} style={EMAIL_STYLES.button}>
          Add a holding
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.text}>
        Takes about a minute. If your broker is Trading 212 and you go Pro,
        the sync pulls them all automatically. Adding one by hand on Free
        works fine too.
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
      <Text style={{ ...EMAIL_STYLES.textMuted, marginTop: 24 }}>
        Account email about your DividendMapper signup. You can{" "}
        <a href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          unsubscribe from non-essential emails
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

export default LifecycleActivationNudgeEmail;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd dividendmapper && npx vitest run emails/__tests__/lifecycle-activation-nudge.test.tsx
```

- [ ] **Step 5: Run humaniser linter**

```bash
node scripts/lint/humaniser.js dividendmapper/emails/lifecycle-activation-nudge.tsx
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add dividendmapper/emails/lifecycle-activation-nudge.tsx dividendmapper/emails/__tests__/lifecycle-activation-nudge.test.tsx
git commit -m "feat(lifecycle): activation_nudge email template"
```

---

## Task 8: Build-context helper (loads what each step needs)

**Files:**
- Create: `dividendmapper/lib/email/lifecycle/build-context.ts`
- Create: `dividendmapper/lib/email/lifecycle/__tests__/build-context.test.ts`

This shared helper loads the per-user data the cron passes to skip-gates and templates. Pure orchestration; the SQL it issues is real but isolated here.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { buildLifecycleContext } from "../build-context";

function makeSupabase(state: {
  holdings: { ticker: string }[];
  scoresLowest?: { ticker: string; score: number } | null;
}) {
  return {
    from(table: string) {
      if (table === "holdings") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: state.holdings, error: null }),
          }),
        };
      }
      if (table === "equity_score_history") {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: state.scoresLowest
                      ? [{ ticker: state.scoresLowest.ticker, buy_score: state.scoresLowest.score }]
                      : [],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      throw new Error("unexpected table " + table);
    },
  } as never;
}

describe("buildLifecycleContext", () => {
  it("returns 0 holdings, null lowest score for an empty user", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabase({ holdings: [] }),
      {
        userId: "u1",
        tier: "free",
        lifecycleUnsubscribed: false,
        lastSignInAt: "2026-06-01T10:00:00Z",
        nowMs: new Date("2026-06-13T10:00:00Z").getTime(),
      },
    );
    expect(ctx.holdingsCount).toBe(0);
    expect(ctx.lowestScoringTicker).toBeNull();
  });

  it("returns the count and lowest score when holdings exist", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabase({
        holdings: [{ ticker: "MSFT" }, { ticker: "VOD.L" }],
        scoresLowest: { ticker: "VOD.L", score: 22 },
      }),
      {
        userId: "u1",
        tier: "free",
        lifecycleUnsubscribed: false,
        lastSignInAt: "2026-06-12T10:00:00Z",
        nowMs: new Date("2026-06-13T10:00:00Z").getTime(),
      },
    );
    expect(ctx.holdingsCount).toBe(2);
    expect(ctx.lowestScoringTicker).toEqual({ ticker: "VOD.L", score: 22 });
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/build-context.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement build-context.ts**

`dividendmapper/lib/email/lifecycle/build-context.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SkipContext } from "./skip-gates";

export interface LifecycleUserInput {
  userId: string;
  tier: "free" | "pro" | "premium";
  lifecycleUnsubscribed: boolean;
  lastSignInAt: string | null;
  nowMs: number;
}

export interface LifecycleContext extends SkipContext {
  userId: string;
  lowestScoringTicker: { ticker: string; score: number } | null;
}

export async function buildLifecycleContext(
  supabase: SupabaseClient,
  input: LifecycleUserInput,
): Promise<LifecycleContext> {
  const { data: holdingRows } = await supabase
    .from("holdings")
    .select("ticker")
    .eq("user_id", input.userId);
  const tickers = ((holdingRows ?? []) as { ticker: string }[]).map((r) => r.ticker);
  const uniqueTickers = Array.from(new Set(tickers));

  let lowestScoringTicker: { ticker: string; score: number } | null = null;
  if (uniqueTickers.length > 0) {
    const { data: scoreRows } = await supabase
      .from("equity_score_history")
      .select("ticker, buy_score")
      .in("ticker", uniqueTickers)
      .order("buy_score", { ascending: true })
      .limit(1);
    const row = ((scoreRows ?? []) as { ticker: string; buy_score: number | null }[])[0];
    if (row && row.buy_score !== null) {
      lowestScoringTicker = { ticker: row.ticker, score: row.buy_score };
    }
  }

  const lastSignInAtMs = input.lastSignInAt ? Date.parse(input.lastSignInAt) : null;

  return {
    userId: input.userId,
    holdingsCount: tickers.length,
    tier: input.tier,
    lifecycleUnsubscribed: input.lifecycleUnsubscribed,
    lastSignInAtMs: Number.isNaN(lastSignInAtMs) ? null : lastSignInAtMs,
    nowMs: input.nowMs,
    lowestScoringTicker,
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/build-context.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/lib/email/lifecycle/build-context.ts dividendmapper/lib/email/lifecycle/__tests__/build-context.test.ts
git commit -m "feat(lifecycle): per-user context loader for cron + templates"
```

---

## Task 9: Cron orchestrator (pure, no HTTP)

Walks each free user through SEQUENCE. Time gate + skip-gate + idempotency. Returns a summary, doesn't itself read env vars or the request.

**Files:**
- Create: `dividendmapper/lib/email/lifecycle/run-lifecycle.ts`
- Create: `dividendmapper/lib/email/lifecycle/__tests__/run-lifecycle.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { runLifecycle } from "../run-lifecycle";
import type { LifecycleContext } from "../build-context";

describe("runLifecycle", () => {
  const baseUser = {
    userId: "u1",
    email: "u1@x",
    tier: "free" as const,
    createdAt: "2026-04-01T00:00:00Z", // 73 days before now in tests below
    lastSignInAt: "2026-06-10T00:00:00Z",
    lifecycleUnsubscribed: false,
  };

  it("sends welcome_free on day 0 to a user who signed in", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, emailId: "e1" });
    const ctxFor = vi.fn().mockResolvedValue({
      userId: "u1",
      holdingsCount: 0,
      tier: "free",
      lifecycleUnsubscribed: false,
      lastSignInAtMs: Date.parse("2026-06-13T00:00:00Z"),
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
      lowestScoringTicker: null,
    } satisfies LifecycleContext);

    const result = await runLifecycle({
      users: [
        {
          ...baseUser,
          createdAt: "2026-06-13T00:00:00Z",
          lastSignInAt: "2026-06-13T00:00:00Z",
        },
      ],
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
      buildCtx: ctxFor,
      sendStep: send,
      alreadySent: () => Promise.resolve(false),
    });

    expect(result.attempted).toBe(1);
    expect(result.sent).toBe(1);
    expect(send.mock.calls[0][0].stepKey).toBe("welcome_free");
  });

  it("does not send welcome_free if user never signed in", async () => {
    const send = vi.fn();
    const result = await runLifecycle({
      users: [{ ...baseUser, createdAt: "2026-06-13T00:00:00Z", lastSignInAt: null }],
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
      buildCtx: vi.fn(),
      sendStep: send,
      alreadySent: () => Promise.resolve(false),
    });
    expect(result.attempted).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("skips a step whose gate returns true (activation_nudge with holdings)", async () => {
    const send = vi.fn();
    const result = await runLifecycle({
      users: [{ ...baseUser, createdAt: "2026-06-10T00:00:00Z" }], // 3 days ago
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
      buildCtx: () =>
        Promise.resolve({
          userId: "u1",
          holdingsCount: 5, // has holdings, gate skips activation_nudge
          tier: "free",
          lifecycleUnsubscribed: false,
          lastSignInAtMs: Date.parse("2026-06-13T00:00:00Z"),
          nowMs: Date.parse("2026-06-13T00:00:00Z"),
          lowestScoringTicker: null,
        }),
      sendStep: send,
      alreadySent: (uid, key) => Promise.resolve(key === "welcome_free"), // welcome already sent
    });
    expect(result.skipped).toBeGreaterThan(0);
    expect(send.mock.calls.find((c) => c[0].stepKey === "activation_nudge")).toBeUndefined();
  });

  it("does not re-send a step that's already in sent_emails", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, emailId: "e1" });
    await runLifecycle({
      users: [{ ...baseUser, createdAt: "2026-06-13T00:00:00Z", lastSignInAt: "2026-06-13T00:00:00Z" }],
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
      buildCtx: () =>
        Promise.resolve({
          userId: "u1",
          holdingsCount: 0,
          tier: "free",
          lifecycleUnsubscribed: false,
          lastSignInAtMs: Date.parse("2026-06-13T00:00:00Z"),
          nowMs: Date.parse("2026-06-13T00:00:00Z"),
          lowestScoringTicker: null,
        }),
      sendStep: send,
      alreadySent: (uid, key) => Promise.resolve(key === "welcome_free"),
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("attempts every overdue step in one pass (catch-up after a missed day)", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, emailId: "e1" });
    const created = "2026-04-13T00:00:00Z"; // 61 days before now
    await runLifecycle({
      users: [{ ...baseUser, createdAt: created, lastSignInAt: "2026-04-13T00:00:00Z" }],
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
      buildCtx: () =>
        Promise.resolve({
          userId: "u1",
          holdingsCount: 3,
          tier: "free",
          lifecycleUnsubscribed: false,
          lastSignInAtMs: Date.parse("2026-06-12T00:00:00Z"),
          nowMs: Date.parse("2026-06-13T00:00:00Z"),
          lowestScoringTicker: { ticker: "VOD.L", score: 22 },
        }),
      sendStep: send,
      alreadySent: () => Promise.resolve(false),
    });
    // 5 of 6 should fire: activation_nudge skipped because user has 3 holdings.
    const sentKeys = send.mock.calls.map((c) => c[0].stepKey);
    expect(sentKeys).toContain("welcome_free");
    expect(sentKeys).toContain("score_explainer");
    expect(sentKeys).toContain("pro_pitch_1");
    expect(sentKeys).toContain("monthly_recap");
    expect(sentKeys).toContain("pro_pitch_final");
    expect(sentKeys).not.toContain("activation_nudge");
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/run-lifecycle.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Implement run-lifecycle.ts**

`dividendmapper/lib/email/lifecycle/run-lifecycle.ts`:

```ts
import { SEQUENCE, type LifecycleStepKey } from "./sequence";
import { evalSkipGate } from "./skip-gates";
import type { LifecycleContext } from "./build-context";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LifecycleUser {
  userId: string;
  email: string;
  tier: "free" | "pro" | "premium";
  createdAt: string;
  lastSignInAt: string | null;
  lifecycleUnsubscribed: boolean;
}

export interface SendStepArgs {
  user: LifecycleUser;
  stepKey: LifecycleStepKey;
  context: LifecycleContext;
}

export type SendStepResult =
  | { ok: true; emailId: string | null }
  | { ok: false; reason: string };

export interface RunLifecycleOpts {
  users: LifecycleUser[];
  nowMs: number;
  buildCtx: (user: LifecycleUser) => Promise<LifecycleContext>;
  sendStep: (args: SendStepArgs) => Promise<SendStepResult>;
  alreadySent: (userId: string, sendKey: string) => Promise<boolean>;
}

export interface RunLifecycleResult {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function runLifecycle(opts: RunLifecycleOpts): Promise<RunLifecycleResult> {
  let attempted = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of opts.users) {
    if (!user.lastSignInAt) continue;
    const createdMs = Date.parse(user.createdAt);
    if (Number.isNaN(createdMs)) continue;
    const ageDays = (opts.nowMs - createdMs) / DAY_MS;

    let ctx: LifecycleContext | null = null;
    for (const step of SEQUENCE) {
      if (ageDays < step.daysAfterSignup) continue;
      const sendKey = `lifecycle_${step.key}_${user.userId}`;
      if (await opts.alreadySent(user.userId, sendKey)) continue;

      if (!ctx) ctx = await opts.buildCtx(user);

      if (evalSkipGate(step.key, ctx)) {
        skipped++;
        continue;
      }

      attempted++;
      const result = await opts.sendStep({ user, stepKey: step.key, context: ctx });
      if (result.ok) sent++;
      else failed++;
    }
  }

  return { attempted, sent, skipped, failed };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/run-lifecycle.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/lib/email/lifecycle/run-lifecycle.ts dividendmapper/lib/email/lifecycle/__tests__/run-lifecycle.test.ts
git commit -m "feat(lifecycle): pure cron orchestrator over SEQUENCE"
```

---

## Task 10: Wire welcome_free and activation_nudge into the send dispatcher

This is the function `runLifecycle` calls via `sendStep`. We isolate it so each template's send logic lives in one place. Only the two transactional templates are wired in this task; the marketing four come later.

**Files:**
- Create: `dividendmapper/lib/email/lifecycle/dispatcher.ts`
- Create: `dividendmapper/lib/email/lifecycle/__tests__/dispatcher.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { dispatchLifecycleStep } from "../dispatcher";

const fakeSupabase = {} as never;

vi.mock("@/lib/email/send", () => ({
  sendIdempotent: vi.fn().mockResolvedValue({ ok: true, emailId: "e1" }),
}));

describe("dispatchLifecycleStep", () => {
  it("sends welcome_free with the right send_key and subject", async () => {
    const { sendIdempotent } = await import("@/lib/email/send");
    (sendIdempotent as ReturnType<typeof vi.fn>).mockClear();
    const result = await dispatchLifecycleStep({
      user: {
        userId: "u1",
        email: "u1@x",
        tier: "free",
        createdAt: "2026-06-13T00:00:00Z",
        lastSignInAt: "2026-06-13T00:00:00Z",
        lifecycleUnsubscribed: false,
      },
      stepKey: "welcome_free",
      context: {
        userId: "u1",
        holdingsCount: 0,
        tier: "free",
        lifecycleUnsubscribed: false,
        lastSignInAtMs: Date.now(),
        nowMs: Date.now(),
        lowestScoringTicker: null,
      },
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(true);
    const arg = (sendIdempotent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.template).toBe("welcome_free");
    expect(arg.sendKey).toBe("lifecycle_welcome_free_u1");
    expect(arg.subject).toBe("Welcome to DividendMapper");
    expect(arg.headers["List-Unsubscribe"]).toMatch(/^<https:\/\/dividendmapper.com\/api\/lifecycle\/unsubscribe\?token=[^>]+>$/);
  });

  it("returns ok=false for an unknown step key", async () => {
    const result = await dispatchLifecycleStep({
      user: {
        userId: "u1",
        email: "u1@x",
        tier: "free",
        createdAt: "2026-06-13T00:00:00Z",
        lastSignInAt: "2026-06-13T00:00:00Z",
        lifecycleUnsubscribed: false,
      },
      stepKey: "score_explainer", // not yet wired in this task
      context: {
        userId: "u1",
        holdingsCount: 3,
        tier: "free",
        lifecycleUnsubscribed: false,
        lastSignInAtMs: Date.now(),
        nowMs: Date.now(),
        lowestScoringTicker: { ticker: "VOD.L", score: 22 },
      },
      supabase: fakeSupabase,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/dispatcher.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement dispatcher.ts**

`dividendmapper/lib/email/lifecycle/dispatcher.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendIdempotent } from "@/lib/email/send";
import { signLifecycleUnsubToken } from "./unsub-token";
import { SEQUENCE, type LifecycleStepKey } from "./sequence";
import type { LifecycleContext } from "./build-context";
import type { LifecycleUser, SendStepResult } from "./run-lifecycle";
import { LifecycleWelcomeFreeEmail } from "@/emails/lifecycle-welcome-free";
import { LifecycleActivationNudgeEmail } from "@/emails/lifecycle-activation-nudge";

const STEPS = Object.fromEntries(SEQUENCE.map((s) => [s.key, s])) as Record<
  LifecycleStepKey,
  (typeof SEQUENCE)[number]
>;

export interface DispatchArgs {
  user: LifecycleUser;
  stepKey: LifecycleStepKey;
  context: LifecycleContext;
  supabase: SupabaseClient;
  siteUrl: string;
  cronSecret: string;
}

export async function dispatchLifecycleStep(args: DispatchArgs): Promise<SendStepResult> {
  const step = STEPS[args.stepKey];
  if (!step) return { ok: false, reason: "unknown_step" };

  const unsubToken = signLifecycleUnsubToken(args.user.userId, args.cronSecret);
  const unsubscribeUrl = `${args.siteUrl}/api/lifecycle/unsubscribe?token=${unsubToken}`;
  const addHoldingUrl = `${args.siteUrl}/app`;

  const headers = {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  const common = {
    to: args.user.email,
    subject: step.subject,
    template: step.key,
    sendKey: `lifecycle_${step.key}_${args.user.userId}`,
    userId: args.user.userId,
    supabase: args.supabase,
    headers,
  };

  switch (step.key) {
    case "welcome_free": {
      const result = await sendIdempotent({
        ...common,
        body: LifecycleWelcomeFreeEmail({ addHoldingUrl, unsubscribeUrl }),
      });
      return result.ok
        ? { ok: true, emailId: result.emailId }
        : { ok: false, reason: result.reason };
    }
    case "activation_nudge": {
      const result = await sendIdempotent({
        ...common,
        body: LifecycleActivationNudgeEmail({ addHoldingUrl, unsubscribeUrl }),
      });
      return result.ok
        ? { ok: true, emailId: result.emailId }
        : { ok: false, reason: result.reason };
    }
    // score_explainer, pro_pitch_1, monthly_recap, pro_pitch_final wired in
    // a later task. Return unknown_step until then so the cron logs+skips.
    default:
      return { ok: false, reason: "step_not_yet_wired" };
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/dispatcher.test.ts
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/lib/email/lifecycle/dispatcher.ts dividendmapper/lib/email/lifecycle/__tests__/dispatcher.test.ts
git commit -m "feat(lifecycle): step dispatcher with welcome_free + activation_nudge"
```

---

## Task 11: Unsubscribe route + landing page

**Files:**
- Create: `dividendmapper/app/api/lifecycle/unsubscribe/route.ts`
- Create: `dividendmapper/app/api/lifecycle/unsubscribe/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
});

let updateCalled: { table: string; column?: string; value?: unknown; userId?: string } | null;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: (col: string, val: string) => {
            updateCalled = { table, column: col, value: patch, userId: val };
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  }),
}));

import { GET } from "../route";
import { signLifecycleUnsubToken } from "@/lib/email/lifecycle/unsub-token";

describe("GET /api/lifecycle/unsubscribe", () => {
  beforeEach(() => {
    updateCalled = null;
  });

  it("flips lifecycle_emails_unsubscribed=true for a valid token", async () => {
    const tok = signLifecycleUnsubToken("user-123", "test-secret");
    const res = await GET(new Request(`https://x/api/lifecycle/unsubscribe?token=${tok}`));
    expect(res.status).toBe(200);
    expect(updateCalled).toEqual({
      table: "profiles",
      column: "id",
      value: { lifecycle_emails_unsubscribed: true },
      userId: "user-123",
    });
  });

  it("rejects an invalid token", async () => {
    const res = await GET(new Request("https://x/api/lifecycle/unsubscribe?token=bad"));
    expect(res.status).toBe(400);
    expect(updateCalled).toBeNull();
  });

  it("rejects a missing token", async () => {
    const res = await GET(new Request("https://x/api/lifecycle/unsubscribe"));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd dividendmapper && npx vitest run app/api/lifecycle/unsubscribe/__tests__/route.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the route, mirroring `app/api/notifications/unsubscribe/route.ts`**

`dividendmapper/app/api/lifecycle/unsubscribe/route.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { verifyLifecycleUnsubToken } from "@/lib/email/lifecycle/unsub-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(message: string): Response {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DividendMapper emails</title><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:64px auto;padding:0 24px;color:#111827"><h1 style="font-size:20px;color:#0d9488">DividendMapper</h1><p style="font-size:16px;line-height:24px">${message}</p><p style="font-size:14px;color:#6b7280">You can re-enable lifecycle emails any time from your account settings.</p></body>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !key) return new Response("Server not configured.", { status: 500 });

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return new Response("This unsubscribe link is missing a token.", { status: 400 });

  const userId = verifyLifecycleUnsubToken(token, secret);
  if (!userId) return new Response("This unsubscribe link is invalid or has expired.", { status: 400 });

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await supabase.from("profiles").update({ lifecycle_emails_unsubscribed: true }).eq("id", userId);

  return page("Done. You will no longer receive lifecycle or marketing emails from DividendMapper.");
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd dividendmapper && npx vitest run app/api/lifecycle/unsubscribe/__tests__/route.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/api/lifecycle/unsubscribe
git commit -m "feat(lifecycle): one-click unsubscribe route + page"
```

---

## Task 12: Cron endpoint — pilot mode (transactional steps only)

This wires the orchestrator behind the auth-gated cron HTTP endpoint and ships steps 1 and 2 only. We keep steps 3-6 unwired until their templates land.

**Files:**
- Create: `dividendmapper/app/api/internal/send-lifecycle-emails/route.ts`
- Create: `dividendmapper/app/api/internal/send-lifecycle-emails/__tests__/route.test.ts`
- Modify: `dividendmapper/vercel.json:1-16`

- [ ] **Step 1: Write the failing test (auth + happy-path delegation)**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
  process.env.NEXT_PUBLIC_SITE_URL = "https://dividendmapper.com";
});

const fakeFreeUsers = [
  {
    id: "u1",
    email: "u1@x",
    tier: "free" as const,
    lifecycle_emails_unsubscribed: false,
    created_at: "2026-06-13T00:00:00Z",
    last_sign_in_at: "2026-06-13T00:00:00Z",
  },
];

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              then: (cb: (r: { data: typeof fakeFreeUsers; error: null }) => unknown) =>
                cb({ data: fakeFreeUsers, error: null }),
            }),
          }),
        };
      }
      // sent_emails dedup, holdings, equity_score_history — minimal stubs.
      return {
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
            then: (cb: (r: { data: never[]; error: null }) => unknown) =>
              cb({ data: [], error: null }),
          }),
        }),
      };
    },
  }),
}));

const sendSpy = vi.fn().mockResolvedValue({ ok: true, emailId: "e1" });
vi.mock("@/lib/email/send", () => ({
  sendIdempotent: (...a: unknown[]) => sendSpy(...(a as Parameters<typeof sendSpy>)),
}));

import { GET } from "../route";

describe("GET /api/internal/send-lifecycle-emails", () => {
  it("401s without auth", async () => {
    const res = await GET(new Request("https://x/api/internal/send-lifecycle-emails"));
    expect(res.status).toBe(401);
  });

  it("runs the pipeline when authorised", async () => {
    const res = await GET(
      new Request("https://x/api/internal/send-lifecycle-emails", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.sent).toBe("number");
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd dividendmapper && npx vitest run app/api/internal/send-lifecycle-emails/__tests__/route.test.ts
```

Expected: FAIL (route missing).

- [ ] **Step 3: Implement the route**

`dividendmapper/app/api/internal/send-lifecycle-emails/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { runLifecycle } from "@/lib/email/lifecycle/run-lifecycle";
import { buildLifecycleContext } from "@/lib/email/lifecycle/build-context";
import { dispatchLifecycleStep } from "@/lib/email/lifecycle/dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ProfileRow {
  id: string;
  email: string | null;
  tier: "free" | "pro" | "premium";
  lifecycle_emails_unsubscribed: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dividendmapper.com";
  if (!url || !key) return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });

  const supabase: SupabaseClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Join profiles to auth.users via service role: we need last_sign_in_at.
  // The profiles table already mirrors created_at + email; last_sign_in_at
  // lives on auth.users. Easiest path: an RPC or direct REST. We use REST
  // with the service-role key and read auth.users directly.
  const { data: usersData, error: usersErr } = await supabase
    .from("profiles")
    .select(
      "id, email, tier, lifecycle_emails_unsubscribed, created_at",
    )
    .eq("tier", "free");
  if (usersErr) {
    Sentry.captureException(usersErr);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  // Fetch last_sign_in_at per user. supabase-js exposes admin.listUsers but
  // it pages; for v1 we hit it with a server-side select via the auth schema.
  // The service-role key has access to auth.users; readable via the REST API
  // with the appropriate header. We batch on user ids:
  const ids = ((usersData ?? []) as ProfileRow[]).map((u) => u.id);
  const signInById = new Map<string, string | null>();
  // Page through admin.listUsers (simplest, no SQL):
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) break;
    for (const u of data.users) {
      if (ids.includes(u.id)) signInById.set(u.id, u.last_sign_in_at ?? null);
    }
    if (data.users.length < 200) break;
    page++;
    if (page > 50) break; // safety
  }

  const users = ((usersData ?? []) as ProfileRow[])
    .filter((u) => u.email && u.tier === "free")
    .map((u) => ({
      userId: u.id,
      email: u.email!,
      tier: u.tier,
      createdAt: u.created_at,
      lastSignInAt: signInById.get(u.id) ?? null,
      lifecycleUnsubscribed: u.lifecycle_emails_unsubscribed,
    }));

  const nowMs = Date.now();

  const result = await runLifecycle({
    users,
    nowMs,
    buildCtx: (u) =>
      buildLifecycleContext(supabase, {
        userId: u.userId,
        tier: u.tier,
        lifecycleUnsubscribed: u.lifecycleUnsubscribed,
        lastSignInAt: u.lastSignInAt,
        nowMs,
      }),
    alreadySent: async (userId, sendKey) => {
      const { data } = await supabase
        .from("sent_emails")
        .select("id")
        .eq("send_key", sendKey)
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
    sendStep: (args) =>
      dispatchLifecycleStep({
        user: args.user,
        stepKey: args.stepKey,
        context: args.context,
        supabase,
        siteUrl: site,
        cronSecret: secret,
      }),
  });

  if (result.sent > 100) {
    Sentry.captureMessage(`lifecycle cron sent ${result.sent} emails in one run`, "warning");
  }

  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd dividendmapper && npx vitest run app/api/internal/send-lifecycle-emails/__tests__/route.test.ts
```

Expected: both tests pass.

- [ ] **Step 5: Add the cron to vercel.json**

Edit `dividendmapper/vercel.json` so the `crons` array becomes:

```json
{
  "crons": [
    { "path": "/api/internal/refresh-equity-scores", "schedule": "30 22 * * *" },
    { "path": "/api/internal/send-score-alerts",     "schedule": "0 7 * * *"   },
    { "path": "/api/internal/sync-brokers",          "schedule": "0 5 * * *"   },
    { "path": "/api/internal/send-lifecycle-emails", "schedule": "30 7 * * *"  }
  ]
}
```

- [ ] **Step 6: Run full email + lifecycle suites to confirm no regression**

```bash
cd dividendmapper && npx vitest run lib/email app/api/internal/send-lifecycle-emails app/api/lifecycle
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add dividendmapper/app/api/internal/send-lifecycle-emails dividendmapper/vercel.json
git commit -m "feat(lifecycle): cron endpoint + vercel schedule (welcome+activation only)"
```

---

## Task 13: Deploy + pilot smoke (welcome_free + activation_nudge only)

**Files:**
- None modified. This is a deploy + manual verification gate.

- [ ] **Step 1: Push current branch and verify deploy on Vercel**

```bash
git push origin HEAD
```

Wait for the Vercel deploy to land. Verify via `gh run watch` or the Vercel MCP that the prod deploy succeeded with the new cron registered.

- [ ] **Step 2: Trigger the cron manually with the CRON_SECRET**

```bash
set -a && source dividendmapper/.env.local && set +a && curl -s -H "Authorization: Bearer $CRON_SECRET" "https://dividendmapper.com/api/internal/send-lifecycle-emails" | jq
```

Expected: `{ "ok": true, "attempted": N, "sent": N, "skipped": M, "failed": 0 }` where N matches the number of welcomes you expect to fire today (almost certainly 0 the first run, since all existing free users already passed day 0 without a sent_emails row — but the cron is idempotent, so safe to re-run any time).

- [ ] **Step 3: Send a deliberate live test by signing up a new throwaway free account**

In a private browser:
1. Visit `dividendmapper.com/login`
2. Use a throwaway address you control, e.g. `grodgers1+lifecycle@gmail.com`
3. Complete the magic link
4. Wait until the next cron tick (or trigger it manually with curl)
5. Confirm `welcome_free` lands in the inbox, renders cleanly in Gmail
6. Confirm `sent_emails` has the row:

```bash
set -a && source dividendmapper/.env.local && set +a && npx supabase db query --linked "SELECT template, send_key, sent_at FROM public.sent_emails WHERE template IN ('welcome_free','activation_nudge') ORDER BY sent_at DESC LIMIT 5;"
```

- [ ] **Step 4: Verify the unsubscribe link works**

Click the unsubscribe link in the welcome email. Confirm:
1. Landing page reads "Done. You will no longer receive lifecycle or marketing emails."
2. Database row flips:

```bash
set -a && source dividendmapper/.env.local && set +a && npx supabase db query --linked "SELECT email, lifecycle_emails_unsubscribed FROM public.profiles WHERE email='grodgers1+lifecycle@gmail.com';"
```

Expected: `lifecycle_emails_unsubscribed = true`.

- [ ] **Step 5: Clean up the throwaway**

Delete the throwaway user via the Supabase dashboard or `auth.admin.deleteUser` once smoke verified. The cascading `ON DELETE SET NULL` on `sent_emails.user_id` leaves the audit rows but anonymises them — matches the welcome_paid throwaway pattern.

---

## Task 14: `score_explainer` template (with lowest-scoring ticker)

**Files:**
- Create: `dividendmapper/emails/lifecycle-score-explainer.tsx`
- Create: `dividendmapper/emails/__tests__/lifecycle-score-explainer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { LifecycleScoreExplainerEmail } from "../lifecycle-score-explainer";

describe("LifecycleScoreExplainerEmail", () => {
  it("anchors body to the user's lowest-scoring ticker", async () => {
    const html = await render(
      <LifecycleScoreExplainerEmail
        lowestTicker="VOD.L"
        lowestScore={22}
        holdingUrl="https://dividendmapper.com/app/holdings/VOD.L"
        unsubscribeUrl="https://dividendmapper.com/api/lifecycle/unsubscribe?token=t"
      />,
    );
    expect(html).toContain("VOD.L");
    expect(html).toContain("22");
    expect(html).toContain("/app/holdings/VOD.L");
    expect(html).toContain("Glenn at DividendMapper");
    expect(html).not.toMatch(/—/);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd dividendmapper && npx vitest run emails/__tests__/lifecycle-score-explainer.test.tsx
```

- [ ] **Step 3: Write the template**

`dividendmapper/emails/lifecycle-score-explainer.tsx`:

```tsx
import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

interface LifecycleScoreExplainerProps {
  lowestTicker: string;
  lowestScore: number;
  holdingUrl: string;
  unsubscribeUrl: string;
}

export function LifecycleScoreExplainerEmail({
  lowestTicker = "VOD.L",
  lowestScore = 22,
  holdingUrl = "https://dividendmapper.com/app",
  unsubscribeUrl = "https://dividendmapper.com/api/lifecycle/unsubscribe?token=PREVIEW",
}: Partial<LifecycleScoreExplainerProps> = {}) {
  return (
    <EmailLayout preview="What your resilience score actually tells you, anchored to your portfolio.">
      <Text style={EMAIL_STYLES.heading}>What the score is telling you</Text>
      <Text style={EMAIL_STYLES.text}>
        Your portfolio&apos;s lowest-scoring holding right now is{" "}
        <strong>{lowestTicker}</strong> at <strong>{lowestScore}/100</strong>.
      </Text>
      <Text style={EMAIL_STYLES.text}>
        The resilience score blends three things: dividend cover, payout-vs-cashflow,
        and balance-sheet headroom. A score under 50 means at least one of
        those is stretched. It does not mean &quot;sell&quot;. It means
        &quot;this is the one to read on next earnings&quot;.
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={holdingUrl} style={EMAIL_STYLES.button}>
          See the full breakdown
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
      <Text style={{ ...EMAIL_STYLES.textMuted, marginTop: 24 }}>
        You&apos;re getting this as part of the DividendMapper lifecycle emails.{" "}
        <a href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          Unsubscribe
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

export default LifecycleScoreExplainerEmail;
```

- [ ] **Step 4: Run tests + humaniser linter**

```bash
cd dividendmapper && npx vitest run emails/__tests__/lifecycle-score-explainer.test.tsx
node scripts/lint/humaniser.js dividendmapper/emails/lifecycle-score-explainer.tsx
```

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/emails/lifecycle-score-explainer.tsx dividendmapper/emails/__tests__/lifecycle-score-explainer.test.tsx
git commit -m "feat(lifecycle): score_explainer email template"
```

---

## Task 15: `pro_pitch_1` template (per-ticker Buy/Hold/Trim lines)

**Files:**
- Create: `dividendmapper/emails/lifecycle-pro-pitch-1.tsx`
- Create: `dividendmapper/emails/__tests__/lifecycle-pro-pitch-1.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { LifecycleProPitch1Email } from "../lifecycle-pro-pitch-1";

describe("LifecycleProPitch1Email", () => {
  it("renders per-ticker action lines and the pricing CTA", async () => {
    const html = await render(
      <LifecycleProPitch1Email
        lines={[
          { ticker: "AAPL",  action: "BUY",  score: 78 },
          { ticker: "VOD.L", action: "TRIM", score: 22 },
        ]}
        pricingUrl="https://dividendmapper.com/pricing"
        unsubscribeUrl="https://x/u?token=t"
      />,
    );
    expect(html).toContain("AAPL");
    expect(html).toContain("BUY");
    expect(html).toContain("VOD.L");
    expect(html).toContain("TRIM");
    expect(html).toContain("/pricing");
    expect(html).toContain("Glenn at DividendMapper");
    expect(html).not.toMatch(/—/);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd dividendmapper && npx vitest run emails/__tests__/lifecycle-pro-pitch-1.test.tsx
```

- [ ] **Step 3: Write the template**

`dividendmapper/emails/lifecycle-pro-pitch-1.tsx`:

```tsx
import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

export type ProPitchAction = "BUY" | "HOLD" | "TRIM";

interface ProPitchLine {
  ticker: string;
  action: ProPitchAction;
  score: number;
}

interface LifecycleProPitch1Props {
  lines: ProPitchLine[];
  pricingUrl: string;
  unsubscribeUrl: string;
}

export function LifecycleProPitch1Email({
  lines = [],
  pricingUrl = "https://dividendmapper.com/pricing",
  unsubscribeUrl = "https://dividendmapper.com/api/lifecycle/unsubscribe?token=PREVIEW",
}: Partial<LifecycleProPitch1Props> = {}) {
  return (
    <EmailLayout preview="Here's what Pro would say about your portfolio today.">
      <Text style={EMAIL_STYLES.heading}>What Pro would say today</Text>
      <Text style={EMAIL_STYLES.text}>
        Across your holdings, Pro would flag:
      </Text>
      <ul style={{ margin: "0 0 16px 0", paddingLeft: 20, fontSize: 16, lineHeight: "24px", color: "#111827" }}>
        {lines.map((line) => (
          <li key={line.ticker} style={{ marginBottom: 8 }}>
            <strong>{line.ticker}</strong>: {line.action} (score {line.score})
          </li>
        ))}
      </ul>
      <Text style={EMAIL_STYLES.text}>
        Plus a Reinvest Recommender that picks which of your holdings would
        best absorb next month&apos;s contribution based on Quality, price,
        and concentration.
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={pricingUrl} style={EMAIL_STYLES.button}>
          See Pro pricing
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.text}>
        Free continues to cover the basics for as long as you want.
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
      <Text style={{ ...EMAIL_STYLES.textMuted, marginTop: 24 }}>
        Lifecycle email from DividendMapper.{" "}
        <a href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          Unsubscribe
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

export default LifecycleProPitch1Email;
```

- [ ] **Step 4: Run tests + humaniser**

```bash
cd dividendmapper && npx vitest run emails/__tests__/lifecycle-pro-pitch-1.test.tsx
node scripts/lint/humaniser.js dividendmapper/emails/lifecycle-pro-pitch-1.tsx
```

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/emails/lifecycle-pro-pitch-1.tsx dividendmapper/emails/__tests__/lifecycle-pro-pitch-1.test.tsx
git commit -m "feat(lifecycle): pro_pitch_1 email template"
```

---

## Task 16: `monthly_recap` template

**Files:**
- Create: `dividendmapper/emails/lifecycle-monthly-recap.tsx`
- Create: `dividendmapper/emails/__tests__/lifecycle-monthly-recap.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { LifecycleMonthlyRecapEmail } from "../lifecycle-monthly-recap";

describe("LifecycleMonthlyRecapEmail", () => {
  it("renders score moves and ex-div lines", async () => {
    const html = await render(
      <LifecycleMonthlyRecapEmail
        scoreMoves={[{ ticker: "AAPL", from: 70, to: 78 }]}
        exDivs={[{ ticker: "VOD.L", exDate: "2026-07-04", payment: "10.5p" }]}
        portfolioUrl="https://dividendmapper.com/app"
        unsubscribeUrl="https://x/u?token=t"
      />,
    );
    expect(html).toContain("AAPL");
    expect(html).toContain("78");
    expect(html).toContain("VOD.L");
    expect(html).toContain("2026-07-04");
    expect(html).toContain("Glenn at DividendMapper");
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd dividendmapper && npx vitest run emails/__tests__/lifecycle-monthly-recap.test.tsx
```

- [ ] **Step 3: Write the template**

`dividendmapper/emails/lifecycle-monthly-recap.tsx`:

```tsx
import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

interface ScoreMove {
  ticker: string;
  from: number;
  to: number;
}
interface ExDiv {
  ticker: string;
  exDate: string;
  payment: string;
}

interface LifecycleMonthlyRecapProps {
  scoreMoves: ScoreMove[];
  exDivs: ExDiv[];
  portfolioUrl: string;
  unsubscribeUrl: string;
}

export function LifecycleMonthlyRecapEmail({
  scoreMoves = [],
  exDivs = [],
  portfolioUrl = "https://dividendmapper.com/app",
  unsubscribeUrl = "https://dividendmapper.com/api/lifecycle/unsubscribe?token=PREVIEW",
}: Partial<LifecycleMonthlyRecapProps> = {}) {
  return (
    <EmailLayout preview="Your DividendMapper recap: score moves and dividends coming up.">
      <Text style={EMAIL_STYLES.heading}>Your DividendMapper recap</Text>
      <Text style={EMAIL_STYLES.text}>This month in your holdings:</Text>
      {scoreMoves.length > 0 && (
        <ul style={{ margin: "0 0 16px 0", paddingLeft: 20, fontSize: 16, lineHeight: "24px", color: "#111827" }}>
          {scoreMoves.map((m) => (
            <li key={m.ticker} style={{ marginBottom: 8 }}>
              <strong>{m.ticker}</strong>: resilience score moved from {m.from} to {m.to}
            </li>
          ))}
        </ul>
      )}
      {exDivs.length > 0 && (
        <ul style={{ margin: "0 0 16px 0", paddingLeft: 20, fontSize: 16, lineHeight: "24px", color: "#111827" }}>
          {exDivs.map((d) => (
            <li key={d.ticker} style={{ marginBottom: 8 }}>
              <strong>{d.ticker}</strong>: ex-div {d.exDate}, payment {d.payment}
            </li>
          ))}
        </ul>
      )}
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={portfolioUrl} style={EMAIL_STYLES.button}>
          Open your portfolio
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
      <Text style={{ ...EMAIL_STYLES.textMuted, marginTop: 24 }}>
        Monthly recap from DividendMapper.{" "}
        <a href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          Unsubscribe
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

export default LifecycleMonthlyRecapEmail;
```

- [ ] **Step 4: Run tests + humaniser**

```bash
cd dividendmapper && npx vitest run emails/__tests__/lifecycle-monthly-recap.test.tsx
node scripts/lint/humaniser.js dividendmapper/emails/lifecycle-monthly-recap.tsx
```

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/emails/lifecycle-monthly-recap.tsx dividendmapper/emails/__tests__/lifecycle-monthly-recap.test.tsx
git commit -m "feat(lifecycle): monthly_recap email template"
```

---

## Task 17: Stripe coupon + per-recipient code generation

The day-60 email needs a single-use, 7-day-expiry, 50% off first-month code per recipient.

**Files:**
- Create: `dividendmapper/lib/email/lifecycle/pro-code.ts`
- Create: `dividendmapper/lib/email/lifecycle/__tests__/pro-code.test.ts`

**Manual prereq (one-time, not a code task):**

In the Stripe dashboard or via CLI, create:
- **Coupon id:** `lifecycle_day60_50off_first_month`
- **Percent off:** 50
- **Duration:** `once` (applies only to the first invoice)
- **Name (internal):** Lifecycle day-60 50% off first month
- Confirm the coupon id is stored in `dividendmapper/.env.local` as `STRIPE_COUPON_LIFECYCLE_DAY60` and added to Vercel env via `vercel env add` (mirror the existing `STRIPE_PRICE_PRO_*` pattern).

- [ ] **Step 1: Write the failing test (with Stripe mocked)**

```ts
import { describe, it, expect, vi } from "vitest";

const createSpy = vi.fn().mockResolvedValue({ id: "promo_123", code: "DM60-AB12CD" });
vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      promotionCodes: { create: createSpy },
    })),
  };
});

import { generateLifecycleProCode } from "../pro-code";

describe("generateLifecycleProCode", () => {
  it("creates a one-time, 7-day-expiry promotion code with the lifecycle coupon", async () => {
    createSpy.mockClear();
    const result = await generateLifecycleProCode({
      stripeKey: "sk_test_x",
      couponId: "lifecycle_day60_50off_first_month",
      nowMs: Date.parse("2026-06-13T00:00:00Z"),
    });
    expect(result.code).toMatch(/^DM60-/);
    expect(result.promoCodeId).toBe("promo_123");
    const arg = createSpy.mock.calls[0][0];
    expect(arg.coupon).toBe("lifecycle_day60_50off_first_month");
    expect(arg.max_redemptions).toBe(1);
    expect(arg.expires_at).toBe(
      Math.floor(
        (Date.parse("2026-06-13T00:00:00Z") + 7 * 24 * 60 * 60 * 1000) / 1000,
      ),
    );
    expect(arg.code).toMatch(/^DM60-[A-Z0-9]{6}$/);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/pro-code.test.ts
```

- [ ] **Step 3: Implement pro-code.ts**

`dividendmapper/lib/email/lifecycle/pro-code.ts`:

```ts
import Stripe from "stripe";
import { randomBytes } from "crypto";

// Generate a single-use, 7-day-expiry 50% off promotion code for the day-60
// lifecycle email. Code format: DM60-XXXXXX (uppercase alphanumeric).

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit I/O/0/1 for legibility

function randomSuffix(): string {
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export interface GenerateProCodeOpts {
  stripeKey: string;
  couponId: string;
  nowMs: number;
}

export interface GeneratedProCode {
  promoCodeId: string;
  code: string;
}

export async function generateLifecycleProCode(opts: GenerateProCodeOpts): Promise<GeneratedProCode> {
  const stripe = new Stripe(opts.stripeKey);
  const code = `DM60-${randomSuffix()}`;
  const expiresAt = Math.floor((opts.nowMs + 7 * 24 * 60 * 60 * 1000) / 1000);
  const created = await stripe.promotionCodes.create({
    coupon: opts.couponId,
    code,
    max_redemptions: 1,
    expires_at: expiresAt,
  });
  return { promoCodeId: created.id, code: created.code ?? code };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/pro-code.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/lib/email/lifecycle/pro-code.ts dividendmapper/lib/email/lifecycle/__tests__/pro-code.test.ts
git commit -m "feat(lifecycle): per-recipient Stripe 50% off code generator"
```

---

## Task 18: `pro_pitch_final` template (with code slot)

**Files:**
- Create: `dividendmapper/emails/lifecycle-pro-pitch-final.tsx`
- Create: `dividendmapper/emails/__tests__/lifecycle-pro-pitch-final.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { LifecycleProPitchFinalEmail } from "../lifecycle-pro-pitch-final";

describe("LifecycleProPitchFinalEmail", () => {
  it("renders the code, the expiry, and the pricing CTA", async () => {
    const html = await render(
      <LifecycleProPitchFinalEmail
        code="DM60-AB12CD"
        expiresOnLabel="20 August 2026"
        pricingUrl="https://dividendmapper.com/pricing"
        unsubscribeUrl="https://x/u?token=t"
      />,
    );
    expect(html).toContain("DM60-AB12CD");
    expect(html).toContain("20 August 2026");
    expect(html).toContain("/pricing");
    expect(html).toContain("Glenn at DividendMapper");
    expect(html).not.toMatch(/—/);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd dividendmapper && npx vitest run emails/__tests__/lifecycle-pro-pitch-final.test.tsx
```

- [ ] **Step 3: Write the template**

`dividendmapper/emails/lifecycle-pro-pitch-final.tsx`:

```tsx
import { Button, Text } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

interface LifecycleProPitchFinalProps {
  code: string;
  expiresOnLabel: string;
  pricingUrl: string;
  unsubscribeUrl: string;
}

export function LifecycleProPitchFinalEmail({
  code = "DM60-PREVIEW",
  expiresOnLabel = "20 August 2026",
  pricingUrl = "https://dividendmapper.com/pricing",
  unsubscribeUrl = "https://dividendmapper.com/api/lifecycle/unsubscribe?token=PREVIEW",
}: Partial<LifecycleProPitchFinalProps> = {}) {
  return (
    <EmailLayout preview="50% off your first month of Pro. Valid for 7 days.">
      <Text style={EMAIL_STYLES.heading}>50% off your first month</Text>
      <Text style={EMAIL_STYLES.text}>
        Last automated nudge from me. Promise.
      </Text>
      <Text style={EMAIL_STYLES.text}>
        If you have been meaning to give Pro a go, here is a one-time 50% off
        your first month code. Valid until {expiresOnLabel}:
      </Text>
      <Text style={{ margin: "0 0 16px 0" }}>
        <span style={EMAIL_STYLES.code}>{code}</span>
      </Text>
      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0" }}>
        <Button href={pricingUrl} style={EMAIL_STYLES.button}>
          Use code at checkout
        </Button>
      </Text>
      <Text style={EMAIL_STYLES.text}>
        If Pro is not right for you, no hard feelings. Free continues to cover
        the basics for as long as you want, and the monthly recap keeps you in
        the loop.
      </Text>
      <Text style={EMAIL_STYLES.signature}>Glenn at DividendMapper</Text>
      <Text style={{ ...EMAIL_STYLES.textMuted, marginTop: 24 }}>
        Final lifecycle email from DividendMapper.{" "}
        <a href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          Unsubscribe
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

export default LifecycleProPitchFinalEmail;
```

- [ ] **Step 4: Run tests + humaniser**

```bash
cd dividendmapper && npx vitest run emails/__tests__/lifecycle-pro-pitch-final.test.tsx
node scripts/lint/humaniser.js dividendmapper/emails/lifecycle-pro-pitch-final.tsx
```

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/emails/lifecycle-pro-pitch-final.tsx dividendmapper/emails/__tests__/lifecycle-pro-pitch-final.test.tsx
git commit -m "feat(lifecycle): pro_pitch_final email template"
```

---

## Task 19: Extend dispatcher to handle the 4 remaining steps

**Files:**
- Modify: `dividendmapper/lib/email/lifecycle/dispatcher.ts`
- Modify: `dividendmapper/lib/email/lifecycle/__tests__/dispatcher.test.ts`
- Modify: `dividendmapper/lib/email/lifecycle/build-context.ts` (extend `LifecycleContext` if needed for recap + pitch1 data)

The four new steps need data that build-context doesn't yet provide:
- `pro_pitch_1` needs an array of `{ ticker, action, score }` per holding
- `monthly_recap` needs score moves over the past 30 days and upcoming ex-divs

To keep the dispatcher thin, we extend `buildLifecycleContext` to include these computed bundles, fetched only when relevant.

- [ ] **Step 1: Extend `LifecycleContext` with new fields**

In `dividendmapper/lib/email/lifecycle/build-context.ts`:

```ts
export interface LifecycleContext extends SkipContext {
  userId: string;
  lowestScoringTicker: { ticker: string; score: number } | null;
  // For pro_pitch_1:
  proPitchLines: Array<{ ticker: string; action: "BUY" | "HOLD" | "TRIM"; score: number }>;
  // For monthly_recap:
  recentScoreMoves: Array<{ ticker: string; from: number; to: number }>;
  upcomingExDivs: Array<{ ticker: string; exDate: string; payment: string }>;
}
```

Then extend `buildLifecycleContext` to populate them. For the action mapping:

```ts
function actionFromScore(score: number): "BUY" | "HOLD" | "TRIM" {
  if (score >= 70) return "BUY";
  if (score <= 30) return "TRIM";
  return "HOLD";
}
```

Pull `(ticker, buy_score)` for the most recent score row per held ticker → `proPitchLines`.
Pull `(ticker, observed_at, buy_score)` for the two most recent rows per held ticker, compute `from`/`to` → `recentScoreMoves`. Filter to moves with `|to - from| >= 5` to avoid noise.
Pull `(ticker, ex_div_date, payment)` for held tickers from `equity_scores` (the `ex_div` extension in migration 0005) with `ex_div_date > now()` and `< now() + 30 days` → `upcomingExDivs`.

Add the following tests to `dividendmapper/lib/email/lifecycle/__tests__/build-context.test.ts`. The `makeSupabase` helper from Task 8 needs to be extended to stub `equity_score_history` orderings and `equity_scores` ex-div rows — paste this richer helper in alongside the existing one:

```ts
function makeSupabaseExtended(state: {
  holdings: { ticker: string }[];
  latestScores?: Array<{ ticker: string; buy_score: number; observed_at: string }>;
  historyByTicker?: Record<string, Array<{ observed_at: string; buy_score: number }>>;
  exDivs?: Array<{ ticker: string; ex_div_date: string; payment: string }>;
}) {
  return {
    from(table: string) {
      if (table === "holdings") {
        return { select: () => ({ eq: () => Promise.resolve({ data: state.holdings, error: null }) }) };
      }
      if (table === "equity_score_history") {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: state.latestScores ?? [], error: null }),
              }),
            }),
          }),
          // overload for the two-most-recent pull
          rpc: () => Promise.resolve({ data: state.historyByTicker ?? {}, error: null }),
        };
      }
      if (table === "equity_scores") {
        return {
          select: () => ({
            in: () => ({
              gt: () => ({
                lt: () => Promise.resolve({ data: state.exDivs ?? [], error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error("unexpected table " + table);
    },
  } as never;
}

describe("buildLifecycleContext extended fields", () => {
  const baseInput = {
    userId: "u1",
    tier: "free" as const,
    lifecycleUnsubscribed: false,
    lastSignInAt: "2026-06-12T10:00:00Z",
    nowMs: new Date("2026-06-13T10:00:00Z").getTime(),
  };

  it("maps latest score to a Buy/Hold/Trim line", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabaseExtended({
        holdings: [{ ticker: "AAPL" }, { ticker: "VOD.L" }],
        latestScores: [
          { ticker: "AAPL",  buy_score: 78, observed_at: "2026-06-13T07:00:00Z" },
          { ticker: "VOD.L", buy_score: 22, observed_at: "2026-06-13T07:00:00Z" },
        ],
      }),
      baseInput,
    );
    expect(ctx.proPitchLines).toEqual(
      expect.arrayContaining([
        { ticker: "AAPL",  action: "BUY",  score: 78 },
        { ticker: "VOD.L", action: "TRIM", score: 22 },
      ]),
    );
  });

  it("returns no pro_pitch_lines when there are no holdings", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabaseExtended({ holdings: [] }),
      baseInput,
    );
    expect(ctx.proPitchLines).toEqual([]);
  });

  it("excludes score moves smaller than 5 points", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabaseExtended({
        holdings: [{ ticker: "AAPL" }, { ticker: "VOD.L" }],
        historyByTicker: {
          AAPL:  [{ observed_at: "2026-06-13", buy_score: 78 }, { observed_at: "2026-05-13", buy_score: 70 }],
          "VOD.L": [{ observed_at: "2026-06-13", buy_score: 22 }, { observed_at: "2026-05-13", buy_score: 21 }],
        },
      }),
      baseInput,
    );
    expect(ctx.recentScoreMoves.find((m) => m.ticker === "AAPL")).toBeDefined();
    expect(ctx.recentScoreMoves.find((m) => m.ticker === "VOD.L")).toBeUndefined();
  });

  it("returns upcoming ex-div lines in the next 30 days", async () => {
    const ctx = await buildLifecycleContext(
      makeSupabaseExtended({
        holdings: [{ ticker: "VOD.L" }],
        exDivs: [{ ticker: "VOD.L", ex_div_date: "2026-07-04", payment: "10.5p" }],
      }),
      baseInput,
    );
    expect(ctx.upcomingExDivs).toEqual([
      { ticker: "VOD.L", exDate: "2026-07-04", payment: "10.5p" },
    ]);
  });
});
```

These tests fail until you extend the production code. Implement the new fields one at a time, re-running the matching test until it passes (TDD discipline).

- [ ] **Step 2: Run the existing build-context tests to confirm they still pass + new tests pass**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/build-context.test.ts
```

- [ ] **Step 3: Extend the dispatcher to handle the 4 new steps**

In `dividendmapper/lib/email/lifecycle/dispatcher.ts`, replace the `default` case in the `switch` with concrete cases. For each new step, the body component receives the relevant context fields. Pseudocode for each case (write out the full case block exactly):

```ts
case "score_explainer": {
  if (!args.context.lowestScoringTicker) return { ok: false, reason: "no_data_yet" };
  const { ticker, score } = args.context.lowestScoringTicker;
  const result = await sendIdempotent({
    ...common,
    body: LifecycleScoreExplainerEmail({
      lowestTicker: ticker,
      lowestScore: score,
      holdingUrl: `${args.siteUrl}/app/holdings/${encodeURIComponent(ticker)}`,
      unsubscribeUrl,
    }),
  });
  return result.ok ? { ok: true, emailId: result.emailId } : { ok: false, reason: result.reason };
}
case "pro_pitch_1": {
  if (args.context.proPitchLines.length < 2) return { ok: false, reason: "insufficient_data" };
  const result = await sendIdempotent({
    ...common,
    body: LifecycleProPitch1Email({
      lines: args.context.proPitchLines.slice(0, 5),
      pricingUrl: `${args.siteUrl}/pricing`,
      unsubscribeUrl,
    }),
  });
  return result.ok ? { ok: true, emailId: result.emailId } : { ok: false, reason: result.reason };
}
case "monthly_recap": {
  if (args.context.recentScoreMoves.length === 0 && args.context.upcomingExDivs.length === 0) {
    return { ok: false, reason: "no_recap_content" };
  }
  const result = await sendIdempotent({
    ...common,
    body: LifecycleMonthlyRecapEmail({
      scoreMoves: args.context.recentScoreMoves,
      exDivs: args.context.upcomingExDivs,
      portfolioUrl: `${args.siteUrl}/app`,
      unsubscribeUrl,
    }),
  });
  return result.ok ? { ok: true, emailId: result.emailId } : { ok: false, reason: result.reason };
}
case "pro_pitch_final": {
  const couponId = process.env.STRIPE_COUPON_LIFECYCLE_DAY60;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!couponId || !stripeKey) return { ok: false, reason: "stripe_not_configured" };
  const { generateLifecycleProCode } = await import("./pro-code");
  const generated = await generateLifecycleProCode({
    stripeKey,
    couponId,
    nowMs: args.context.nowMs,
  });
  const expiresOn = new Date(args.context.nowMs + 7 * 24 * 60 * 60 * 1000);
  const expiresOnLabel = expiresOn.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  const result = await sendIdempotent({
    ...common,
    body: LifecycleProPitchFinalEmail({
      code: generated.code,
      expiresOnLabel,
      pricingUrl: `${args.siteUrl}/pricing`,
      unsubscribeUrl,
    }),
  });
  return result.ok ? { ok: true, emailId: result.emailId } : { ok: false, reason: result.reason };
}
```

Append the following test block to `dividendmapper/lib/email/lifecycle/__tests__/dispatcher.test.ts` to cover the new branches:

```ts
describe("dispatchLifecycleStep (steps 3-6)", () => {
  const baseUser = {
    userId: "u1",
    email: "u1@x",
    tier: "free" as const,
    createdAt: "2026-04-13T00:00:00Z",
    lastSignInAt: "2026-06-12T00:00:00Z",
    lifecycleUnsubscribed: false,
  };
  const baseCtx = {
    userId: "u1",
    holdingsCount: 3,
    tier: "free" as const,
    lifecycleUnsubscribed: false,
    lastSignInAtMs: Date.parse("2026-06-12T00:00:00Z"),
    nowMs: Date.parse("2026-06-13T00:00:00Z"),
    lowestScoringTicker: { ticker: "VOD.L", score: 22 },
    proPitchLines: [
      { ticker: "AAPL",  action: "BUY"  as const, score: 78 },
      { ticker: "VOD.L", action: "TRIM" as const, score: 22 },
    ],
    recentScoreMoves: [{ ticker: "AAPL", from: 70, to: 78 }],
    upcomingExDivs:   [{ ticker: "VOD.L", exDate: "2026-07-04", payment: "10.5p" }],
  };

  it("score_explainer short-circuits when lowestScoringTicker is null", async () => {
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "score_explainer",
      context: { ...baseCtx, lowestScoringTicker: null },
      supabase: {} as never,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("no_data_yet");
  });

  it("pro_pitch_1 short-circuits when fewer than 2 pitch lines", async () => {
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "pro_pitch_1",
      context: { ...baseCtx, proPitchLines: [baseCtx.proPitchLines[0]] },
      supabase: {} as never,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("insufficient_data");
  });

  it("monthly_recap short-circuits when both arrays are empty", async () => {
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "monthly_recap",
      context: { ...baseCtx, recentScoreMoves: [], upcomingExDivs: [] },
      supabase: {} as never,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("no_recap_content");
  });

  it("pro_pitch_final short-circuits when STRIPE_COUPON_LIFECYCLE_DAY60 unset", async () => {
    delete process.env.STRIPE_COUPON_LIFECYCLE_DAY60;
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "pro_pitch_final",
      context: baseCtx,
      supabase: {} as never,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("stripe_not_configured");
  });

  it("pro_pitch_1 happy path passes the lines through to the template", async () => {
    const { sendIdempotent } = await import("@/lib/email/send");
    (sendIdempotent as ReturnType<typeof vi.fn>).mockClear();
    const result = await dispatchLifecycleStep({
      user: baseUser,
      stepKey: "pro_pitch_1",
      context: baseCtx,
      supabase: {} as never,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(result.ok).toBe(true);
    const arg = (sendIdempotent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.template).toBe("pro_pitch_1");
    expect(arg.sendKey).toBe("lifecycle_pro_pitch_1_u1");
  });
});
```

(For the `pro_pitch_final` happy path, mock `./pro-code` so `generateLifecycleProCode` returns a deterministic `{ promoCodeId: "promo_123", code: "DM60-AB12CD" }` and assert the sendIdempotent call's `template` and `sendKey`. The pattern matches the `pro_pitch_1` test above.)

- [ ] **Step 4: Run dispatcher tests**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle/__tests__/dispatcher.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run the full lifecycle suite to catch regressions**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle
```

- [ ] **Step 6: Commit**

```bash
git add dividendmapper/lib/email/lifecycle dividendmapper/emails
git commit -m "feat(lifecycle): wire remaining 4 templates into dispatcher"
```

---

## Task 20: PostHog server-side instrumentation

**Files:**
- Modify: `dividendmapper/lib/email/lifecycle/run-lifecycle.ts` and/or `dispatcher.ts`
- Reuse: existing `lib/posthog/server.ts` (or whatever the existing server-side capture helper is — look up `captureServerEvent` references)

- [ ] **Step 1: Find the existing helper**

```bash
grep -rn "captureServerEvent" dividendmapper/lib dividendmapper/app | head
```

Locate the function and its expected signature.

- [ ] **Step 2: Add `lifecycle_email_sent` and `lifecycle_email_skipped` in the dispatcher**

In `dividendmapper/lib/email/lifecycle/dispatcher.ts`, at the very top of `dispatchLifecycleStep`, import `captureServerEvent` from the helper module discovered in Step 1. After each successful `sendIdempotent` call, before the `return { ok: true, ... }`, emit:

```ts
await captureServerEvent(args.user.userId, "lifecycle_email_sent", {
  template: step.key,
  days_after_signup: step.daysAfterSignup,
});
```

In `dividendmapper/lib/email/lifecycle/run-lifecycle.ts`, where the skip-gate triggers `skipped++`, add a callback hook so the orchestrator can emit `lifecycle_email_skipped`. Extend `RunLifecycleOpts`:

```ts
export interface RunLifecycleOpts {
  // ... existing fields ...
  onSkipped?: (userId: string, stepKey: LifecycleStepKey, reason: "gate") => void | Promise<void>;
}
```

And call `await opts.onSkipped?.(user.userId, step.key, "gate")` immediately before `skipped++`. Then in the cron route (Task 12), wire `onSkipped: (uid, key, reason) => captureServerEvent(uid, "lifecycle_email_skipped", { template: key, reason })`.

- [ ] **Step 3: Add `lifecycle_email_unsubscribed` in the unsubscribe route**

In `dividendmapper/app/api/lifecycle/unsubscribe/route.ts`, after the successful `update().eq()` call, before the `return page(...)`, add:

```ts
await captureServerEvent(userId, "lifecycle_email_unsubscribed", { source: "one_click" });
```

- [ ] **Step 4: Add `lifecycle_pro_code_redeemed` in the Stripe webhook**

In `dividendmapper/app/api/webhooks/stripe/route.ts`, find the existing `customer.subscription.created` handler (the same place that fires `welcome_paid`). After the subscription is persisted to the profile, add:

```ts
const couponId = subscription.discount?.coupon?.id ?? null;
if (couponId === process.env.STRIPE_COUPON_LIFECYCLE_DAY60) {
  await captureServerEvent(userId, "lifecycle_pro_code_redeemed", {
    code: subscription.discount?.promotion_code ?? null,
    coupon_id: couponId,
  });
}
```

- [ ] **Step 5: Write tests for each emission point**

`dividendmapper/lib/email/lifecycle/__tests__/posthog.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const captureSpy = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/posthog/server", () => ({
  captureServerEvent: (...a: unknown[]) => captureSpy(...a),
}));

const sendOk = vi.fn().mockResolvedValue({ ok: true, emailId: "e1" });
vi.mock("@/lib/email/send", () => ({
  sendIdempotent: (...a: unknown[]) => sendOk(...a),
}));

import { dispatchLifecycleStep } from "../dispatcher";

describe("lifecycle PostHog instrumentation", () => {
  it("emits lifecycle_email_sent after a successful welcome", async () => {
    captureSpy.mockClear();
    await dispatchLifecycleStep({
      user: {
        userId: "u1", email: "u1@x", tier: "free",
        createdAt: "2026-06-13T00:00:00Z",
        lastSignInAt: "2026-06-13T00:00:00Z",
        lifecycleUnsubscribed: false,
      },
      stepKey: "welcome_free",
      context: {
        userId: "u1", holdingsCount: 0, tier: "free", lifecycleUnsubscribed: false,
        lastSignInAtMs: Date.now(), nowMs: Date.now(), lowestScoringTicker: null,
        proPitchLines: [], recentScoreMoves: [], upcomingExDivs: [],
      },
      supabase: {} as never,
      siteUrl: "https://dividendmapper.com",
      cronSecret: "test-secret",
    });
    expect(captureSpy).toHaveBeenCalledWith(
      "u1",
      "lifecycle_email_sent",
      expect.objectContaining({ template: "welcome_free", days_after_signup: 0 }),
    );
  });
});
```

And in the unsubscribe route test (extending the file from Task 11):

```ts
it("emits lifecycle_email_unsubscribed after a successful flip", async () => {
  const tok = signLifecycleUnsubToken("user-123", "test-secret");
  await GET(new Request(`https://x/api/lifecycle/unsubscribe?token=${tok}`));
  expect(captureSpy).toHaveBeenCalledWith(
    "user-123",
    "lifecycle_email_unsubscribed",
    { source: "one_click" },
  );
});
```

For the Stripe webhook, append to `dividendmapper/app/api/webhooks/stripe/__tests__/route.test.ts` a test fixture where `event.data.object.discount.coupon.id === "lifecycle_day60_50off_first_month"` and assert `captureServerEvent` is called with `"lifecycle_pro_code_redeemed"`.

- [ ] **Step 3: Run all affected tests**

```bash
cd dividendmapper && npx vitest run lib/email/lifecycle app/api/lifecycle app/api/webhooks/stripe
```

- [ ] **Step 4: Commit**

```bash
git add dividendmapper
git commit -m "feat(lifecycle): PostHog instrumentation for sent/skipped/unsubscribed/redeemed"
```

---

## Task 21: Full deploy + end-to-end smoke (all 6 steps)

**Files:**
- None modified. Deploy gate + manual verification.

- [ ] **Step 1: Push and watch deploy**

```bash
git push origin HEAD
```

Verify Vercel deploy succeeds. Confirm the new env vars (`STRIPE_COUPON_LIFECYCLE_DAY60`) are present on production.

- [ ] **Step 2: Trigger the cron manually**

```bash
set -a && source dividendmapper/.env.local && set +a && curl -s -H "Authorization: Bearer $CRON_SECRET" "https://dividendmapper.com/api/internal/send-lifecycle-emails" | jq
```

- [ ] **Step 3: Inspect sent_emails for the current cohort**

```bash
set -a && source dividendmapper/.env.local && set +a && npx supabase db query --linked "SELECT template, COUNT(*) FROM public.sent_emails WHERE template LIKE 'lifecycle_%' GROUP BY template ORDER BY template;"
```

Expected: at least `welcome_free` rows (from earlier pilot) plus whatever new sends fired. For existing free users who already passed day 60, the cron should attempt `pro_pitch_final` on its next overdue-step pass — confirm that's working.

- [ ] **Step 4: Inspect Resend to confirm delivery**

```bash
set -a && source dividendmapper/.env.local && set +a && curl -s "https://api.resend.com/emails?limit=10" -H "Authorization: Bearer $RESEND_API_KEY" | jq '.data[] | {to, subject, last_event, created_at}'
```

Spot-check the most recent lifecycle subjects against the sent_emails table.

- [ ] **Step 5: Verify a generated day-60 code redeems**

Open `https://dividendmapper.com/pricing` in a private window, log into a throwaway free account that has just received a `pro_pitch_final`, paste the code at checkout, complete payment (test card or real card you'll refund). Confirm:
1. Stripe applies 50% off the first invoice only
2. The throwaway account flips to Pro
3. `lifecycle_pro_code_redeemed` fires in PostHog

Refund and delete the throwaway after.

- [ ] **Step 6: Monitor for 7 days**

Add a Sentry alert: if `lifecycle_email_sent` events drop to 0 for > 36 hours, alert. After 7 clean days, the program is live for everyone.

---

## Out-of-scope (deferred, listed for follow-up plans)

- In-app activation banner on `/app` for zero-holding free users
- In-app passive Pro nudge on score chips for activated free users
- Behaviour-triggered emails (cap-reached, score-crossings for free)
- Localisation, A/B testing of subject lines
- Re-engagement campaign for users who unsubscribed

