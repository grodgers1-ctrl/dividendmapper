# Phase 2.75 Day 8 — Admin Audit + Personalisation Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a read-only admin scoring-audit page and a 6-question personalisation wizard whose answers tune the Reinvest filter, action-hint sensitivity, and copy by default — with an off-by-default "view through my goals" score lens — all without touching the frozen scoring engine.

**Architecture:** Pure display-layer. 8A reads `equity_scores` into a server-rendered admin page gated by `isAdmin`. 8B persists wizard answers to the existing `user_preferences` table via `/api/preferences`, threads `sectors_to_avoid` into the Reinvest card, derives an action-hint `sensitivity` shift from `risk_appetite`+`investing_horizon`, and re-aggregates the Buy/Quality score at render time from `equity_score_signals` only when the user opts into `?lens=1`. No migration (tables exist in 0004), no cron change.

**Tech Stack:** Next.js 16 App Router (server components, `force-dynamic`, `runtime="nodejs"`), React 19, Tailwind v4, `@base-ui/react/dialog`, Supabase (`createSupabaseServerClient`, `getClaims`, RLS), vitest + RTL (jsdom).

**Spec:** `docs/superpowers/specs/2026-06-02-day8-admin-audit-and-wizard-design.md`

**Worktree:** `.claude/worktrees/day8-audit-wizard` (branch `worktree-day8-audit-wizard`, based on prod tip `ff859fe`). Run all commands from the `dividendmapper/` subdir: prefix with `cd /c/Users/grodg/dividend_mapper_plan/.claude/worktrees/day8-audit-wizard/dividendmapper &&`.

---

## Conventions (read once)

- **TDD:** failing test → run red → minimal impl → run green → commit. One logical unit per commit.
- **Vitest:** globals are OFF — import `{ describe, it, expect, vi, beforeEach, afterEach }` from `"vitest"` in every test. RTL cleanup is in `vitest.setup.ts` (don't remove). Desktop+mobile both render in jsdom — scope duplicated elements with `within`/`getAllBy`.
- **Run a single test file:** `npx vitest run <path>` (add `-t "<name>"` for one case).
- **Auth routes:** mirror `app/api/scoring/overrides/route.ts` — `createSupabaseServerClient()`, `getClaims()`, `claims.sub`, `runtime="nodejs"`, `dynamic="force-dynamic"`. Route tests mock `@/lib/supabase/server`.
- **Protected pages:** `const user = await requireUser("/app/<path>")` then dereference — never `(await getCurrentUser())!`.
- **Commits:** HEREDOC, end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Copy:** no em dashes (colon/comma); run `node scripts/lint/humaniser.js --strict <file>` on any new user-facing string and show the 24-pattern audit before the checkpoint. Never "Buy/Sell/Recommend"; "Not financial advice" where scores appear.
- **Next 16:** read `node_modules/next/dist/docs/` before any Next-specific API you are unsure of (e.g. `searchParams` is async in Next 16 — `await props.searchParams`).

---

## File Structure

**8A — Admin audit**
- Create `lib/scoring/load-audit.ts` — pure `summariseAudit(rows)` + thin `loadAudit()` fetch wrapper.
- Create `lib/scoring/__tests__/load-audit.test.ts`.
- Create `app/app/admin/scoring/audit/page.tsx` — server page, self-guard + `isAdmin`.
- Create `app/app/admin/scoring/audit/__tests__/page.test.tsx` — guard test.

**8B — Wizard: logic**
- Modify `lib/scoring/chip-display.ts` — add `sensitivity` param to `actionHint` + `actionHintSensitivity(prefs)`.
- Modify `lib/scoring/__tests__/chip-display.test.ts` (create if absent).
- Create `lib/scoring/reaggregate.ts` — `categoryWeightsFor(prefs)` + `reaggregateBuyScore(signals, weights)`.
- Create `lib/scoring/__tests__/reaggregate.test.ts`.
- Create `lib/scoring/load-buy-signals.ts` — fetch latest `equity_score_signals` (buy) per ticker.

**8B — Wizard: API + wiring**
- Create `app/api/preferences/route.ts` — GET + PUT, validated.
- Create `app/api/preferences/__tests__/route.test.ts`.
- Create `lib/scoring/preferences.ts` — `UserPreferences` type + `loadUserPreferences(userId)` server reader.
- Modify `lib/scoring/load-portfolio-analytics.ts` — load prefs, thread `sectorsToAvoid`, pass `sensitivity`, compute lensed scores when requested.

**8B — Wizard: UI**
- Create `app/app/portfolio/_components/personalisation-wizard.tsx` — the modal.
- Create `app/app/portfolio/_components/__tests__/personalisation-wizard.test.tsx`.
- Create `app/app/portfolio/_components/score-lens-toggle.tsx` — `?lens=1` toggle island.
- Modify `app/app/portfolio/scoring/page.tsx` — first-visit modal + lens toggle + lensed scores.
- Modify `app/app/account/page.tsx` — "Personalise" entry (revisit, all tiers).

---

# 8A — Admin Audit Dashboard

### Task A1: Pure audit summary

**Files:**
- Create: `lib/scoring/load-audit.ts`
- Test: `lib/scoring/__tests__/load-audit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { summariseAudit, type AuditRow } from "../load-audit";

const rows: AuditRow[] = [
  { ticker: "PEP", buy_score: 81, trim_score: 19, risk_score: 40, buy_quality_gate_passed: true, buy_failed_gates: [], data_quality: "sparse", computed_at: "2026-06-01T22:34:00Z" },
  { ticker: "VOD.L", buy_score: null, trim_score: 76, risk_score: 75, buy_quality_gate_passed: false, buy_failed_gates: ["GATE_2", "GATE_4"], data_quality: "degraded_uk", computed_at: "2026-06-01T22:34:00Z" },
  { ticker: "SCHD", buy_score: null, trim_score: 85, risk_score: 60, buy_quality_gate_passed: false, buy_failed_gates: ["GATE_4"], data_quality: "sparse", computed_at: "2026-06-01T22:34:00Z" },
];

describe("summariseAudit", () => {
  it("counts gate pass/DNQ", () => {
    const s = summariseAudit(rows, new Date("2026-06-02T10:00:00Z"));
    expect(s.gatePassed).toBe(1);
    expect(s.gateFailed).toBe(2);
  });

  it("breaks down data_quality", () => {
    const s = summariseAudit(rows, new Date("2026-06-02T10:00:00Z"));
    expect(s.dataQuality).toEqual({ clean: 0, sparse: 2, degraded_uk: 1 });
  });

  it("tallies failed gates", () => {
    const s = summariseAudit(rows, new Date("2026-06-02T10:00:00Z"));
    expect(s.gateTally).toEqual({ GATE_2: 1, GATE_4: 2 });
  });

  it("flags stale when newest computed_at is over 36h old", () => {
    const fresh = summariseAudit(rows, new Date("2026-06-02T10:00:00Z"));
    expect(fresh.ageHours).toBeLessThan(36);
    expect(fresh.stale).toBe(false);
    const stale = summariseAudit(rows, new Date("2026-06-04T12:00:00Z"));
    expect(stale.stale).toBe(true);
  });

  it("handles an empty set without NaN", () => {
    const s = summariseAudit([], new Date("2026-06-02T10:00:00Z"));
    expect(s.total).toBe(0);
    expect(s.newestComputedAt).toBeNull();
    expect(s.stale).toBe(true);
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `npx vitest run lib/scoring/__tests__/load-audit.test.ts`
Expected: FAIL — `summariseAudit` not exported.

- [ ] **Step 3: Implement**

```ts
// lib/scoring/load-audit.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AuditRow {
  ticker: string;
  buy_score: number | null;
  trim_score: number | null;
  risk_score: number | null;
  buy_quality_gate_passed: boolean;
  buy_failed_gates: string[] | null;
  data_quality: string;
  computed_at: string;
}

export interface AuditSummary {
  total: number;
  gatePassed: number;
  gateFailed: number;
  dataQuality: Record<string, number>;
  gateTally: Record<string, number>;
  newestComputedAt: string | null;
  ageHours: number | null;
  stale: boolean;
  rows: AuditRow[];
}

const STALE_HOURS = 36;
const QUALITY_KEYS = ["clean", "sparse", "degraded_uk"];

export function summariseAudit(rows: AuditRow[], now: Date = new Date()): AuditSummary {
  const dataQuality: Record<string, number> = {};
  for (const k of QUALITY_KEYS) dataQuality[k] = 0;
  const gateTally: Record<string, number> = {};
  let gatePassed = 0;
  let newest: number | null = null;

  for (const r of rows) {
    if (r.buy_quality_gate_passed) gatePassed++;
    dataQuality[r.data_quality] = (dataQuality[r.data_quality] ?? 0) + 1;
    for (const g of r.buy_failed_gates ?? []) gateTally[g] = (gateTally[g] ?? 0) + 1;
    const t = new Date(r.computed_at).getTime();
    if (Number.isFinite(t) && (newest === null || t > newest)) newest = t;
  }

  const ageHours = newest === null ? null : (now.getTime() - newest) / 3_600_000;
  return {
    total: rows.length,
    gatePassed,
    gateFailed: rows.length - gatePassed,
    dataQuality,
    gateTally,
    newestComputedAt: newest === null ? null : new Date(newest).toISOString(),
    ageHours,
    stale: ageHours === null || ageHours > STALE_HOURS,
    rows: [...rows].sort((a, b) => a.ticker.localeCompare(b.ticker)),
  };
}

export async function loadAudit(now: Date = new Date()): Promise<AuditSummary> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("equity_scores")
    .select(
      "ticker, buy_score, trim_score, risk_score, buy_quality_gate_passed, buy_failed_gates, data_quality, computed_at",
    )
    .returns<AuditRow[]>();
  return summariseAudit(data ?? [], now);
}
```

- [ ] **Step 4: Run it (green)**

Run: `npx vitest run lib/scoring/__tests__/load-audit.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scoring/load-audit.ts lib/scoring/__tests__/load-audit.test.ts
git commit -F - <<'EOF'
feat(audit): summariseAudit + loadAudit over equity_scores

Pure freshness/gate/data-quality/gate-failure tally for the Day-8 admin
audit page. Read-only; no engine change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task A2: Admin audit page + guard

**Files:**
- Create: `app/app/admin/scoring/audit/page.tsx`
- Test: `app/app/admin/scoring/audit/__tests__/page.test.tsx`

Note: confirm `requireUser` returns a `.email` (Supabase auth user). If it returns only `.id`, read the email from `supabase.auth.getClaims()` (`claims.email`) instead — adjust the page accordingly. The test below mocks whichever source you use.

- [ ] **Step 1: Write the failing guard test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireUser = vi.fn();
vi.mock("@/lib/auth/server", () => ({ requireUser: (p: string) => requireUser(p) }));
const notFound = vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); });
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));
vi.mock("@/lib/scoring/load-audit", () => ({
  loadAudit: vi.fn(async () => ({
    total: 0, gatePassed: 0, gateFailed: 0, dataQuality: {}, gateTally: {},
    newestComputedAt: null, ageHours: null, stale: true, rows: [],
  })),
}));

import AuditPage from "../page";

describe("admin audit guard", () => {
  beforeEach(() => { requireUser.mockReset(); notFound.mockReset().mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); }); });

  it("calls notFound for a non-admin email", async () => {
    requireUser.mockResolvedValue({ id: "u1", email: "intruder@example.com" });
    await expect(AuditPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders for an admin email", async () => {
    requireUser.mockResolvedValue({ id: "u1", email: "glenn@dividendmapper.com" });
    const el = await AuditPage();
    expect(el).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `npx vitest run app/app/admin/scoring/audit/__tests__/page.test.tsx`
Expected: FAIL — page module missing.

- [ ] **Step 3: Implement the page**

```tsx
// app/app/admin/scoring/audit/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { isAdmin } from "@/lib/scoring/config";
import { loadAudit } from "@/lib/scoring/load-audit";

export const metadata: Metadata = {
  title: "Scoring audit",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AuditPage() {
  const user = await requireUser("/app/admin/scoring/audit");
  if (!isAdmin(user.email)) notFound();

  const s = await loadAudit();
  const gates = ["GATE_1", "GATE_2", "GATE_3", "GATE_4", "GATE_5", "GATE_6"];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
        Scoring audit
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Internal health view of the nightly equity-score run. Read only.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`rounded-xl border p-4 ${s.stale ? "border-amber-500/40 bg-amber-50 dark:bg-amber-900/15" : "border-border bg-card"}`}>
          <p className="text-xs font-medium text-muted-foreground">Freshness</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {s.ageHours === null ? "no data" : `${s.ageHours.toFixed(1)}h`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {s.stale ? "STALE (>36h)" : "fresh"} · newest {s.newestComputedAt ?? "n/a"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Scored</p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">{s.gatePassed}<span className="text-base text-muted-foreground"> / {s.total}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{s.gateFailed} did not qualify</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Data quality</p>
          <p className="mt-1 text-sm text-foreground">
            clean {s.dataQuality.clean ?? 0} · sparse {s.dataQuality.sparse ?? 0} · degraded_uk {s.dataQuality.degraded_uk ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Gate failures</p>
          <p className="mt-1 text-sm text-foreground">
            {gates.filter((g) => s.gateTally[g]).map((g) => `${g}: ${s.gateTally[g]}`).join(" · ") || "none"}
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Ticker</th>
              <th className="px-3 py-2 font-medium">Buy</th>
              <th className="px-3 py-2 font-medium">Trim</th>
              <th className="px-3 py-2 font-medium">Risk</th>
              <th className="px-3 py-2 font-medium">Gate</th>
              <th className="px-3 py-2 font-medium">Failed</th>
              <th className="px-3 py-2 font-medium">Quality</th>
              <th className="px-3 py-2 font-medium">Computed</th>
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.ticker} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-foreground">{r.ticker}</td>
                <td className="px-3 py-2">{r.buy_score ?? "—"}</td>
                <td className="px-3 py-2">{r.trim_score ?? "—"}</td>
                <td className="px-3 py-2">{r.risk_score ?? "—"}</td>
                <td className="px-3 py-2">{r.buy_quality_gate_passed ? "pass" : "DNQ"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{(r.buy_failed_gates ?? []).join(", ") || "—"}</td>
                <td className="px-3 py-2 text-xs">{r.data_quality}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.computed_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run it (green)**

Run: `npx vitest run app/app/admin/scoring/audit/__tests__/page.test.tsx`
Expected: PASS (2 tests). If `requireUser` lacks `.email`, switch the page to read `getClaims().claims.email` and update the mock.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → clean.
```bash
git add app/app/admin/scoring/audit/
git commit -F - <<'EOF'
feat(audit): admin scoring-audit page (read-only, isAdmin-gated)

/app/admin/scoring/audit: freshness (>36h amber), gate pass/DNQ,
data_quality breakdown, gate-failure tally, ticker table. Self-guards
via requireUser then isAdmin(email).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

# 8B — Personalisation Wizard

### Task B1: Action-hint sensitivity

**Files:**
- Modify: `lib/scoring/chip-display.ts:25-37` (the `actionHint` function)
- Test: `lib/scoring/__tests__/chip-display.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { actionHint, actionHintSensitivity } from "../chip-display";

describe("actionHintSensitivity", () => {
  it("is 0 for undecided/empty", () => {
    expect(actionHintSensitivity(null)).toBe(0);
    expect(actionHintSensitivity({ risk_appetite: "undecided", investing_horizon: "undecided" })).toBe(0);
  });
  it("sums cautious + already_retired and clamps to -10", () => {
    expect(actionHintSensitivity({ risk_appetite: "cautious", investing_horizon: "already_retired" })).toBe(-10);
  });
  it("nets cautious + 10y_plus to 0", () => {
    expect(actionHintSensitivity({ risk_appetite: "cautious", investing_horizon: "10y_plus" })).toBe(0);
  });
  it("sums aggressive + 10y_plus and clamps to +10", () => {
    expect(actionHintSensitivity({ risk_appetite: "aggressive", investing_horizon: "10y_plus" })).toBe(10);
  });
});

describe("actionHint with sensitivity", () => {
  it("default thresholds unchanged when sensitivity omitted", () => {
    expect(actionHint({ buy: null, trim: 50, risk: 0 })).toBe("Watch: extended");
    expect(actionHint({ buy: null, trim: 49, risk: 0 })).toBe("Hold");
  });
  it("negative sensitivity warns earlier (trim 65 fires 'Consider trimming' at -10)", () => {
    expect(actionHint({ buy: null, trim: 65, risk: 0 }, -10)).toBe("Consider trimming");
    expect(actionHint({ buy: null, trim: 65, risk: 0 }, 0)).toBe("Watch: extended");
  });
  it("positive sensitivity warns later (risk 80 stays 'Reassess thesis' at +10)", () => {
    expect(actionHint({ buy: null, trim: 0, risk: 80 }, 10)).toBe("Reassess thesis");
    expect(actionHint({ buy: null, trim: 0, risk: 80 }, 0)).toBe("Review urgently");
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `npx vitest run lib/scoring/__tests__/chip-display.test.ts`
Expected: FAIL — `actionHintSensitivity` not exported / `actionHint` arity.

- [ ] **Step 3: Implement** — replace `actionHint` (lines 25-37) and append the helper.

```ts
export interface ActionHintPrefs {
  risk_appetite?: string | null;
  investing_horizon?: string | null;
}

// Sums a risk-appetite shift and a horizon shift, clamped to [-10, +10].
// Negative => warn earlier (lower thresholds); positive => warn later.
export function actionHintSensitivity(prefs: ActionHintPrefs | null): number {
  if (!prefs) return 0;
  const risk = prefs.risk_appetite === "cautious" ? -5 : prefs.risk_appetite === "aggressive" ? 5 : 0;
  const horizon =
    prefs.investing_horizon === "already_retired" || prefs.investing_horizon === "lt_5y" ? -5
    : prefs.investing_horizon === "10y_plus" ? 5 : 0;
  return Math.max(-10, Math.min(10, risk + horizon));
}

export function actionHint(
  s: { buy: number | null; trim: number | null; risk: number | null },
  sensitivity = 0,
): string {
  const trim = s.trim ?? 0;
  const risk = s.risk ?? 0;
  if (risk >= 75 + sensitivity) return "Review urgently";
  if (risk >= 50 + sensitivity) return "Reassess thesis";
  if (trim >= 75 + sensitivity) return "Consider trimming";
  if (trim >= 50 + sensitivity) return "Watch: extended";
  return "Hold";
}
```

- [ ] **Step 4: Run it (green)**

Run: `npx vitest run lib/scoring/__tests__/chip-display.test.ts`
Expected: PASS. Also run `npx vitest run lib/scoring/__tests__/portfolio-scores.test.ts` to confirm the existing `actionHint` caller still passes (default param keeps it backward-compatible).

- [ ] **Step 5: Commit**

```bash
git add lib/scoring/chip-display.ts lib/scoring/__tests__/chip-display.test.ts
git commit -F - <<'EOF'
feat(scoring): action-hint sensitivity from risk_appetite + horizon

Backward-compatible optional sensitivity param shifts the risk/trim
thresholds; actionHintSensitivity(prefs) derives it (clamped -10..+10).
Posture-layer input for the personalisation wizard. Display only.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task B2: Category weights + buy-score re-aggregation (lens)

**Files:**
- Create: `lib/scoring/reaggregate.ts`
- Test: `lib/scoring/__tests__/reaggregate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { categoryWeightsFor, reaggregateBuyScore, type StoredSignal } from "../reaggregate";
import { BUY_BASE_WEIGHTS } from "../weights";

describe("categoryWeightsFor", () => {
  it("returns base when all undecided/null", () => {
    expect(categoryWeightsFor(null)).toEqual(BUY_BASE_WEIGHTS);
  });
  it("sums to 1 after renormalise", () => {
    const w = categoryWeightsFor({ primary_goal: "income_now", investing_horizon: "10y_plus", risk_appetite: "aggressive" });
    const sum = w.A + w.B + w.C + w.D;
    expect(sum).toBeCloseTo(1, 6);
  });
  it("clamps a category to the [0.05, 0.55] band", () => {
    const w = categoryWeightsFor({ primary_goal: "income_now", risk_appetite: "cautious", investing_horizon: "already_retired" });
    expect(Math.min(w.A, w.B, w.C, w.D)).toBeGreaterThanOrEqual(0.05 / (w.A + w.B + w.C + w.D) - 1e-9);
  });
});

describe("reaggregateBuyScore", () => {
  // One signal per category, each scoring 100/50/0/100 -> with base weights
  // .35*100 + .30*50 + .20*0 + .15*100 = 35 + 15 + 0 + 15 = 65
  const signals: StoredSignal[] = [
    { signal_code: "A1", raw_score: 100, weight: 1 },
    { signal_code: "B1", raw_score: 50, weight: 1 },
    { signal_code: "C1", raw_score: 0, weight: 1 },
    { signal_code: "D1", raw_score: 100, weight: 1 },
  ];
  it("reproduces base-weighted score", () => {
    expect(reaggregateBuyScore(signals, BUY_BASE_WEIGHTS)).toBe(65);
  });
  it("drops a fully-N/A category and renormalises across the rest", () => {
    const noC = signals.filter((s) => s.signal_code !== "C1");
    // available A/B/D base weights .35/.30/.15 sum .80
    // (.35*100 + .30*50 + .15*100)/.80 = (35+15+15)/.8 = 65/.8 = 81.25 -> 81
    expect(reaggregateBuyScore(noC, BUY_BASE_WEIGHTS)).toBe(81);
  });
  it("returns null when no signals", () => {
    expect(reaggregateBuyScore([], BUY_BASE_WEIGHTS)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `npx vitest run lib/scoring/__tests__/reaggregate.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// lib/scoring/reaggregate.ts
import { BUY_BASE_WEIGHTS, type BuyCategoryWeights } from "./weights";
import { computeCategoryAggregate, type SignalWeight } from "./redistribute-weights";

export interface StoredSignal {
  signal_code: string; // A1, B2, ...
  raw_score: number | null;
  weight: number; // base within-category weight, as persisted
}

export interface WeightPrefs {
  primary_goal?: string | null;
  investing_horizon?: string | null;
  risk_appetite?: string | null;
}

type Cat = "A" | "B" | "C" | "D";
const CATS: Cat[] = ["A", "B", "C", "D"];
const CLAMP_MIN = 0.05;
const CLAMP_MAX = 0.55;

// Additive deltas per answer (spec table). Trim/Risk are never reweighted.
const DELTAS: Record<string, Partial<Record<Cat, number>>> = {
  "goal:income_now": { A: 0.05, B: -0.1, C: -0.05, D: 0.1 },
  "goal:total_return": { A: 0.05, B: 0.08, C: 0.02, D: -0.1 },
  "goal:safety_stability": { A: 0.1, B: -0.08, C: -0.05, D: 0.03 },
  "horizon:10y_plus": { A: 0.08, B: -0.08 },
  "horizon:lt_5y": { A: -0.05, B: 0.03, D: 0.05 },
  "horizon:already_retired": { A: -0.05, B: 0.03, D: 0.05 },
  "risk:aggressive": { A: -0.05, B: 0.08, C: 0.05, D: -0.05 },
  "risk:cautious": { A: 0.08, B: -0.05, C: -0.05 },
};

export function categoryWeightsFor(prefs: WeightPrefs | null): BuyCategoryWeights {
  if (!prefs) return { ...BUY_BASE_WEIGHTS };
  const w: Record<Cat, number> = { ...BUY_BASE_WEIGHTS };
  const keys = [
    prefs.primary_goal && prefs.primary_goal !== "undecided" ? `goal:${prefs.primary_goal}` : null,
    prefs.investing_horizon && prefs.investing_horizon !== "undecided" ? `horizon:${prefs.investing_horizon}` : null,
    prefs.risk_appetite && prefs.risk_appetite !== "undecided" ? `risk:${prefs.risk_appetite}` : null,
  ].filter((k): k is string => k !== null);

  for (const k of keys) {
    const d = DELTAS[k];
    if (!d) continue;
    for (const c of CATS) if (d[c]) w[c] += d[c] as number;
  }
  // clamp then renormalise to sum 1
  for (const c of CATS) w[c] = Math.max(CLAMP_MIN, Math.min(CLAMP_MAX, w[c]));
  const sum = CATS.reduce((a, c) => a + w[c], 0);
  for (const c of CATS) w[c] = w[c] / sum;
  return w;
}

export function reaggregateBuyScore(
  signals: StoredSignal[],
  weights: BuyCategoryWeights,
): number | null {
  if (signals.length === 0) return null;
  const byCat: Record<Cat, SignalWeight[]> = { A: [], B: [], C: [], D: [] };
  for (const s of signals) {
    const c = s.signal_code[0] as Cat;
    if (byCat[c]) byCat[c].push({ code: s.signal_code, score: s.raw_score, weight: s.weight });
  }
  const available = CATS
    .map((c) => ({ c, agg: computeCategoryAggregate(byCat[c]), base: weights[c] }))
    .filter((x) => x.agg !== null);
  if (available.length === 0) return null;
  const wSum = available.reduce((a, x) => a + x.base, 0);
  const score = available.reduce((a, x) => a + (x.agg as { value: number }).value * (x.base / wSum), 0);
  return Math.max(0, Math.min(100, Math.round(score)));
}
```

- [ ] **Step 4: Run it (green)**

Run: `npx vitest run lib/scoring/__tests__/reaggregate.test.ts`
Expected: PASS (6 cases).

- [ ] **Step 5: Commit**

```bash
git add lib/scoring/reaggregate.ts lib/scoring/__tests__/reaggregate.test.ts
git commit -F - <<'EOF'
feat(scoring): buy-score re-aggregation for the personalisation lens

categoryWeightsFor maps goal/horizon/risk to clamped, renormalised
category weights; reaggregateBuyScore rebuilds the 0-100 Buy score from
persisted equity_score_signals (reusing computeCategoryAggregate). Pure;
used only by the opt-in lens. No cron/engine change.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task B3: Buy-signal loader (latest per ticker)

**Files:**
- Create: `lib/scoring/load-buy-signals.ts`
- Test: `lib/scoring/__tests__/load-buy-signals.test.ts`

This isolates the "latest `observed_at` per ticker" grouping as pure logic so it can be unit-tested without Supabase.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { latestSignalsByTicker, type SignalRow } from "../load-buy-signals";

const rows: SignalRow[] = [
  { ticker: "PEP", signal_code: "A1", raw_score: 88, weight: 0.5, observed_at: "2026-05-31" },
  { ticker: "PEP", signal_code: "A1", raw_score: 92, weight: 0.5, observed_at: "2026-06-01" }, // newer
  { ticker: "PEP", signal_code: "B1", raw_score: 60, weight: 0.4, observed_at: "2026-06-01" },
  { ticker: "MSFT", signal_code: "A1", raw_score: 40, weight: 0.5, observed_at: "2026-06-01" },
];

describe("latestSignalsByTicker", () => {
  it("keeps only the newest observed_at per ticker", () => {
    const m = latestSignalsByTicker(rows);
    expect(m.PEP.map((s) => s.signal_code).sort()).toEqual(["A1", "B1"]);
    expect(m.PEP.find((s) => s.signal_code === "A1")!.raw_score).toBe(92);
    expect(m.MSFT).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `npx vitest run lib/scoring/__tests__/load-buy-signals.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/scoring/load-buy-signals.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StoredSignal } from "./reaggregate";

export interface SignalRow {
  ticker: string;
  signal_code: string;
  raw_score: number | null;
  weight: number;
  observed_at: string;
}

export function latestSignalsByTicker(rows: SignalRow[]): Record<string, StoredSignal[]> {
  const newest: Record<string, string> = {};
  for (const r of rows) if (!newest[r.ticker] || r.observed_at > newest[r.ticker]) newest[r.ticker] = r.observed_at;
  const out: Record<string, StoredSignal[]> = {};
  for (const r of rows) {
    if (r.observed_at !== newest[r.ticker]) continue;
    (out[r.ticker] ??= []).push({ signal_code: r.signal_code, raw_score: r.raw_score, weight: r.weight });
  }
  return out;
}

export async function loadBuySignals(tickers: string[]): Promise<Record<string, StoredSignal[]>> {
  if (tickers.length === 0) return {};
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("equity_score_signals")
    .select("ticker, signal_code, raw_score, weight, observed_at")
    .eq("score_type", "buy")
    .in("ticker", tickers)
    .returns<SignalRow[]>();
  return latestSignalsByTicker(data ?? []);
}
```

- [ ] **Step 4: Run it (green)**

Run: `npx vitest run lib/scoring/__tests__/load-buy-signals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scoring/load-buy-signals.ts lib/scoring/__tests__/load-buy-signals.test.ts
git commit -F - <<'EOF'
feat(scoring): loadBuySignals + latestSignalsByTicker

Fetch latest-observed buy signals per ticker for the personalisation
lens re-aggregation. Pure grouping is unit-tested separately.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task B4: Preferences type + server reader

**Files:**
- Create: `lib/scoring/preferences.ts`

- [ ] **Step 1: Implement (no new behaviour to TDD beyond the type; covered via the API + loader tests)**

```ts
// lib/scoring/preferences.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface UserPreferences {
  primary_goal: string | null;
  investing_horizon: string | null;
  risk_appetite: string | null;
  reinvest_default: string | null;
  sectors_to_avoid: string[] | null;
  annual_income_target_gbp: number | null;
  wizard_completed_at: string | null;
  wizard_skipped_at: string | null;
}

export const PRIMARY_GOALS = ["income_now", "total_return", "safety_stability", "undecided"] as const;
export const HORIZONS = ["lt_5y", "5_10y", "10y_plus", "already_retired", "undecided"] as const;
export const RISK_APPETITES = ["cautious", "balanced", "aggressive", "undecided"] as const;
export const REINVEST_DEFAULTS = ["always_drip", "look_for_opportunities", "withdraw_cash", "undecided"] as const;

export async function loadUserPreferences(userId: string): Promise<UserPreferences | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("primary_goal, investing_horizon, risk_appetite, reinvest_default, sectors_to_avoid, annual_income_target_gbp, wizard_completed_at, wizard_skipped_at")
    .eq("user_id", userId)
    .maybeSingle()
    .returns<UserPreferences>();
  return data ?? null;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → clean.
```bash
git add lib/scoring/preferences.ts
git commit -F - <<'EOF'
feat(prefs): UserPreferences type + loadUserPreferences reader

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task B5: /api/preferences route

**Files:**
- Create: `app/api/preferences/route.ts`
- Test: `app/api/preferences/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const upsert = vi.fn();
const maybeSingle = vi.fn();
const getClaims = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims },
    from: () => ({
      upsert: (...a: unknown[]) => { upsert(...a); return { error: null }; },
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
  }),
}));

import { GET, PUT } from "../route";

function req(body: unknown) {
  return new Request("http://x/api/preferences", { method: "PUT", body: JSON.stringify(body) });
}

describe("/api/preferences", () => {
  beforeEach(() => { upsert.mockReset(); getClaims.mockReset(); maybeSingle.mockReset(); });

  it("401 when no session", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const res = await PUT(req({ primary_goal: "income_now" }));
    expect(res.status).toBe(401);
  });

  it("400 on an invalid enum value", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await PUT(req({ primary_goal: "get_rich_quick" }));
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts valid answers and stamps completion", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await PUT(req({ primary_goal: "income_now", risk_appetite: "cautious", action: "complete" }));
    expect(res.status).toBe(200);
    const row = upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.user_id).toBe("u1");
    expect(row.primary_goal).toBe("income_now");
    expect(row.wizard_completed_at).toBeTypeOf("string");
  });

  it("GET returns the row", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    maybeSingle.mockResolvedValue({ data: { primary_goal: "income_now" } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ primary_goal: "income_now" });
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `npx vitest run app/api/preferences/__tests__/route.test.ts`
Expected: FAIL — route missing.

- [ ] **Step 3: Implement**

```ts
// app/api/preferences/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PRIMARY_GOALS, HORIZONS, RISK_APPETITES, REINVEST_DEFAULTS,
} from "@/lib/scoring/preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENUMS: Record<string, readonly string[]> = {
  primary_goal: PRIMARY_GOALS,
  investing_horizon: HORIZONS,
  risk_appetite: RISK_APPETITES,
  reinvest_default: REINVEST_DEFAULTS,
};

function parse(body: unknown): { ok: true; row: Record<string, unknown> } | { ok: false } {
  if (typeof body !== "object" || body === null) return { ok: false };
  const b = body as Record<string, unknown>;
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(ENUMS)) {
    if (b[key] === undefined || b[key] === null) continue;
    if (typeof b[key] !== "string" || !ENUMS[key].includes(b[key] as string)) return { ok: false };
    row[key] = b[key];
  }
  if (b.sectors_to_avoid !== undefined && b.sectors_to_avoid !== null) {
    if (!Array.isArray(b.sectors_to_avoid) || b.sectors_to_avoid.some((x) => typeof x !== "string")) return { ok: false };
    row.sectors_to_avoid = b.sectors_to_avoid;
  }
  if (b.annual_income_target_gbp !== undefined && b.annual_income_target_gbp !== null) {
    const n = Number(b.annual_income_target_gbp);
    if (!Number.isFinite(n) || n < 0) return { ok: false };
    row.annual_income_target_gbp = n;
  }
  return { ok: true, row };
}

async function userId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const uid = await userId(supabase);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await supabase
    .from("user_preferences")
    .select("primary_goal, investing_horizon, risk_appetite, reinvest_default, sectors_to_avoid, annual_income_target_gbp, wizard_completed_at, wizard_skipped_at")
    .eq("user_id", uid)
    .maybeSingle();
  return NextResponse.json(data ?? null);
}

export async function PUT(req: Request) {
  const supabase = await createSupabaseServerClient();
  const uid = await userId(supabase);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_input" }, { status: 400 }); }
  const parsed = parse(body);
  if (!parsed.ok) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const action = (body as Record<string, unknown>).action;
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { user_id: uid, ...parsed.row, updated_at: now };
  if (action === "complete") row.wizard_completed_at = now;
  if (action === "skip") row.wizard_skipped_at = now;

  const { error } = await supabase.from("user_preferences").upsert(row, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run it (green)**

Run: `npx vitest run app/api/preferences/__tests__/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/preferences/
git commit -F - <<'EOF'
feat(prefs): /api/preferences GET + PUT (validated, RLS-scoped)

Validates every field against the user_preferences CHECK constraints;
stamps wizard_completed_at / wizard_skipped_at on action. 401 on no
session; upsert on conflict user_id.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task B6: Wire prefs into the analytics loader

**Files:**
- Modify: `lib/scoring/load-portfolio-analytics.ts`

Three wirings: (a) load the user's prefs once; (b) thread `sectors_to_avoid` into `buildReinvestCard` (currently `[]` at line ~181); (c) pass an action-hint `sensitivity` into the score build; (d) when `lens` is requested, replace `scoresByTicker`'s buy values with re-aggregated ones.

- [ ] **Step 1: Add a `lens` arg + prefs load.** Extend the function signature with `lens?: boolean` and load prefs:

```ts
// near the top of loadPortfolioAnalytics, after `const supabase = ...`
import { loadUserPreferences } from "@/lib/scoring/preferences";
import { actionHintSensitivity } from "@/lib/scoring/chip-display";
import { categoryWeightsFor, reaggregateBuyScore } from "@/lib/scoring/reaggregate";
import { loadBuySignals } from "@/lib/scoring/load-buy-signals";
// ...
const prefs = await loadUserPreferences(userId);
const sensitivity = actionHintSensitivity(prefs);
```

- [ ] **Step 2: Thread sensitivity into `buildHoldingScore`/`actionHint`.** `buildHoldingScore` currently calls `actionHint(...)` internally (portfolio-scores.ts:80). Add an optional `sensitivity` param to `buildHoldingScore` and pass it to `actionHint`; pass `sensitivity` from the loader. (Modify `buildHoldingScore` signature; default 0 keeps existing call sites green.)

```ts
// portfolio-scores.ts buildHoldingScore: add `sensitivity = 0` to the input
// object and use it: actionHint({ buy, trim, risk }, sensitivity)
```

In the loader's `buildHoldingScore({ ... })` call add `sensitivity`.

- [ ] **Step 3: Thread sectors_to_avoid into the reinvest card.** Replace `sectorsToAvoid: []` (line ~181) with:

```ts
sectorsToAvoid: prefs?.sectors_to_avoid ?? [],
```

- [ ] **Step 4: Lens re-aggregation.** After `scoresByTicker` is built, if `lens` and prefs exist, overwrite each buy with the re-aggregated value:

```ts
if (lens && prefs) {
  const weights = categoryWeightsFor(prefs);
  const signalsByTicker = await loadBuySignals(tickers);
  for (const t of Object.keys(scoresByTicker)) {
    const sig = signalsByTicker[t];
    if (sig) scoresByTicker[t] = { ...scoresByTicker[t], buy: reaggregateBuyScore(sig, weights) };
  }
}
```

- [ ] **Step 5: Tests.** Add a loader-level test only if cheap; otherwise rely on B1/B2/B3 unit coverage + the page test in B8. Run the existing suite to confirm no regression:

Run: `npx vitest run lib/scoring/__tests__/ lib/reinvest/__tests__/`
Expected: PASS (existing tests unaffected by the default-param changes).

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit` → clean.
```bash
git add lib/scoring/load-portfolio-analytics.ts lib/scoring/portfolio-scores.ts
git commit -F - <<'EOF'
feat(scoring): wire wizard prefs into analytics (posture + lens)

Loader loads user_preferences once: threads sectors_to_avoid into the
Reinvest filter, passes an action-hint sensitivity into buildHoldingScore,
and (only when lens is requested) overwrites buy scores with the
re-aggregated lens values. Objective scores unchanged by default.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task B7: Personalisation wizard component

**Files:**
- Create: `app/app/portfolio/_components/personalisation-wizard.tsx`
- Test: `app/app/portfolio/_components/__tests__/personalisation-wizard.test.tsx`

Pattern: clone the `@base-ui/react/dialog` structure from `add-holding-modal.tsx` (Backdrop/Popup/Title/Description/Close + controlled `open`/`onOpenChange`). 6 single-select question groups + one multi-select (sectors) + one number (income). Submit → `PUT /api/preferences` with `action:"complete"`; Skip → `action:"skip"`; both `router.refresh()` then close.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PersonalisationWizard } from "../personalisation-wizard";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("<PersonalisationWizard>", () => {
  beforeEach(() => { refresh.mockReset(); vi.restoreAllMocks(); });

  it("renders the first question when open", () => {
    render(<PersonalisationWizard open onOpenChange={() => {}} initial={null} />);
    expect(screen.getByText(/what matters most/i)).toBeTruthy();
  });

  it("submitting calls PUT /api/preferences with action complete", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const onOpenChange = vi.fn();
    render(<PersonalisationWizard open onOpenChange={onOpenChange} initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: /income/i }));
    // advance through remaining steps via "Skip rest" then submit
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, opts] = fetchMock.mock.calls[0];
    expect((opts as RequestInit).method).toBe("PUT");
    expect(JSON.parse((opts as RequestInit).body as string).action).toBe("complete");
  });

  it("skip calls the API with action skip", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    render(<PersonalisationWizard open onOpenChange={vi.fn()} initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).action).toBe("skip");
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `npx vitest run app/app/portfolio/_components/__tests__/personalisation-wizard.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement.** Build the component to satisfy the tests and the spec's 6 questions. Use the `add-holding-modal.tsx` dialog shell verbatim for Backdrop/Popup classes. Structure:

```tsx
"use client";
import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { UserPreferences } from "@/lib/scoring/preferences";

type Answers = {
  primary_goal?: string; investing_horizon?: string; risk_appetite?: string;
  reinvest_default?: string; sectors_to_avoid?: string[]; annual_income_target_gbp?: number;
};

const Q = {
  primary_goal: { label: "What matters most to you right now?", options: [
    ["income_now", "Income now"], ["total_return", "Total return"],
    ["safety_stability", "Safety and stability"], ["undecided", "Not sure yet"]] },
  investing_horizon: { label: "How long until you need this money?", options: [
    ["lt_5y", "Under 5 years"], ["5_10y", "5 to 10 years"], ["10y_plus", "10 years or more"],
    ["already_retired", "Already retired"], ["undecided", "Not sure"]] },
  risk_appetite: { label: "How do you feel about swings in value?", options: [
    ["cautious", "Cautious"], ["balanced", "Balanced"], ["aggressive", "Comfortable with risk"],
    ["undecided", "Not sure"]] },
  reinvest_default: { label: "What do you usually do with dividends?", options: [
    ["always_drip", "Always reinvest"], ["look_for_opportunities", "Look for opportunities"],
    ["withdraw_cash", "Take the cash"], ["undecided", "It varies"]] },
} as const;

const SECTORS = ["Energy", "Financials", "Healthcare", "Technology", "Consumer", "Utilities", "Industrials", "Real estate"];

export function PersonalisationWizard({
  open, onOpenChange, initial,
}: { open: boolean; onOpenChange: (o: boolean) => void; initial: UserPreferences | null }) {
  const router = useRouter();
  const [a, setA] = useState<Answers>(() => ({
    primary_goal: initial?.primary_goal ?? undefined,
    investing_horizon: initial?.investing_horizon ?? undefined,
    risk_appetite: initial?.risk_appetite ?? undefined,
    reinvest_default: initial?.reinvest_default ?? undefined,
    sectors_to_avoid: initial?.sectors_to_avoid ?? [],
    annual_income_target_gbp: initial?.annual_income_target_gbp ?? undefined,
  }));
  const [busy, setBusy] = useState(false);

  const send = async (action: "complete" | "skip") => {
    setBusy(true);
    try {
      await fetch("/api/preferences", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...a, action }),
      });
      onOpenChange(false);
      router.refresh();
    } finally { setBusy(false); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl">
          <Dialog.Title className="font-display text-xl font-semibold text-foreground">
            Personalise your view
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            A few quick questions tune your Reinvest suggestions and when we flag a holding. Not financial advice.
          </Dialog.Description>

          <div className="mt-6 space-y-6">
            {(Object.keys(Q) as (keyof typeof Q)[]).map((key) => (
              <fieldset key={key}>
                <legend className="text-sm font-medium text-foreground">{Q[key].label}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Q[key].options.map(([val, lbl]) => (
                    <button key={val} type="button"
                      aria-pressed={a[key] === val}
                      onClick={() => setA((p) => ({ ...p, [key]: val }))}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${a[key] === val ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/20" : "border-border text-foreground hover:bg-secondary"}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}

            <fieldset>
              <legend className="text-sm font-medium text-foreground">Any sectors you would rather avoid?</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {SECTORS.map((s) => {
                  const on = a.sectors_to_avoid?.includes(s);
                  return (
                    <button key={s} type="button" aria-pressed={!!on}
                      onClick={() => setA((p) => ({ ...p, sectors_to_avoid: on ? p.sectors_to_avoid!.filter((x) => x !== s) : [...(p.sectors_to_avoid ?? []), s] }))}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${on ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/20" : "border-border text-foreground hover:bg-secondary"}`}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="income-target" className="text-sm font-medium text-foreground">
                Annual income target (optional)
              </label>
              <div className="relative mt-2 w-40">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                <input id="income-target" type="number" min="0" inputMode="decimal"
                  value={a.annual_income_target_gbp ?? ""}
                  onChange={(e) => setA((p) => ({ ...p, annual_income_target_gbp: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  className="block w-full rounded-lg border border-input bg-background py-2 pl-7 pr-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button type="button" disabled={busy} onClick={() => send("skip")}
              className="text-sm font-medium text-muted-foreground hover:underline">
              Skip for now
            </button>
            <button type="button" disabled={busy} onClick={() => send("complete")}
              className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-70">
              {busy ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Run it (green)**

Run: `npx vitest run app/app/portfolio/_components/__tests__/personalisation-wizard.test.tsx`
Expected: PASS (3 tests). Adjust the test's button-name regexes if your labels differ; keep them in sync.

- [ ] **Step 5: Humaniser + commit**

Run: `node scripts/lint/humaniser.js --strict app/app/portfolio/_components/personalisation-wizard.tsx` → resolve all 24 patterns; show the audit at the checkpoint.
```bash
git add app/app/portfolio/_components/personalisation-wizard.tsx app/app/portfolio/_components/__tests__/personalisation-wizard.test.tsx
git commit -F - <<'EOF'
feat(wizard): PersonalisationWizard modal (6 questions, skip/save)

base-ui dialog; PUTs /api/preferences with action complete|skip then
refreshes. Posture capture; not financial advice.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task B8: Lens toggle island + Manager page wiring

**Files:**
- Create: `app/app/portfolio/_components/score-lens-toggle.tsx`
- Modify: `app/app/portfolio/scoring/page.tsx`

The page reads `searchParams.lens`. The toggle is a small client island that navigates between `?lens=1` and the base URL. A first-visit `<PersonalisationWizard>` auto-opens when the user has no `wizard_completed_at`/`wizard_skipped_at`.

- [ ] **Step 1: Create the toggle island**

```tsx
// app/app/portfolio/_components/score-lens-toggle.tsx
"use client";
import { useRouter } from "next/navigation";

export function ScoreLensToggle({ on }: { on: boolean }) {
  const router = useRouter();
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => router.replace(e.target.checked ? "/app/portfolio/scoring?lens=1" : "/app/portfolio/scoring")}
        className="h-4 w-4 rounded border-input"
      />
      View Quality through my goals
    </label>
  );
}
```

- [ ] **Step 2: Create a tiny client wrapper to auto-open the wizard on first visit**

```tsx
// app/app/portfolio/_components/first-visit-wizard.tsx
"use client";
import { useState } from "react";
import { PersonalisationWizard } from "./personalisation-wizard";
import type { UserPreferences } from "@/lib/scoring/preferences";

export function FirstVisitWizard({ initial, autoOpen }: { initial: UserPreferences | null; autoOpen: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  return <PersonalisationWizard open={open} onOpenChange={setOpen} initial={initial} />;
}
```

- [ ] **Step 3: Wire the Manager page.** Modify `app/app/portfolio/scoring/page.tsx`:
  - Make `searchParams` a prop and await it (Next 16 async searchParams).
  - Load prefs for the first-visit decision.
  - Pass `lens` into `loadPortfolioAnalytics`.
  - Render `<ScoreLensToggle>` (only when prefs exist) above the table, and `<FirstVisitWizard>`.

```tsx
import { loadUserPreferences } from "@/lib/scoring/preferences";
import { ScoreLensToggle } from "../_components/score-lens-toggle";
import { FirstVisitWizard } from "../_components/first-visit-wizard";

export default async function PortfolioManagerPage(props: { searchParams: Promise<{ lens?: string }> }) {
  const user = await requireUser("/app/portfolio/scoring");
  const priced = await loadPricedHoldings(user.id);
  if (priced.tier === "free") redirect("/app/portfolio");

  const sp = await props.searchParams;
  const lens = sp.lens === "1";
  const prefs = await loadUserPreferences(user.id);
  const hasAnsweredWizard = !!(prefs?.wizard_completed_at || prefs?.wizard_skipped_at);
  // ... existing pricingPublic + analytics, but pass `lens`:
  const analytics = visibleRows.length > 0
    ? await loadPortfolioAnalytics({ userId: user.id, allHoldings, visibleRows, quotes, quotesByTicker, lens })
    : null;
```

  In the JSX, above `<HoldingsTable>`:

```tsx
{prefs && (
  <div className="flex justify-end">
    <ScoreLensToggle on={lens} />
  </div>
)}
```

  And once, near the page root (inside the outer `<div>`):

```tsx
<FirstVisitWizard initial={prefs} autoOpen={!hasAnsweredWizard} />
```

- [ ] **Step 4: Verify the page still type-checks and the existing manager flow renders**

Run: `npx tsc --noEmit` → clean.
Run: `npx vitest run app/app/portfolio/` → existing component tests PASS.

- [ ] **Step 5: Humaniser + commit**

Run humaniser on the two new client files + the page.
```bash
git add app/app/portfolio/_components/score-lens-toggle.tsx app/app/portfolio/_components/first-visit-wizard.tsx app/app/portfolio/scoring/page.tsx
git commit -F - <<'EOF'
feat(wizard): first-visit modal + opt-in score lens on Manager page

ScoreLensToggle navigates ?lens=1 (server re-renders re-aggregated buy
scores); FirstVisitWizard auto-opens for users who have not completed or
skipped the wizard. Lens defaults off; objective scores stay primary.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task B9: Account "Personalise" entry (all tiers)

**Files:**
- Modify: `app/app/account/page.tsx`

Free users reach the wizard here (capture-only). Add a button that opens the same `<PersonalisationWizard>` via a small client island (`AccountWizardEntry`) — load `loadUserPreferences(user.id)` server-side and pass it in.

- [ ] **Step 1: Create the entry island**

```tsx
// app/app/account/_components/account-wizard-entry.tsx
"use client";
import { useState } from "react";
import { PersonalisationWizard } from "@/app/app/portfolio/_components/personalisation-wizard";
import type { UserPreferences } from "@/lib/scoring/preferences";

export function AccountWizardEntry({ initial }: { initial: UserPreferences | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-secondary">
        {initial?.wizard_completed_at ? "Update your preferences" : "Personalise your view"}
      </button>
      <PersonalisationWizard open={open} onOpenChange={setOpen} initial={initial} />
    </>
  );
}
```

- [ ] **Step 2: Render it in the account page** — read prefs server-side and drop a "Preferences" section with `<AccountWizardEntry initial={prefs} />`. Match the existing account-page section markup.

- [ ] **Step 3: Typecheck + humaniser + commit**

Run: `npx tsc --noEmit` → clean.
```bash
git add app/app/account/
git commit -F - <<'EOF'
feat(wizard): Account preferences entry (revisit, all tiers)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
```

---

## END OF DAY 8 CHECKPOINT (pause for Glenn)

- [ ] Full suite: `npx vitest run` → all green (target ~440+ tests).
- [ ] `npx tsc --noEmit` → clean.
- [ ] `npm run build` → succeeds (3 pre-existing lint errors are non-fatal; add no new ones).
- [ ] Humaniser `--strict` audit shown for every new user-facing string (wizard, lens label, audit page, account entry).
- [ ] Deploy proposal: FF `worktree-day8-audit-wizard` onto `main` then `git push origin main`; verify via Vercel MCP (READY + dividendmapper.com aliased). Confirm the prod deploy with Glenn first.
- [ ] Smoke (unauth): `/app/portfolio/scoring` 307, `/app/admin/scoring/audit` 307, `/api/preferences` 401. Authenticated Pro smoke is Glenn's.
- Do NOT start the public pages below until Glenn signs off Day 8.

---

# Public `/scoring` pages — READY PLAN (next session, do not build in Day 8)

**Goal:** Indexable public per-ticker scoring pages: numeric Quality/Risk/Trim + plain-English summary + resilience framing anonymously; per-signal breakdown + history gated to Pro. ISR `revalidate: 3600`. Rate-limit mechanism decided at build (lean in-memory/edge; no Upstash).

**Decisions locked:** numbers+summary public / breakdown+history Pro-gated; ISR 3600; rate-limit deferred to build day; reuse `GET /api/scoring/[ticker]`; run `nextjs-seo-aeo-audit`.

### PT1: Public summary builder (pure)
- Create `lib/scoring/public-summary.ts` — `publicSummary(scores) -> { headline: string; bands: {...} }` turning Quality/Risk/Trim into one compliance-safe plain-English line (never "buy/sell"). TDD the copy mapping (e.g. high Quality + low Risk -> "Durable dividend profile, low cut risk"). Humaniser the strings.

### PT2: `/scoring/[ticker]` page (ISR)
- Create `app/(public)/scoring/[ticker]/page.tsx` — `export const revalidate = 3600`; `generateMetadata` (title/description/canonical `https://dividendmapper.com/scoring/<ticker>`); JSON-LD describing the page WITHOUT a recommendation; "Not financial advice" prominent. Anonymous: numbers + `publicSummary`. Pro+ (fetch tier from `profiles`): reuse `ScoreDrawer` breakdown + history. 404 if no `equity_scores` row.
- Reuse the existing public `GET /api/scoring/[ticker]` for data; do not duplicate the query.

### PT3: `/scoring` index + search
- Create `app/(public)/scoring/page.tsx` — indexable intro + a ticker search that links to `/scoring/[ticker]` (reuse `<TickerSearch>`). Static + ISR.

### PT4: Rate limiting
- Decide mechanism at build (in-memory/edge counter v1; document the multi-instance caveat). Apply to the anonymous data path only. No Upstash.

### PT5: Sitemap + SEO/AEO audit
- Add `/scoring` + scored `/scoring/[ticker]` to `app/sitemap.ts`. Run the `nextjs-seo-aeo-audit` skill on the new routes; fix findings. Run humaniser on every public string (SEO surface, compliance-sensitive).

---

## Self-Review (completed)

- **Spec coverage:** 8A audit (A1-A2 ✓ all 5 panels), wizard schema reuse (B4 ✓), `/api/preferences` (B5 ✓), posture layer — sectors filter (B6 ✓), action-hint sensitivity (B1, B6 ✓), reinvest copy (covered by passing prefs to the card; copy tweaks live in the card during B6), full capture (B5 ✓), optional lens (B2, B3, B6, B8 ✓ off by default), placement first-visit + account (B8, B9 ✓), public pages planned (PT1-PT5 ✓), compliance/humaniser (every UI task ✓). No gaps.
- **Type consistency:** `StoredSignal` (B2) consumed by B3/B6; `UserPreferences` (B4) consumed by B5/B7/B8/B9; `categoryWeightsFor`/`reaggregateBuyScore` (B2) consumed by B6; `actionHintSensitivity` (B1) consumed by B6. Names align.
- **Placeholders:** none in 8A/8B (complete code per step). The public section is intentionally a forward plan (next session), not Day-8 build steps.
