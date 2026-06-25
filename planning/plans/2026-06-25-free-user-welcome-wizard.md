# Free-User Welcome Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILLS in order: `superpowers:executing-plans` (this plan), `superpowers:subagent-driven-development` (recommended for per-day execution), `superpowers:test-driven-development` (per-task where logic-shaped). Steps use checkbox (`- [ ]`) syntax for tracking. Read `dividendmapper/AGENTS.md` and `node_modules/next/dist/docs/` BEFORE writing any Next.js-specific code per `[feedback_dividendmapper_nextjs_warning]`.

**Goal:** Ship a 5-step modal welcome wizard for new free signups that fires on first `/app/*` visit, takes them through locale awareness, adding a first holding, and a non-salesy Pro taster, then never reappears.

**Architecture:** Single client island mounted from `app/app/layout.tsx`, gated on a server-side check. State machine lives entirely in React. Persistence is a dedicated `welcome_wizard_dismissals` table with one row per user (existence = do not show). Pro tier never sees it. Existing users are backfill-dismissed in the migration. Locale already lives in `localStorage` via the existing `useLocale()` hook; step 2 points at a (new) `<LocaleToggle />` we drop into the drawer-shell topbar.

**Tech Stack:** Next.js 16.2.4 (App Router, RSC), React 19.2.4, Tailwind v4, Supabase Postgres + Auth, Base UI Dialog (`@base-ui/react/dialog`: already used by `AddHoldingModal`), Vitest + RTL, PostHog (existing `captureClientEvent` + `captureServerEvent` helpers).

**Spec:** [planning/specs/2026-06-25-free-user-welcome-wizard-design.md](../specs/2026-06-25-free-user-welcome-wizard-design.md)

**Branch:** `feature/welcome-wizard` off `main`.

**Timeline:** 5 working days plus 1 buffer day.

---

## Pre-flight (Day 0.5)

### 1. Agentic worker: worktree setup

```bash
cd /c/Users/grodg/dividend_mapper_plan
git fetch origin
git checkout main && git pull origin main
git worktree add dividendmapper/.worktrees/welcome-wizard -b feature/welcome-wizard origin/main
cd dividendmapper/.worktrees/welcome-wizard/dividendmapper
cmd //C "rmdir node_modules" 2>/dev/null
cmd //C "mklink /J node_modules C:\\Users\\grodg\\dividend_mapper_plan\\dividendmapper\\node_modules" 2>&1
cmd //C "mklink .env.local C:\\Users\\grodg\\dividend_mapper_plan\\dividendmapper\\.env.local" 2>&1
npx vitest run --no-file-parallelism lib/portfolio/ 2>&1 | tail -5
```

If `node_modules` was nuked by a parallel agent per `[feedback_concurrent_worktree_branch_race]`, run `npm install --no-audit --no-fund --prefer-offline` from inside the worktree before the baseline.

### 2. Confirm migration number

```bash
ls dividendmapper/supabase/migrations/ | tail -5
```

Last migration on `main` at plan-writing time was `0020_saved_screens.sql`. This plan uses `0021_welcome_wizard_dismissals.sql`. If the Calendar v2 migration (`0021_equity_scores_projection.sql`) has merged first, **bump this plan's migration to `0022`** and update every `0021` reference in Days 1, 5 and 6.

### 3. Glenn: needed for Day 1 only

Day 1 needs migration `0021_welcome_wizard_dismissals.sql` applied to prod. Glenn runs it. The plan writes the file and stages the migration but does not execute prod ops.

---

## File map (lock decomposition here)

### New files

- `lib/onboarding/load-welcome-state.ts` _(~50 lines)_: pure server helper returning `{ shouldShow, existingHoldingsCount }`.
- `lib/onboarding/__tests__/load-welcome-state.test.ts` _(~5 tests)_.
- `app/api/onboarding/welcome/route.ts` _(~80 lines)_: POST handler that writes the dismissal row + fires the server-side telemetry event.
- `app/api/onboarding/welcome/__tests__/route.test.ts` _(~4 tests)_.
- `app/app/_components/welcome-wizard/welcome-wizard.tsx` _(~180 lines)_: modal frame (Base UI Dialog), step state machine, progress dots, footer Back/primary buttons, focus management, animations, aria-live announcer.
- `app/app/_components/welcome-wizard/step-1-welcome.tsx`.
- `app/app/_components/welcome-wizard/step-2-locale.tsx`.
- `app/app/_components/welcome-wizard/step-3-add-holding.tsx`.
- `app/app/_components/welcome-wizard/step-4-tour.tsx`.
- `app/app/_components/welcome-wizard/step-5-pro-taster.tsx`.
- `app/app/_components/welcome-wizard/__tests__/welcome-wizard.test.tsx` _(~3 tests, modal frame)_.
- `app/app/_components/welcome-wizard/__tests__/step-1-welcome.test.tsx` _(~2 tests)_.
- `app/app/_components/welcome-wizard/__tests__/step-2-locale.test.tsx` _(~2 tests)_.
- `app/app/_components/welcome-wizard/__tests__/step-3-add-holding.test.tsx` _(~5 tests)_.
- `app/app/_components/welcome-wizard/__tests__/step-4-tour.test.tsx` _(~2 tests)_.
- `app/app/_components/welcome-wizard/__tests__/step-5-pro-taster.test.tsx` _(~3 tests)_.
- `app/app/_components/welcome-wizard/__tests__/layout-integration.test.tsx` _(~2 tests)_.
- `supabase/migrations/0021_welcome_wizard_dismissals.sql`.

### Modified files

- `app/app/layout.tsx`: extends to call `loadWelcomeWizardState(...)` and render `<WelcomeWizard />` conditionally.
- `app/app/_components/shell/drawer-shell.tsx`: passes `<LocaleToggle />` into `TopBar`'s `actionsSlot`.

### Reused, untouched

- `lib/locale/context.tsx`, `components/locale-toggle.tsx`: locale state. Step 2 reads via `useLocale()`.
- `app/app/portfolio/_components/add-holding-modal.tsx`: reference for step 3 form fields. We mirror its field set inside the wizard rather than reusing the modal directly (modal-on-modal is awkward).
- `app/api/portfolio/holdings/route.ts`: step 3 POSTs to this existing endpoint with the same payload shape.
- `components/ui/ticker-search.tsx`: reused inside step 3's inline form.
- `lib/analytics/posthog-capture.ts`: client-side `captureClientEvent`.
- `lib/auth/server.ts`: `getCurrentUser`/`requireUser`.
- `lib/email/lifecycle/skip-gates.ts`: the Day 3 `activation_nudge` email is correctly skipped once the wizard adds a holding (no plan task; just verifying the spec's claim).

---

## Day 1: Migration, state loader, LocaleToggle in /app/* topbar

**Outcome.** Migration applied to prod. Pure state loader passes ~5 tests. Drawer shell shows the locale toggle.

### Task 1.1: Migration 0021_welcome_wizard_dismissals.sql

**Files:**
- Create: `dividendmapper/supabase/migrations/0021_welcome_wizard_dismissals.sql`

- [ ] **Step 1.1.1: Write the migration**

```sql
-- 0021_welcome_wizard_dismissals.sql
-- One row per user means "do not show the welcome wizard". Existence = done.
-- Writes happen only from the server action with the service role.

create table public.welcome_wizard_dismissals (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  recorded_at  timestamptz not null default now(),
  reason       text not null check (reason in ('completed','dismissed','backfilled'))
);

alter table public.welcome_wizard_dismissals enable row level security;

create policy "welcome_wizard_dismissals_select_own"
  on public.welcome_wizard_dismissals for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies. The server action writes via the
-- service role so we control the reason value end-to-end.

-- Backfill every existing auth.users row so the wizard appears only for
-- genuinely new signups after this migration applies.
insert into public.welcome_wizard_dismissals (user_id, reason)
select id, 'backfilled' from auth.users
on conflict (user_id) do nothing;

comment on table public.welcome_wizard_dismissals is
  'Records that the welcome wizard has been completed or explicitly dismissed for a user. Existence = do not show. Absence = show on next /app/* visit.';
comment on column public.welcome_wizard_dismissals.reason is
  'completed = user reached step 5 finish or pricing. dismissed = user chose Skip the tour or Don''t show this again. backfilled = predates the wizard.';
```

- [ ] **Step 1.1.2: Hand off to Glenn for prod apply**

Glenn runs (per `[reference_supabase_cli_workflow]`):

```bash
set -a && source .env.local && set +a
npx supabase db push --dry-run
npx supabase db push --yes
```

If the dry run reports out-of-order migrations because a parallel branch landed a `0021` first, follow `[reference_supabase_out_of_order_migration_workaround]` and rename this file to `0022_welcome_wizard_dismissals.sql`.

- [ ] **Step 1.1.3: Confirm backfill count**

After apply, Glenn confirms the row count matches `auth.users`:

```bash
psql "$DATABASE_URL" -c "select (select count(*) from auth.users) as users, (select count(*) from public.welcome_wizard_dismissals) as dismissals;"
```

Expected: equal counts.

- [ ] **Step 1.1.4: Commit**

```bash
git add supabase/migrations/0021_welcome_wizard_dismissals.sql
git commit -m "feat(welcome-wizard): migration 0021 dismissals table + backfill"
```

### Task 1.2: `loadWelcomeWizardState` pure helper

**Files:**
- Create: `dividendmapper/lib/onboarding/load-welcome-state.ts`
- Test: `dividendmapper/lib/onboarding/__tests__/load-welcome-state.test.ts`

- [ ] **Step 1.2.1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { loadWelcomeWizardState } from "../load-welcome-state";

type Row = Record<string, unknown>;

function makeStub(rows: { dismissals?: Row[]; holdings?: Row[] }) {
  const fromMock = vi.fn((table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({
        data: (rows.dismissals ?? [])[0] ?? null,
        error: null,
      }),
      then: undefined as never,
    } as unknown as {
      select: () => typeof builder;
      eq: () => typeof builder;
      maybeSingle: () => Promise<{ data: Row | null; error: unknown }>;
    };
    if (table === "holdings") {
      // .select('id', { count: 'exact', head: true }).eq('user_id', x)
      return {
        select: () => ({
          eq: async () => ({
            count: (rows.holdings ?? []).length,
            error: null,
          }),
        }),
      } as unknown as typeof builder;
    }
    return builder;
  });
  return { from: fromMock } as unknown as Parameters<typeof loadWelcomeWizardState>[0];
}

describe("loadWelcomeWizardState", () => {
  it("returns shouldShow: false for any non-free tier", async () => {
    for (const tier of ["pro", "premium"] as const) {
      const sb = makeStub({});
      const result = await loadWelcomeWizardState(sb, "u1", tier);
      expect(result.shouldShow).toBe(false);
    }
  });

  it("returns shouldShow: false when a dismissals row exists for the user", async () => {
    const sb = makeStub({
      dismissals: [{ user_id: "u1", reason: "backfilled" }],
    });
    const result = await loadWelcomeWizardState(sb, "u1", "free");
    expect(result.shouldShow).toBe(false);
  });

  it("returns shouldShow: true when free + no dismissals row", async () => {
    const sb = makeStub({ dismissals: [], holdings: [] });
    const result = await loadWelcomeWizardState(sb, "u1", "free");
    expect(result.shouldShow).toBe(true);
    expect(result.existingHoldingsCount).toBe(0);
  });

  it("returns the holdings count when free + no dismissals row", async () => {
    const sb = makeStub({
      dismissals: [],
      holdings: [{ id: "h1" }, { id: "h2" }],
    });
    const result = await loadWelcomeWizardState(sb, "u1", "free");
    expect(result.existingHoldingsCount).toBe(2);
  });

  it("returns shouldShow: false defensively when the dismissals read errors", async () => {
    const fromMock = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: { message: "db down" } }),
        }),
      }),
    }));
    const sb = { from: fromMock } as unknown as Parameters<typeof loadWelcomeWizardState>[0];
    const result = await loadWelcomeWizardState(sb, "u1", "free");
    expect(result.shouldShow).toBe(false);
  });
});
```

- [ ] **Step 1.2.2: Run to verify failure**

```bash
npx vitest run --no-file-parallelism lib/onboarding/__tests__/load-welcome-state.test.ts
```

Expected: FAIL with `Cannot find module '../load-welcome-state'`.

- [ ] **Step 1.2.3: Implement loadWelcomeWizardState**

Create `dividendmapper/lib/onboarding/load-welcome-state.ts`:

```ts
// Pure-ish server helper for the welcome wizard's render gate.
// Reads dismissals + holdings count in parallel.

import type { SupabaseClient } from "@supabase/supabase-js";

export type Tier = "free" | "pro" | "premium";

export interface WelcomeWizardState {
  shouldShow: boolean;
  existingHoldingsCount: number;
}

export async function loadWelcomeWizardState(
  supabase: Pick<SupabaseClient, "from">,
  userId: string,
  tier: Tier,
): Promise<WelcomeWizardState> {
  if (tier !== "free") return { shouldShow: false, existingHoldingsCount: 0 };

  const [dismissalsRes, holdingsRes] = await Promise.all([
    supabase
      .from("welcome_wizard_dismissals")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("holdings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  if (dismissalsRes.error) {
    // Defensive: a read failure suppresses the wizard. The next /app/* visit
    // will retry; meanwhile the user sees the normal app.
    return { shouldShow: false, existingHoldingsCount: 0 };
  }
  if (dismissalsRes.data) {
    return { shouldShow: false, existingHoldingsCount: 0 };
  }

  const existingHoldingsCount = holdingsRes.count ?? 0;
  return { shouldShow: true, existingHoldingsCount };
}
```

- [ ] **Step 1.2.4: Run tests to verify they pass**

```bash
npx vitest run --no-file-parallelism lib/onboarding/__tests__/load-welcome-state.test.ts
```

Expected: all 5 PASS.

- [ ] **Step 1.2.5: Commit**

```bash
git add lib/onboarding/load-welcome-state.ts lib/onboarding/__tests__/load-welcome-state.test.ts
git commit -m "feat(welcome-wizard): loadWelcomeWizardState pure helper"
```

### Task 1.3: LocaleToggle in the /app/* topbar

**Files:**
- Modify: `dividendmapper/app/app/_components/shell/drawer-shell.tsx`

- [ ] **Step 1.3.1: Add the LocaleToggle to actionsSlot**

Edit `dividendmapper/app/app/_components/shell/drawer-shell.tsx`. Add the import and pass `<LocaleToggle />` into the existing `<TopBar actionsSlot={...}>` prop:

```tsx
import { DrawerCollapsedProvider } from "./drawer-collapsed-context";
import { Drawer } from "./drawer";
import { MobileDrawer } from "./mobile-drawer";
import { TopBar } from "./top-bar";
import { LocaleToggle } from "@/components/locale-toggle";
import type { TierLike } from "./nav-items";

export function DrawerShell({
  email,
  tier,
  isAdmin,
  children,
}: {
  email: string;
  tier: TierLike;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <DrawerCollapsedProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[var(--canvas)] text-[var(--text)]">
        <Drawer email={email} tier={tier} isAdmin={isAdmin} />
        <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            leftAdornment={
              <MobileDrawer email={email} tier={tier} isAdmin={isAdmin} />
            }
            actionsSlot={<LocaleToggle />}
          />
          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </DrawerCollapsedProvider>
  );
}
```

- [ ] **Step 1.3.2: Manual check in dev**

```bash
npm run dev
```

Visit `http://localhost:3000/app/portfolio` while signed in. Verify the 🇬🇧 / 🇺🇸 toggle appears in the top-right of the topbar. Verify clicking it switches locale (wrapper dropdowns elsewhere change to 401(k) / IRA when US is selected).

- [ ] **Step 1.3.3: Commit**

```bash
git add app/app/_components/shell/drawer-shell.tsx
git commit -m "feat(shell): expose LocaleToggle in /app/* topbar"
```

---

## Day 2: Server action + WelcomeWizard modal frame

**Outcome.** POST endpoint writes dismissal rows idempotently. Modal frame renders with progress dots, Back/primary buttons, focus trap, animations. ~7 new tests.

### Task 2.1: POST `/api/onboarding/welcome` server action

**Files:**
- Create: `dividendmapper/app/api/onboarding/welcome/route.ts`
- Test: `dividendmapper/app/api/onboarding/welcome/__tests__/route.test.ts`

- [ ] **Step 2.1.1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

const getClaimsMock = vi.fn();
const upsertMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: getClaimsMock },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      upsert: (row: unknown, opts: unknown) => {
        upsertMock(row, opts);
        return Promise.resolve({ data: null, error: null });
      },
    }),
  }),
}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "stub";
});

describe("POST /api/onboarding/welcome", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getClaimsMock.mockResolvedValue({ data: null, error: { message: "nope" } });
    const res = await POST(
      new Request("http://test/api/onboarding/welcome", {
        method: "POST",
        body: JSON.stringify({ reason: "completed" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unknown reason values with 400", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "u1" } }, error: null });
    const res = await POST(
      new Request("http://test/api/onboarding/welcome", {
        method: "POST",
        body: JSON.stringify({ reason: "lol" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("upserts the dismissals row with the supplied reason", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "u1" } }, error: null });
    const res = await POST(
      new Request("http://test/api/onboarding/welcome", {
        method: "POST",
        body: JSON.stringify({ reason: "completed" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", reason: "completed" }),
      expect.objectContaining({ onConflict: "user_id" }),
    );
  });

  it("is idempotent (second call resolves the same upsert without error)", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "u1" } }, error: null });
    const req = () =>
      new Request("http://test/api/onboarding/welcome", {
        method: "POST",
        body: JSON.stringify({ reason: "dismissed" }),
      });
    const r1 = await POST(req());
    const r2 = await POST(req());
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2.1.2: Run to verify failure**

Expected: FAIL with module-not-found.

- [ ] **Step 2.1.3: Implement the route**

Create `dividendmapper/app/api/onboarding/welcome/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/analytics/posthog-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_REASONS = ["completed", "dismissed"] as const;
type Reason = (typeof VALID_REASONS)[number];

function isReason(x: unknown): x is Reason {
  return typeof x === "string" && (VALID_REASONS as readonly string[]).includes(x);
}

export async function POST(req: Request): Promise<Response> {
  const userClient = await createSupabaseServerClient();
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims();
  if (claimsErr || !claimsData?.claims) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = claimsData.claims.sub as string;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const reason = (body as { reason?: unknown }).reason;
  if (!isReason(reason)) {
    return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: upsertErr } = await service
    .from("welcome_wizard_dismissals")
    .upsert(
      { user_id: userId, reason, recorded_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (upsertErr) {
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }

  await captureServerEvent(
    userId,
    reason === "completed"
      ? "welcome_wizard_completed"
      : "welcome_wizard_dismissed_permanent",
    {},
  );

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2.1.4: Run tests**: all 4 PASS.

- [ ] **Step 2.1.5: Commit**

```bash
git add app/api/onboarding/welcome/route.ts app/api/onboarding/welcome/__tests__/route.test.ts
git commit -m "feat(welcome-wizard): POST /api/onboarding/welcome dismissal endpoint"
```

### Task 2.2: `WelcomeWizard` modal frame

**Files:**
- Create: `dividendmapper/app/app/_components/welcome-wizard/welcome-wizard.tsx`
- Test: `dividendmapper/app/app/_components/welcome-wizard/__tests__/welcome-wizard.test.tsx`

- [ ] **Step 2.2.1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WelcomeWizard } from "../welcome-wizard";

const captureClientEventMock = vi.fn();
vi.mock("@/lib/analytics/posthog-capture", () => ({
  captureClientEvent: (n: string, p?: Record<string, unknown>) => captureClientEventMock(n, p),
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }) as unknown as typeof fetch;
});

describe("WelcomeWizard modal frame", () => {
  it("renders step 1 by default and fires welcome_wizard_shown on mount", () => {
    render(<WelcomeWizard initialHoldingsCount={0} />);
    expect(screen.getByRole("dialog", { name: /welcome to dividendmapper/i })).toBeInTheDocument();
    expect(captureClientEventMock).toHaveBeenCalledWith(
      "welcome_wizard_shown",
      expect.objectContaining({ first_step: 1 }),
    );
  });

  it("ESC fires dismissed_session and does NOT call the dismissal endpoint", () => {
    render(<WelcomeWizard initialHoldingsCount={0} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(captureClientEventMock).toHaveBeenCalledWith(
      "welcome_wizard_dismissed_session",
      expect.objectContaining({ from_step: 1 }),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("X button does the same as ESC", () => {
    render(<WelcomeWizard initialHoldingsCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: /close welcome tour/i }));
    expect(captureClientEventMock).toHaveBeenCalledWith(
      "welcome_wizard_dismissed_session",
      expect.objectContaining({ from_step: 1 }),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2.2.2: Run to verify failure**: module-not-found.

- [ ] **Step 2.2.3: Implement the modal frame**

Create `dividendmapper/app/app/_components/welcome-wizard/welcome-wizard.tsx`:

```tsx
"use client";

// Modal frame + step state machine for the free-user welcome wizard.
// Mounts unconditionally if rendered. The /app/* layout decides whether to
// render at all via loadWelcomeWizardState.

import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useState, useCallback } from "react";
import { captureClientEvent } from "@/lib/analytics/posthog-capture";
import { Step1Welcome } from "./step-1-welcome";
import { Step2Locale } from "./step-2-locale";
import { Step3AddHolding } from "./step-3-add-holding";
import { Step4Tour } from "./step-4-tour";
import { Step5ProTaster } from "./step-5-pro-taster";

export type StepNumber = 1 | 2 | 3 | 4 | 5;

export interface WelcomeWizardProps {
  initialHoldingsCount: number;
}

async function postDismissal(reason: "completed" | "dismissed"): Promise<void> {
  try {
    await fetch("/api/onboarding/welcome", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  } catch {
    // Optimistic: ignore failures. The next /app/* visit retries.
  }
}

export function WelcomeWizard({ initialHoldingsCount }: WelcomeWizardProps) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<StepNumber>(1);

  useEffect(() => {
    captureClientEvent("welcome_wizard_shown", { first_step: 1 });
  }, []);

  // ESC handler. Base UI's Dialog can also do this, but we want to fire the
  // telemetry event explicitly and avoid the dismissal POST.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        captureClientEvent("welcome_wizard_dismissed_session", { from_step: step });
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, step]);

  const advance = useCallback(
    (to: StepNumber) => {
      captureClientEvent("welcome_wizard_step_advanced", { from_step: step, to_step: to });
      setStep(to);
    },
    [step],
  );

  const goBack = useCallback(() => {
    if (step === 1) return;
    const prev = (step - 1) as StepNumber;
    captureClientEvent("welcome_wizard_step_back", { from_step: step, to_step: prev });
    setStep(prev);
  }, [step]);

  const dismissPermanent = useCallback(
    (fromStep: StepNumber) => {
      captureClientEvent("welcome_wizard_dismissed_permanent", { from_step: fromStep });
      void postDismissal("dismissed");
      setOpen(false);
    },
    [],
  );

  const complete = useCallback(() => {
    captureClientEvent("welcome_wizard_completed", { path_through_steps: [1, 2, 3, 4, 5] });
    void postDismissal("completed");
    setOpen(false);
  }, []);

  const closeSession = useCallback(() => {
    captureClientEvent("welcome_wizard_dismissed_session", { from_step: step });
    setOpen(false);
  }, [step]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm motion-reduce:backdrop-blur-none" />
        <Dialog.Popup
          aria-labelledby={`welcome-wizard-step-${step}-headline`}
          className="fixed left-1/2 top-1/2 z-50 w-[min(480px,100vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200 sm:max-h-[90vh] max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-lg max-sm:rounded-b-none max-sm:h-[90vh]"
        >
          {/* Top row: progress dots + close button */}
          <div className="flex items-center justify-between">
            <ol role="list" className="flex gap-2" aria-label="Progress">
              {[1, 2, 3, 4, 5].map((n) => (
                <li
                  key={n}
                  aria-current={n === step ? "step" : undefined}
                  className={`h-1.5 w-6 rounded-full ${
                    n === step ? "bg-[var(--brand)]" : "bg-[var(--border-subtle)]"
                  }`}
                />
              ))}
            </ol>
            <button
              type="button"
              aria-label="Close welcome tour"
              onClick={closeSession}
              className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none"
            >
              ✕
            </button>
          </div>

          {/* Step body */}
          <div className="mt-4 min-h-[280px]">
            {step === 1 && (
              <Step1Welcome onAdvance={() => advance(2)} onSkipTour={() => dismissPermanent(1)} />
            )}
            {step === 2 && (
              <Step2Locale onAdvance={() => advance(3)} onBack={goBack} />
            )}
            {step === 3 && (
              <Step3AddHolding
                existingHoldingsCount={initialHoldingsCount}
                onAdvance={() => advance(4)}
                onBack={goBack}
              />
            )}
            {step === 4 && (
              <Step4Tour onAdvance={() => advance(5)} onBack={goBack} />
            )}
            {step === 5 && (
              <Step5ProTaster
                onFinish={complete}
                onDismissPermanent={() => dismissPermanent(5)}
                onBack={goBack}
              />
            )}
          </div>

          {/* aria-live region for step transitions */}
          <p className="sr-only" aria-live="polite">
            Step {step} of 5
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Note: Base UI Dialog handles focus trap + initial-focus management automatically. The component imports each step as a stub for now; Days 3-4 fill them in.

- [ ] **Step 2.2.4: Add stub step components so the imports resolve**

Create each of the five step files with a minimal stub. Days 3-4 replace them with real implementations.

`dividendmapper/app/app/_components/welcome-wizard/step-1-welcome.tsx`:

```tsx
"use client";
export function Step1Welcome({ onAdvance, onSkipTour }: { onAdvance: () => void; onSkipTour: () => void }) {
  return (
    <div>
      <h2 id="welcome-wizard-step-1-headline">Welcome to DividendMapper.</h2>
      <button onClick={onAdvance}>Let&apos;s go</button>
      <button onClick={onSkipTour}>Skip the tour</button>
    </div>
  );
}
```

Same minimal stub pattern for `step-2-locale.tsx`, `step-3-add-holding.tsx`, `step-4-tour.tsx`, `step-5-pro-taster.tsx` (each with matching headline id and the props the frame expects).

For step 3 the stub signature is:

```tsx
"use client";
export function Step3AddHolding({
  existingHoldingsCount,
  onAdvance,
  onBack,
}: {
  existingHoldingsCount: number;
  onAdvance: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h2 id="welcome-wizard-step-3-headline">Add a holding.</h2>
      <button onClick={onAdvance}>Add holding</button>
      <button onClick={onBack}>Back</button>
    </div>
  );
}
```

For step 5:

```tsx
"use client";
export function Step5ProTaster({
  onFinish,
  onDismissPermanent,
  onBack,
}: {
  onFinish: () => void;
  onDismissPermanent: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h2 id="welcome-wizard-step-5-headline">Here&apos;s what Pro adds.</h2>
      <button onClick={onFinish}>Finish</button>
      <button onClick={onDismissPermanent}>Don&apos;t show this again</button>
      <button onClick={onBack}>Back</button>
    </div>
  );
}
```

For steps 2 and 4 use:

```tsx
"use client";
export function Step2Locale({ onAdvance, onBack }: { onAdvance: () => void; onBack: () => void }) {
  return (
    <div>
      <h2 id="welcome-wizard-step-2-headline">Heads up.</h2>
      <button onClick={onAdvance}>Got it</button>
      <button onClick={onBack}>Back</button>
    </div>
  );
}

// step-4-tour.tsx
"use client";
export function Step4Tour({ onAdvance, onBack }: { onAdvance: () => void; onBack: () => void }) {
  return (
    <div>
      <h2 id="welcome-wizard-step-4-headline">A few things worth knowing.</h2>
      <button onClick={onAdvance}>Continue</button>
      <button onClick={onBack}>Back</button>
    </div>
  );
}
```

- [ ] **Step 2.2.5: Run the welcome-wizard frame tests**: all 3 PASS.

- [ ] **Step 2.2.6: Commit**

```bash
git add app/app/_components/welcome-wizard/
git commit -m "feat(welcome-wizard): modal frame + step state machine + stubs"
```

---

## Day 3: Steps 1, 2, 5

**Outcome.** The three text-heavy steps render with locked copy and locked behaviour. ~7 new tests.

### Task 3.1: Step 1: Welcome

**Files:**
- Modify: `dividendmapper/app/app/_components/welcome-wizard/step-1-welcome.tsx`
- Test: `dividendmapper/app/app/_components/welcome-wizard/__tests__/step-1-welcome.test.tsx`

- [ ] **Step 3.1.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Step1Welcome } from "../step-1-welcome";

describe("Step1Welcome", () => {
  it("renders the locked headline and body", () => {
    render(<Step1Welcome onAdvance={() => {}} onSkipTour={() => {}} />);
    expect(screen.getByText(/welcome to dividendmapper\./i)).toBeInTheDocument();
    expect(screen.getByText(/first quality score/i)).toBeInTheDocument();
    expect(screen.getByText(/takes about a minute/i)).toBeInTheDocument();
  });

  it("Let's go advances and Skip the tour dismisses", () => {
    const onAdvance = vi.fn();
    const onSkipTour = vi.fn();
    render(<Step1Welcome onAdvance={onAdvance} onSkipTour={onSkipTour} />);
    fireEvent.click(screen.getByRole("button", { name: /let's go/i }));
    expect(onAdvance).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /skip the tour/i }));
    expect(onSkipTour).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3.1.2: Run to verify failure**

- [ ] **Step 3.1.3: Implement step 1 with locked copy**

Replace `dividendmapper/app/app/_components/welcome-wizard/step-1-welcome.tsx`:

```tsx
"use client";

export interface Step1WelcomeProps {
  onAdvance: () => void;
  onSkipTour: () => void;
}

export function Step1Welcome({ onAdvance, onSkipTour }: Step1WelcomeProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2
          id="welcome-wizard-step-1-headline"
          className="font-display text-xl font-semibold text-[var(--text)]"
        >
          Welcome to DividendMapper.
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Let&apos;s get you to your first Quality score. Takes about a minute. You can close this any time and it&apos;ll be here when you&apos;re back.
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onSkipTour}
          className="text-xs text-[var(--text-muted)] hover:underline"
        >
          Skip the tour
        </button>
        <button
          type="button"
          onClick={onAdvance}
          className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Let&apos;s go
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.1.4: Run tests**: PASS.

- [ ] **Step 3.1.5: Commit**

```bash
git add app/app/_components/welcome-wizard/step-1-welcome.tsx app/app/_components/welcome-wizard/__tests__/step-1-welcome.test.tsx
git commit -m "feat(welcome-wizard): step 1 Welcome"
```

### Task 3.2: Step 2: Locale tour stop

**Files:**
- Modify: `dividendmapper/app/app/_components/welcome-wizard/step-2-locale.tsx`
- Test: `dividendmapper/app/app/_components/welcome-wizard/__tests__/step-2-locale.test.tsx`

- [ ] **Step 3.2.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Step2Locale } from "../step-2-locale";

const useLocaleMock = vi.fn();
vi.mock("@/lib/locale/context", () => ({
  useLocale: () => useLocaleMock(),
}));

describe("Step2Locale", () => {
  it("interpolates the current locale into the body copy (UK)", () => {
    useLocaleMock.mockReturnValue({ config: { locale: "uk" } });
    render(<Step2Locale onAdvance={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/heads up\./i)).toBeInTheDocument();
    expect(screen.getByText(/set to uk/i)).toBeInTheDocument();
  });

  it("interpolates the current locale into the body copy (US)", () => {
    useLocaleMock.mockReturnValue({ config: { locale: "us" } });
    render(<Step2Locale onAdvance={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/set to us/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3.2.2: Run to verify failure**

- [ ] **Step 3.2.3: Implement step 2 with the locale callout**

Replace `dividendmapper/app/app/_components/welcome-wizard/step-2-locale.tsx`:

```tsx
"use client";

import { useLocale } from "@/lib/locale/context";

export interface Step2LocaleProps {
  onAdvance: () => void;
  onBack: () => void;
}

export function Step2Locale({ onAdvance, onBack }: Step2LocaleProps) {
  const { config } = useLocale();
  const label = config.locale === "us" ? "US" : "UK";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2
          id="welcome-wizard-step-2-headline"
          className="font-display text-xl font-semibold text-[var(--text)]"
        >
          Heads up. This toggle controls the wrappers and currency we show.
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Set to {label} based on your browser. Switch any time from the header.
        </p>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Look for the 🇬🇧 / 🇺🇸 toggle in the top-right of the page.
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-[var(--text-muted)] hover:underline"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onAdvance}
          className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.2.4: Run tests**: PASS.

- [ ] **Step 3.2.5: Commit**

```bash
git add app/app/_components/welcome-wizard/step-2-locale.tsx app/app/_components/welcome-wizard/__tests__/step-2-locale.test.tsx
git commit -m "feat(welcome-wizard): step 2 locale tour stop"
```

### Task 3.3: Step 5: Pro taster

**Files:**
- Modify: `dividendmapper/app/app/_components/welcome-wizard/step-5-pro-taster.tsx`
- Test: `dividendmapper/app/app/_components/welcome-wizard/__tests__/step-5-pro-taster.test.tsx`

- [ ] **Step 3.3.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Step5ProTaster } from "../step-5-pro-taster";

const captureClientEventMock = vi.fn();
vi.mock("@/lib/analytics/posthog-capture", () => ({
  captureClientEvent: (n: string, p?: Record<string, unknown>) => captureClientEventMock(n, p),
}));

describe("Step5ProTaster", () => {
  it("renders all four mini-tiles with the locked copy", () => {
    render(
      <Step5ProTaster onFinish={() => {}} onDismissPermanent={() => {}} onBack={() => {}} />,
    );
    expect(screen.getByText(/resilience scores/i)).toBeInTheDocument();
    expect(screen.getByText(/quality, trim, risk/i)).toBeInTheDocument();
    expect(screen.getByText(/dividend calendar/i)).toBeInTheDocument();
    expect(screen.getByText(/unlimited holdings and watchlist/i)).toBeInTheDocument();
    expect(screen.getByText(/this is separate from your email preferences/i)).toBeInTheDocument();
  });

  it("Don't show this again calls onDismissPermanent", () => {
    const onDismiss = vi.fn();
    render(<Step5ProTaster onFinish={() => {}} onDismissPermanent={onDismiss} onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /don't show this again/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("Finish calls onFinish; See pricing fires pricing-clicked AND onFinish", () => {
    const onFinish = vi.fn();
    render(<Step5ProTaster onFinish={onFinish} onDismissPermanent={() => {}} onBack={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^finish$/i }));
    expect(onFinish).toHaveBeenCalledOnce();
    // See pricing also writes the completion row AND fires the event.
    fireEvent.click(screen.getByRole("link", { name: /see pricing/i }));
    expect(captureClientEventMock).toHaveBeenCalledWith("welcome_wizard_pricing_clicked", {});
    expect(onFinish).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3.3.2: Run to verify failure**

- [ ] **Step 3.3.3: Implement step 5 with the mini-tiles**

Replace `dividendmapper/app/app/_components/welcome-wizard/step-5-pro-taster.tsx`:

```tsx
"use client";

import Link from "next/link";
import { captureClientEvent } from "@/lib/analytics/posthog-capture";

const TILES = [
  { title: "Resilience scores", caption: "Every holding, every night." },
  { title: "Quality, Trim, Risk", caption: "Scores on every equity holding." },
  { title: "Dividend calendar", caption: "18 months out, projected." },
  { title: "Unlimited holdings and watchlist", caption: "With threshold alerts." },
] as const;

export interface Step5ProTasterProps {
  onFinish: () => void;
  onDismissPermanent: () => void;
  onBack: () => void;
}

export function Step5ProTaster({ onFinish, onDismissPermanent, onBack }: Step5ProTasterProps) {
  const handlePricing = () => {
    captureClientEvent("welcome_wizard_pricing_clicked", {});
    onFinish();
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2
          id="welcome-wizard-step-5-headline"
          className="font-display text-xl font-semibold text-[var(--text)]"
        >
          When you&apos;re ready, here&apos;s what Pro adds.
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Nothing on this page is locked behind a paywall. Just so you know what&apos;s there.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TILES.map((t) => (
          <div
            key={t.title}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--canvas)] p-3"
          >
            <p className="text-sm font-medium text-[var(--text)]">{t.title}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{t.caption}</p>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-[var(--text-muted)] hover:underline"
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            <Link
              href="/pricing"
              target="_blank"
              rel="noopener"
              onClick={handlePricing}
              className="rounded-md border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--canvas)]"
            >
              See pricing
            </Link>
            <button
              type="button"
              onClick={onFinish}
              className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Finish
            </button>
          </div>
        </div>
        <div>
          <button
            type="button"
            onClick={onDismissPermanent}
            className="text-xs text-[var(--text-muted)] hover:underline"
          >
            Don&apos;t show this again
          </button>
          <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
            This is separate from your email preferences.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.3.4: Run tests**: PASS.

- [ ] **Step 3.3.5: Commit**

```bash
git add app/app/_components/welcome-wizard/step-5-pro-taster.tsx app/app/_components/welcome-wizard/__tests__/step-5-pro-taster.test.tsx
git commit -m "feat(welcome-wizard): step 5 Pro taster mini-tiles"
```

---

## Day 4: Step 3 (add-holding form) + Step 4 (tour)

**Outcome.** Add-holding form mirrors `AddHoldingModal` field-for-field, POSTs to the existing endpoint, advances on success, has the smart-skip variant. Tour cards render. ~7 new tests.

### Task 4.1: Step 3: Add holding (inline form)

**Files:**
- Modify: `dividendmapper/app/app/_components/welcome-wizard/step-3-add-holding.tsx`
- Test: `dividendmapper/app/app/_components/welcome-wizard/__tests__/step-3-add-holding.test.tsx`

- [ ] **Step 4.1.1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Step3AddHolding } from "../step-3-add-holding";

const useLocaleMock = vi.fn(() => ({ config: { locale: "uk" } }));
vi.mock("@/lib/locale/context", () => ({ useLocale: () => useLocaleMock() }));

const captureClientEventMock = vi.fn();
vi.mock("@/lib/analytics/posthog-capture", () => ({
  captureClientEvent: (n: string, p?: Record<string, unknown>) => captureClientEventMock(n, p),
}));

// TickerSearch is complex; we replace it with a tiny stub for these tests.
vi.mock("@/components/ui/ticker-search", () => ({
  TickerSearch: ({ onSelect }: { onSelect: (r: { symbol: string; currency: string }) => void }) => (
    <button
      type="button"
      data-testid="ticker-stub"
      onClick={() => onSelect({ symbol: "AAPL", currency: "USD" })}
    >
      pick ticker
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
});

describe("Step3AddHolding", () => {
  it("smart-skip: when existingHoldingsCount > 0, renders the confirmation card instead of the form", () => {
    render(<Step3AddHolding existingHoldingsCount={3} onAdvance={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/you've already got 3 holdings/i)).toBeInTheDocument();
    expect(screen.queryByTestId("ticker-stub")).toBeNull();
  });

  it("renders the form with UK wrapper options", () => {
    render(<Step3AddHolding existingHoldingsCount={0} onAdvance={() => {}} onBack={() => {}} />);
    expect(screen.getByLabelText(/wrapper/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /isa/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /401/ })).toBeNull();
  });

  it("blocks the primary until ticker, quantity, avg cost, and wrapper are set", () => {
    render(<Step3AddHolding existingHoldingsCount={0} onAdvance={() => {}} onBack={() => {}} />);
    const primary = screen.getByRole("button", { name: /add holding/i });
    expect(primary).toBeDisabled();
    fireEvent.click(screen.getByTestId("ticker-stub"));
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/avg cost/i), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/wrapper/i), { target: { value: "isa" } });
    expect(primary).not.toBeDisabled();
  });

  it("successful POST advances and fires welcome_wizard_holding_added", async () => {
    const onAdvance = vi.fn();
    render(<Step3AddHolding existingHoldingsCount={0} onAdvance={onAdvance} onBack={() => {}} />);
    fireEvent.click(screen.getByTestId("ticker-stub"));
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/avg cost/i), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/wrapper/i), { target: { value: "isa" } });
    fireEvent.click(screen.getByRole("button", { name: /add holding/i }));
    await waitFor(() => expect(onAdvance).toHaveBeenCalledOnce());
    expect(captureClientEventMock).toHaveBeenCalledWith(
      "welcome_wizard_holding_added",
      expect.objectContaining({ wrapper: "isa", currency: "USD" }),
    );
  });

  it("POST failure leaves the modal open and surfaces an inline error", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "invalid_quantity" }),
    });
    const onAdvance = vi.fn();
    render(<Step3AddHolding existingHoldingsCount={0} onAdvance={onAdvance} onBack={() => {}} />);
    fireEvent.click(screen.getByTestId("ticker-stub"));
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/avg cost/i), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText(/wrapper/i), { target: { value: "isa" } });
    fireEvent.click(screen.getByRole("button", { name: /add holding/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(onAdvance).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4.1.2: Run to verify failure**

- [ ] **Step 4.1.3: Implement step 3 with form + smart-skip + POST**

Replace `dividendmapper/app/app/_components/welcome-wizard/step-3-add-holding.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale/context";
import { TickerSearch, type TickerSearchResult } from "@/components/ui/ticker-search";
import { captureClientEvent } from "@/lib/analytics/posthog-capture";

const WRAPPERS_UK = [
  { value: "isa", label: "ISA" },
  { value: "sipp", label: "SIPP" },
  { value: "gia", label: "GIA" },
] as const;

const WRAPPERS_US = [
  { value: "401k", label: "401(k)" },
  { value: "ira", label: "IRA" },
  { value: "roth_ira", label: "Roth IRA" },
  { value: "brokerage", label: "Brokerage" },
] as const;

const ERROR_COPY: Record<string, string> = {
  invalid_ticker: "Select a ticker from the dropdown before saving.",
  invalid_quantity: "Quantity must be greater than zero.",
  invalid_avg_cost: "Average cost can't be negative.",
  invalid_currency: "Pick a currency.",
  invalid_wrapper: "Pick a wrapper.",
};

export interface Step3AddHoldingProps {
  existingHoldingsCount: number;
  onAdvance: () => void;
  onBack: () => void;
}

export function Step3AddHolding({ existingHoldingsCount, onAdvance, onBack }: Step3AddHoldingProps) {
  const router = useRouter();
  const { config } = useLocale();
  const wrappers = config.locale === "us" ? WRAPPERS_US : WRAPPERS_UK;

  const [selectedTicker, setSelectedTicker] = useState<TickerSearchResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [costCurrency, setCostCurrency] = useState<"GBP" | "USD">(config.locale === "us" ? "USD" : "GBP");
  const [wrapper, setWrapper] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute canSubmit before any early return so the hooks order stays
  // consistent across renders (React rules-of-hooks).
  const canSubmit = useMemo(
    () =>
      !submitting &&
      !!selectedTicker &&
      Number(quantity) > 0 &&
      Number(avgCost) >= 0 &&
      avgCost !== "" &&
      !!wrapper,
    [submitting, selectedTicker, quantity, avgCost, wrapper],
  );

  // Smart-skip: user has holdings already.
  if (existingHoldingsCount > 0) {
    const word = existingHoldingsCount === 1 ? "holding" : "holdings";
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2
            id="welcome-wizard-step-3-headline"
            className="font-display text-xl font-semibold text-[var(--text)]"
          >
            You&apos;ve already got {existingHoldingsCount} {word}. Nice.
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Skipping ahead.
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-[var(--text-muted)] hover:underline"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onAdvance}
            className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!canSubmit || !selectedTicker) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/holdings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticker: selectedTicker.symbol,
          quantity: Number(quantity),
          avg_cost: Number(avgCost),
          cost_currency: costCurrency,
          wrapper,
          broker_label: null,
          notes: null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const code = typeof body?.error === "string" ? body.error : "server_error";
        setError(ERROR_COPY[code] ?? "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }
      captureClientEvent("welcome_wizard_holding_added", {
        wrapper,
        currency: costCurrency,
      });
      router.refresh();
      onAdvance();
    } catch {
      setError("Couldn't reach the server. Try again.");
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    captureClientEvent("welcome_wizard_holding_skipped", {});
    onAdvance();
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2
          id="welcome-wizard-step-3-headline"
          className="font-display text-xl font-semibold text-[var(--text)]"
        >
          Add a holding so the app has something to work with.
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Takes about a minute. You can add more later.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-xs text-[var(--text-muted)]" htmlFor="ww-ticker">Ticker</label>
          <TickerSearch onSelect={setSelectedTicker} />
          {selectedTicker && (
            <p className="mt-1 text-xs text-[var(--text-muted)]">Selected: {selectedTicker.symbol}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ww-quantity" className="block text-xs text-[var(--text-muted)]">Quantity</label>
            <input
              id="ww-quantity"
              type="number"
              min="0"
              step="0.0001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label htmlFor="ww-avg-cost" className="block text-xs text-[var(--text-muted)]">Avg cost</label>
            <input
              id="ww-avg-cost"
              type="number"
              min="0"
              step="0.0001"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-2 py-1 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ww-currency" className="block text-xs text-[var(--text-muted)]">Currency</label>
            <select
              id="ww-currency"
              value={costCurrency}
              onChange={(e) => setCostCurrency(e.target.value as "GBP" | "USD")}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-2 py-1 text-sm"
            >
              <option value="GBP">GBP</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label htmlFor="ww-wrapper" className="block text-xs text-[var(--text-muted)]">Wrapper</label>
            <select
              id="ww-wrapper"
              value={wrapper}
              onChange={(e) => setWrapper(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-2 py-1 text-sm"
            >
              <option value="">Pick one</option>
              {wrappers.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-600">{error}</p>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="text-xs text-[var(--text-muted)] hover:underline">
            Back
          </button>
          <button type="button" onClick={handleSkip} className="text-xs text-[var(--text-muted)] hover:underline">
            I&apos;ll add later
          </button>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving" : "Add holding"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.1.4: Run tests**: PASS.

- [ ] **Step 4.1.5: Commit**

```bash
git add app/app/_components/welcome-wizard/step-3-add-holding.tsx app/app/_components/welcome-wizard/__tests__/step-3-add-holding.test.tsx
git commit -m "feat(welcome-wizard): step 3 add holding form + smart-skip"
```

### Task 4.2: Step 4: Tour cards

**Files:**
- Modify: `dividendmapper/app/app/_components/welcome-wizard/step-4-tour.tsx`
- Test: `dividendmapper/app/app/_components/welcome-wizard/__tests__/step-4-tour.test.tsx`

- [ ] **Step 4.2.1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Step4Tour } from "../step-4-tour";

const captureClientEventMock = vi.fn();
vi.mock("@/lib/analytics/posthog-capture", () => ({
  captureClientEvent: (n: string, p?: Record<string, unknown>) => captureClientEventMock(n, p),
}));

describe("Step4Tour", () => {
  it("renders all three cards with target=_blank and rel=noopener", () => {
    render(<Step4Tour onAdvance={() => {}} onBack={() => {}} />);
    const incomeLink = screen.getByRole("link", { name: /your income chart/i });
    const scoringLink = screen.getByRole("link", { name: /public scoring/i });
    const vehiclesLink = screen.getByRole("link", { name: /income vehicle hub/i });
    for (const link of [incomeLink, scoringLink, vehiclesLink]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    }
  });

  it("clicking a card fires welcome_wizard_tour_card_clicked with the correct card_key", () => {
    render(<Step4Tour onAdvance={() => {}} onBack={() => {}} />);
    fireEvent.click(screen.getByRole("link", { name: /your income chart/i }));
    expect(captureClientEventMock).toHaveBeenCalledWith(
      "welcome_wizard_tour_card_clicked",
      { card_key: "income" },
    );
    fireEvent.click(screen.getByRole("link", { name: /public scoring/i }));
    expect(captureClientEventMock).toHaveBeenCalledWith(
      "welcome_wizard_tour_card_clicked",
      { card_key: "scoring" },
    );
    fireEvent.click(screen.getByRole("link", { name: /income vehicle hub/i }));
    expect(captureClientEventMock).toHaveBeenCalledWith(
      "welcome_wizard_tour_card_clicked",
      { card_key: "vehicles" },
    );
  });
});
```

- [ ] **Step 4.2.2: Run to verify failure**

- [ ] **Step 4.2.3: Implement step 4 with the three cards**

Replace `dividendmapper/app/app/_components/welcome-wizard/step-4-tour.tsx`:

```tsx
"use client";

import Link from "next/link";
import { captureClientEvent } from "@/lib/analytics/posthog-capture";

interface TourCard {
  key: "income" | "scoring" | "vehicles";
  href: string;
  title: string;
  caption: string;
}

const CARDS: TourCard[] = [
  {
    key: "income",
    href: "/app/portfolio#income-chart",
    title: "Your income chart",
    caption: "Projected income per month lives under your Ledger.",
  },
  {
    key: "scoring",
    href: "/scoring",
    title: "Public scoring",
    caption: "Per-ticker resilience pages, free. No signup needed for any ticker we cover.",
  },
  {
    key: "vehicles",
    href: "/income-vehicles",
    title: "Income vehicle hub",
    caption: "REITs, BDCs, UK REITs. Scored and searchable.",
  },
];

export interface Step4TourProps {
  onAdvance: () => void;
  onBack: () => void;
}

export function Step4Tour({ onAdvance, onBack }: Step4TourProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2
          id="welcome-wizard-step-4-headline"
          className="font-display text-xl font-semibold text-[var(--text)]"
        >
          A few things worth knowing while you&apos;re here.
        </h2>
      </div>

      <div className="flex flex-col gap-2">
        {CARDS.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => captureClientEvent("welcome_wizard_tour_card_clicked", { card_key: c.key })}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--canvas)] p-3 hover:bg-[var(--surface)]"
          >
            <p className="text-sm font-medium text-[var(--text)]">{c.title}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{c.caption}</p>
          </Link>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-xs text-[var(--text-muted)] hover:underline">
          Back
        </button>
        <button
          type="button"
          onClick={onAdvance}
          className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.2.4: Run tests**: PASS.

- [ ] **Step 4.2.5: Commit**

```bash
git add app/app/_components/welcome-wizard/step-4-tour.tsx app/app/_components/welcome-wizard/__tests__/step-4-tour.test.tsx
git commit -m "feat(welcome-wizard): step 4 tour cards"
```

---

## Day 5: Layout integration + manual QA + PR

**Outcome.** Wizard renders for new free signups on `/app/*`. All ~31 tests pass. Manual QA on desktop + mobile. Slice merged.

### Task 5.1: Layout integration

**Files:**
- Modify: `dividendmapper/app/app/layout.tsx`
- Test: `dividendmapper/app/app/_components/welcome-wizard/__tests__/layout-integration.test.tsx`

- [ ] **Step 5.1.1: Write the failing integration test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WelcomeWizardIsland } from "../welcome-wizard-island";

vi.mock("../welcome-wizard", () => ({
  WelcomeWizard: ({ initialHoldingsCount }: { initialHoldingsCount: number }) => (
    <div data-testid="welcome-wizard-island">count={initialHoldingsCount}</div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WelcomeWizardIsland", () => {
  it("renders nothing when shouldShow is false", () => {
    render(<WelcomeWizardIsland shouldShow={false} initialHoldingsCount={0} />);
    expect(screen.queryByTestId("welcome-wizard-island")).toBeNull();
  });

  it("renders the wizard when shouldShow is true", () => {
    render(<WelcomeWizardIsland shouldShow initialHoldingsCount={2} />);
    expect(screen.getByTestId("welcome-wizard-island")).toHaveTextContent("count=2");
  });
});
```

- [ ] **Step 5.1.2: Implement the small island wrapper**

Create `dividendmapper/app/app/_components/welcome-wizard/welcome-wizard-island.tsx`:

```tsx
"use client";

import { WelcomeWizard } from "./welcome-wizard";

export interface WelcomeWizardIslandProps {
  shouldShow: boolean;
  initialHoldingsCount: number;
}

export function WelcomeWizardIsland({ shouldShow, initialHoldingsCount }: WelcomeWizardIslandProps) {
  if (!shouldShow) return null;
  return <WelcomeWizard initialHoldingsCount={initialHoldingsCount} />;
}
```

- [ ] **Step 5.1.3: Wire the layout to call the state loader and render the island**

Edit `dividendmapper/app/app/layout.tsx`. Replace the existing body to add the wizard call:

```tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadWelcomeWizardState } from "@/lib/onboarding/load-welcome-state";
import { PostHogIdentify } from "@/components/posthog-identify";
import { isAdmin } from "@/lib/scoring/config";
import { DrawerShell } from "./_components/shell/drawer-shell";
import { WelcomeWizardIsland } from "./_components/welcome-wizard/welcome-wizard-island";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") ?? "/app";
  const user = await requireUser(pathname);

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
  const tier = profile?.tier ?? "free";

  const welcomeState = await loadWelcomeWizardState(supabase, user.id, tier);

  return (
    <>
      <PostHogIdentify userId={user.id} email={user.email} />
      <DrawerShell
        email={user.email}
        tier={tier}
        isAdmin={isAdmin(user.email)}
      >
        {children}
      </DrawerShell>
      <WelcomeWizardIsland
        shouldShow={welcomeState.shouldShow}
        initialHoldingsCount={welcomeState.existingHoldingsCount}
      />
    </>
  );
}
```

- [ ] **Step 5.1.4: Run integration test**: PASS.

- [ ] **Step 5.1.5: Commit**

```bash
git add app/app/layout.tsx \
        app/app/_components/welcome-wizard/welcome-wizard-island.tsx \
        app/app/_components/welcome-wizard/__tests__/layout-integration.test.tsx
git commit -m "feat(welcome-wizard): layout integration"
```

### Task 5.2: Full suite + lint + build

- [ ] **Step 5.2.1: Run vitest project-wide**

```bash
npx vitest run --no-file-parallelism 2>&1 | tail -10
```

Expected: ALL tests PASS. Wizard adds ~31 tests.

- [ ] **Step 5.2.2: Lint**

```bash
npm run lint 2>&1 | tail -10
```

Per `[reference_next16_lint]`: `npm run lint` (eslint), not `next lint`. Expected: no errors.

- [ ] **Step 5.2.3: Local build**

```bash
npm run build 2>&1 | tail -40
```

Per `[feedback_supabase_promiselike_chain]`: always `next build` locally before pushing any supabase-touching code. Expected: build succeeds, no type errors.

### Task 5.3: Manual QA

- [ ] **Step 5.3.1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 5.3.2: Simulate a brand-new free user**

Glenn manually:
1. In the Supabase SQL editor (or psql), `delete from public.welcome_wizard_dismissals where user_id = '<his-uuid>';` to undo his own backfill row.
2. In another browser tab (private/incognito), sign in with the magic link.
3. Land on `/app/portfolio`. Modal should appear automatically.

Verify on desktop:
- Step 1: headline, body, "Let's go" advances, "Skip the tour" closes permanently (re-test: refresh, modal does NOT reappear). Reset the dismissals row again to re-test.
- Step 2: locale label reflects current toggle. Top-right corner of the topbar now shows the 🇬🇧/🇺🇸 toggle (per Task 1.3).
- Step 3: form fields present + validation gating the primary. Successful add: ledger has the new holding after the modal closes.
- Step 3 smart-skip: with a holding already present, the confirmation card renders instead of the form.
- Step 4: three cards open in new tabs (`target="_blank"`).
- Step 5: four mini-tiles render. "See pricing" opens `/pricing` in new tab AND closes the modal AND writes the dismissals row.
- ESC closes the modal for the session (refresh: modal reappears).

Verify on mobile (responsive devtools, < 640px wide):
- Sheet slides up from the bottom, full-height.
- Primary button reachable at the bottom.
- Tour cards stack vertically.
- Mini-tiles collapse to a single column.

Verify accessibility:
- Tab cycles through buttons in DOM order.
- Focus stays inside the modal (cannot tab to the underlying page).
- Screen-reader announces "Step X of 5" after each advance (use NVDA or VoiceOver to verify).
- `prefers-reduced-motion: reduce` (DevTools → Rendering) suppresses the slide animations.

- [ ] **Step 5.3.3: Reset Glenn's dismissals row after QA**

```sql
insert into public.welcome_wizard_dismissals (user_id, reason)
values ('<his-uuid>', 'backfilled')
on conflict (user_id) do update set reason = 'backfilled';
```

### Task 5.4: Push + open PR

- [ ] **Step 5.4.1: Push**

```bash
git push -u origin feature/welcome-wizard
```

- [ ] **Step 5.4.2: Open the PR**

```bash
gh pr create --title "Free-user welcome wizard (5-step modal on first /app/* visit)" --body "$(cat <<'EOF'
## Summary
- Migration 0021 adds welcome_wizard_dismissals table + backfills every existing auth.users row
- 5-step modal: Welcome → Locale tour-stop → Add first holding (inline form mirroring AddHoldingModal) → Free-tier tour → Pro mini-tiles taster
- POST /api/onboarding/welcome writes the dismissal row (reason = completed / dismissed)
- LocaleToggle now lives in /app/* topbar (previously only on marketing pages)
- All user-facing copy cleared the humaniser pass (zero em dashes, voice matches the existing lifecycle email chain)
- Pro / Premium tiers never see the wizard
- Smart-skip: if existingHoldingsCount > 0 at modal mount, step 3 swaps to a confirmation card
- ~31 new tests

## Prerequisite
- Migration 0021_welcome_wizard_dismissals.sql applied to prod by Glenn

## Test plan
- [ ] All vitest PASS (~31 new tests)
- [ ] `npm run lint` clean
- [ ] `npm run build` clean
- [ ] Manual: new free signup sees the modal on /app/portfolio
- [ ] Manual: existing users (incl. Pro) do NOT see it
- [ ] Manual: ESC closes for session; Skip the tour / Don't show again / Finish all close permanently
- [ ] Manual: Step 3 form adds the holding via /api/portfolio/holdings
- [ ] Manual: mobile sheet renders bottom-up
- [ ] Manual: prefers-reduced-motion suppresses animations
EOF
)"
```

---

## Day 6 (buffer)

Reserved for:
- Visual iteration on copy / spacing based on Glenn's review of the live PR
- Any test flakiness surfaced by CI
- Any edge case turned up by the manual QA pass

---

## Acceptance criteria

**Done when:**
- Migration `0021_welcome_wizard_dismissals.sql` applied to prod. Backfill row count matches `auth.users` count.
- Wizard renders for new free signups on first `/app/*` visit.
- Wizard does NOT render for: existing users (backfilled), Pro/Premium tiers, anyone with a dismissals row.
- All five steps render with locked copy. Smart-skip variant on step 3 fires when `existingHoldingsCount > 0`.
- Dismissal server action writes the row with correct `reason`. Optimistic UI closes the modal immediately.
- LocaleToggle visible in the /app/* topbar.
- Telemetry events fire correctly through the funnel (verify in PostHog: `shown` → `completed`).
- All ~31 tests pass.
- `npm run lint` clean. `npm run build` clean.

---

## Memory cross-refs

- `[feedback_humaniser_mandatory]`: all user-facing copy in this plan cleared the humaniser pass; the spec self-review verified zero em dashes.
- `[project_buy_renamed_to_quality]`: step 5 tile uses "Quality, Trim, Risk" (the equity score triad, not "Buy").
- `[reference_app_page_auth_guard]`: layout-level `requireUser` guard pattern preserved.
- `[reference_app_marketing_chrome_split]`: wizard renders under `/app/*` so it inherits the drawer shell, not marketing chrome.
- `[feedback_supabase_promiselike_chain]`: `next build` locally before any push touching new tables.
- `[feedback_set_state_in_effect_workaround]`: wizard step state stays in plain `useState`, no derived effects.
- `[feedback_dividendmapper_nextjs_warning]`: read `node_modules/next/dist/docs/` before any Next-specific code.
- `[reference_supabase_cli_workflow]`: Glenn's CLI flow for `db push`.
- `[reference_supabase_out_of_order_migration_workaround]`: fallback if migration number collides.
- `[reference_next16_lint]`: `npm run lint`, not `next lint`.
- `[feedback_concurrent_worktree_branch_race]`: node_modules junction caveat when parallel agents share the root checkout.
- `[reference_welcome_email_template]`: wizard voice matches the existing lifecycle email chain.
