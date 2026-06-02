# Day 9 Threshold Alert Emails — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Pro users opt in to a once-daily consolidated email when one of their holdings' Quality score falls below a floor or Risk score rises into an elevated band, with a managed-preferences page and one-click unsubscribe.

**Architecture:** A pure, heavily-tested decision module (`lib/alerts/build-digest.ts`) detects threshold *crossings* between the two most-recent `equity_score_history` rows. A new 07:00 UTC cron loads enabled prefs ∩ Pro users ∩ holdings, runs the decision module, and sends one idempotent digest per user via the existing Resend stack. A `/app/account/notifications` page (Pro-gated) and a `GET/PUT /api/notifications` route manage prefs. Unsubscribe is an HMAC signed-token route needing no login. Engine is FROZEN — everything here is read-only over already-persisted scores.

**Tech Stack:** Next.js 16.2 (App Router, route handlers), React 19, TypeScript, Supabase (service-role client in cron, RLS server client in routes), React Email + Resend, vitest. Node `crypto` for HMAC.

**Spec:** `planning/plans/2026-06-02-day9-threshold-alerts-design.md`

**Working dir:** all paths below are relative to `dividendmapper/` inside the worktree. Run commands from `dividendmapper/`.

**Conventions to honour:**
- Read `node_modules/next/dist/docs/` before writing Next-specific code (params/searchParams async; no `Date.now()` in server components' render path).
- No em dashes anywhere; resilience framing only; never "Buy/Sell/Recommend". "Not financial advice" in every email + the prefs page.
- Defaults: Risk threshold **75**, Quality threshold **30**.
- Quality event_type in the DB = `buy_threshold_crossed`; Risk = `risk_threshold_crossed`.
- Commit after each task. Tests live in co-located `__tests__/` folders. Run a single file with `npx vitest run <path>`.

---

## Task 1: Pure decision module — `lib/alerts/build-digest.ts`

The risky core. Pure function, no I/O. Detects crossings; applies the no-prior-observation and degraded_uk guards; Quality is numeric→numeric only.

**Files:**
- Create: `lib/alerts/build-digest.ts`
- Test: `lib/alerts/__tests__/build-digest.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/alerts/__tests__/build-digest.test.ts
import { describe, it, expect } from "vitest";
import { buildDigest, type AlertPrefs, type HoldingObservation } from "../build-digest";

const prefs: AlertPrefs = {
  riskEnabled: true,
  riskThreshold: 75,
  qualityEnabled: true,
  qualityThreshold: 30,
};

function obs(over: Partial<HoldingObservation>): HoldingObservation {
  return {
    ticker: "TST",
    prevRisk: 50,
    currRisk: 50,
    prevQuality: 60,
    currQuality: 60,
    dataQuality: "full",
    ...over,
  };
}

describe("buildDigest", () => {
  it("fires a Risk crossing when risk rises through the threshold", () => {
    const d = buildDigest(prefs, [obs({ prevRisk: 70, currRisk: 80 })]);
    expect(d).not.toBeNull();
    expect(d!.riskCrossings).toEqual([{ ticker: "TST", from: 70, to: 80 }]);
    expect(d!.qualityCrossings).toEqual([]);
  });

  it("fires a Quality crossing when quality falls through the threshold", () => {
    const d = buildDigest(prefs, [obs({ prevQuality: 40, currQuality: 20 })]);
    expect(d!.qualityCrossings).toEqual([{ ticker: "TST", from: 40, to: 20 }]);
    expect(d!.riskCrossings).toEqual([]);
  });

  it("does NOT fire when risk was already above the threshold yesterday", () => {
    const d = buildDigest(prefs, [obs({ prevRisk: 80, currRisk: 85 })]);
    expect(d).toBeNull();
  });

  it("does NOT fire when there is no prior observation (first-run guard)", () => {
    const d = buildDigest(prefs, [obs({ prevRisk: null, currRisk: 90 })]);
    expect(d).toBeNull();
  });

  it("suppresses ALL crossings on a degraded_uk holding", () => {
    const d = buildDigest(prefs, [
      obs({ dataQuality: "degraded_uk", prevRisk: 70, currRisk: 80, prevQuality: 40, currQuality: 10 }),
    ]);
    expect(d).toBeNull();
  });

  it("does NOT treat a Quality numeric->null (gate-fail) transition as a crossing", () => {
    const d = buildDigest(prefs, [obs({ prevQuality: 40, currQuality: null })]);
    expect(d).toBeNull();
  });

  it("respects disabled prefs", () => {
    const off: AlertPrefs = { ...prefs, riskEnabled: false, qualityEnabled: false };
    const d = buildDigest(off, [obs({ prevRisk: 70, currRisk: 80, prevQuality: 40, currQuality: 10 })]);
    expect(d).toBeNull();
  });

  it("returns null when nothing fires", () => {
    expect(buildDigest(prefs, [obs({})])).toBeNull();
  });

  it("collects crossings across multiple holdings", () => {
    const d = buildDigest(prefs, [
      obs({ ticker: "AAA", prevRisk: 70, currRisk: 80 }),
      obs({ ticker: "BBB", prevQuality: 35, currQuality: 25 }),
    ]);
    expect(d!.riskCrossings).toEqual([{ ticker: "AAA", from: 70, to: 80 }]);
    expect(d!.qualityCrossings).toEqual([{ ticker: "BBB", from: 35, to: 25 }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/alerts/__tests__/build-digest.test.ts`
Expected: FAIL — `Cannot find module '../build-digest'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/alerts/build-digest.ts
// Pure alert-decision logic for the daily score digest. No I/O. Given a user's
// prefs and each holding's two most-recent score observations, returns the
// threshold CROSSINGS to alert on, or null if nothing fired.
//
// Crossing, not "currently beyond": we only fire on the transition through the
// threshold, so a holding that sits above it for weeks alerts once, not daily.
// - Risk:    prevRisk < T && currRisk >= T   (rose into the elevated band)
// - Quality: prevQuality >= T && currQuality < T  (fell below the floor)
// Quality is numeric->numeric only: a score that vanishes because the holding
// newly fails a quality gate is NOT alerted in v1 (that path is entangled with
// the frozen GATE_4 missing-UK-fundamentals bug).

export interface AlertPrefs {
  riskEnabled: boolean;
  riskThreshold: number;
  qualityEnabled: boolean;
  qualityThreshold: number;
}

export interface HoldingObservation {
  ticker: string;
  prevRisk: number | null;
  currRisk: number | null;
  prevQuality: number | null;
  currQuality: number | null;
  dataQuality: "full" | "degraded_uk" | "sparse";
}

export interface DigestTrigger {
  ticker: string;
  from: number;
  to: number;
}

export interface Digest {
  riskCrossings: DigestTrigger[];
  qualityCrossings: DigestTrigger[];
}

export function buildDigest(prefs: AlertPrefs, holdings: HoldingObservation[]): Digest | null {
  const riskCrossings: DigestTrigger[] = [];
  const qualityCrossings: DigestTrigger[] = [];

  for (const h of holdings) {
    // A degraded-UK data gap can flip a gate or move a score artificially; never
    // alert on it. Reinvest (ex-div-driven) would be exempt, but it is deferred.
    if (h.dataQuality === "degraded_uk") continue;

    if (
      prefs.riskEnabled &&
      h.prevRisk !== null &&
      h.currRisk !== null &&
      h.prevRisk < prefs.riskThreshold &&
      h.currRisk >= prefs.riskThreshold
    ) {
      riskCrossings.push({ ticker: h.ticker, from: h.prevRisk, to: h.currRisk });
    }

    if (
      prefs.qualityEnabled &&
      h.prevQuality !== null &&
      h.currQuality !== null &&
      h.prevQuality >= prefs.qualityThreshold &&
      h.currQuality < prefs.qualityThreshold
    ) {
      qualityCrossings.push({ ticker: h.ticker, from: h.prevQuality, to: h.currQuality });
    }
  }

  if (riskCrossings.length === 0 && qualityCrossings.length === 0) return null;
  return { riskCrossings, qualityCrossings };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/alerts/__tests__/build-digest.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/alerts/build-digest.ts lib/alerts/__tests__/build-digest.test.ts
git commit -m "feat(alerts): pure threshold-crossing digest decision module"
```

---

## Task 2: HMAC unsubscribe token — `lib/alerts/unsub-token.ts`

Pure signer/verifier. The secret is injected (the route passes `process.env.CRON_SECRET`) so the module stays pure and testable.

**Files:**
- Create: `lib/alerts/unsub-token.ts`
- Test: `lib/alerts/__tests__/unsub-token.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/alerts/__tests__/unsub-token.test.ts
import { describe, it, expect } from "vitest";
import { signUnsubToken, verifyUnsubToken } from "../unsub-token";

const SECRET = "test-secret-value";

describe("unsub token", () => {
  it("round-trips a user id", () => {
    const token = signUnsubToken("user-123", SECRET);
    expect(verifyUnsubToken(token, SECRET)).toBe("user-123");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signUnsubToken("user-123", SECRET);
    expect(verifyUnsubToken(token, "other-secret")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signUnsubToken("user-123", SECRET);
    const [, mac] = token.split(".");
    const forged = `${Buffer.from("user-999").toString("base64url")}.${mac}`;
    expect(verifyUnsubToken(forged, SECRET)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifyUnsubToken("garbage", SECRET)).toBeNull();
    expect(verifyUnsubToken("", SECRET)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/alerts/__tests__/unsub-token.test.ts`
Expected: FAIL — `Cannot find module '../unsub-token'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/alerts/unsub-token.ts
// One-click unsubscribe token: `${base64url(userId)}.${hmac}`. HMAC-SHA256 over
// the raw user id with a server-only secret (the cron secret is reused). The
// token only lets the bearer disable their own alerts, so a stable secret is
// acceptable. Pure: the secret is passed in.
import { createHmac, timingSafeEqual } from "crypto";

export function signUnsubToken(userId: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(userId).digest("base64url");
  return `${Buffer.from(userId).toString("base64url")}.${mac}`;
}

export function verifyUnsubToken(token: string, secret: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  let userId: string;
  try {
    userId = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!userId) return null;

  const expected = createHmac("sha256", secret).update(userId).digest("base64url");
  const given = Buffer.from(parts[1]);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  return userId;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/alerts/__tests__/unsub-token.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/alerts/unsub-token.ts lib/alerts/__tests__/unsub-token.test.ts
git commit -m "feat(alerts): HMAC one-click unsubscribe token"
```

---

## Task 3: Prefs API — `GET/PUT /api/notifications`

RLS-scoped (uses the user's server client; `notification_preferences_self` policy enforces ownership). GET returns the two pref rows shaped as `{ quality, risk }`. PUT upserts both rows. Modeled on `app/api/preferences/route.ts`.

**Files:**
- Create: `app/api/notifications/route.ts`
- Test: `app/api/notifications/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/notifications/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const upsert = vi.fn();
const getClaims = vi.fn();
const selectRows = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims },
    from: () => ({
      upsert: (...a: unknown[]) => {
        upsert(...a);
        return { error: null };
      },
      select: () => ({ eq: () => selectRows() }),
    }),
  }),
}));

import { GET, PUT } from "../route";

function req(body: unknown) {
  return new Request("http://x/api/notifications", { method: "PUT", body: JSON.stringify(body) });
}

describe("/api/notifications", () => {
  beforeEach(() => {
    upsert.mockReset();
    getClaims.mockReset();
    selectRows.mockReset();
  });

  it("401 when no session", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    expect((await PUT(req({}))).status).toBe(401);
  });

  it("400 on an out-of-range threshold", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await PUT(req({ risk: { enabled: true, threshold: 150 } }));
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts a Risk pref row keyed by event_type", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await PUT(req({ risk: { enabled: true, threshold: 80 } }));
    expect(res.status).toBe(200);
    const rows = upsert.mock.calls[0][0] as Record<string, unknown>[];
    const risk = rows.find((r) => r.event_type === "risk_threshold_crossed")!;
    expect(risk.user_id).toBe("u1");
    expect(risk.enabled).toBe(true);
    expect(risk.threshold_value).toBe(80);
  });

  it("GET shapes rows into { quality, risk }", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    selectRows.mockResolvedValue({
      data: [
        { event_type: "buy_threshold_crossed", enabled: true, threshold_value: 30 },
        { event_type: "risk_threshold_crossed", enabled: false, threshold_value: 75 },
      ],
    });
    const res = await GET();
    expect(await res.json()).toEqual({
      quality: { enabled: true, threshold: 30 },
      risk: { enabled: false, threshold: 75 },
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/api/notifications/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Write the implementation**

```ts
// app/api/notifications/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// v1 alert types and their DB event_type. Reinvest is deferred.
const EVENT_BY_KEY = {
  quality: "buy_threshold_crossed",
  risk: "risk_threshold_crossed",
} as const;
type PrefKey = keyof typeof EVENT_BY_KEY;

const DEFAULT_THRESHOLD: Record<PrefKey, number> = { quality: 30, risk: 75 };

interface PrefInput {
  enabled: boolean;
  threshold: number;
}

function parsePref(value: unknown): PrefInput | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object") return "invalid";
  const v = value as Record<string, unknown>;
  if (typeof v.enabled !== "boolean") return "invalid";
  const n = Number(v.threshold);
  if (!Number.isInteger(n) || n < 0 || n > 100) return "invalid";
  return { enabled: v.enabled, threshold: n };
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
    .from("notification_preferences")
    .select("event_type, enabled, threshold_value")
    .eq("user_id", uid);

  const rows = (data ?? []) as { event_type: string; enabled: boolean; threshold_value: number | null }[];
  const out: Record<PrefKey, PrefInput> = {
    quality: { enabled: false, threshold: DEFAULT_THRESHOLD.quality },
    risk: { enabled: false, threshold: DEFAULT_THRESHOLD.risk },
  };
  for (const key of Object.keys(EVENT_BY_KEY) as PrefKey[]) {
    const row = rows.find((r) => r.event_type === EVENT_BY_KEY[key]);
    if (row) {
      out[key] = {
        enabled: row.enabled,
        threshold: row.threshold_value ?? DEFAULT_THRESHOLD[key],
      };
    }
  }
  return NextResponse.json(out);
}

export async function PUT(req: Request) {
  const supabase = await createSupabaseServerClient();
  const uid = await userId(supabase);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  for (const key of Object.keys(EVENT_BY_KEY) as PrefKey[]) {
    const parsed = parsePref(b[key]);
    if (parsed === "invalid") return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    if (parsed === null) continue;
    rows.push({
      user_id: uid,
      event_type: EVENT_BY_KEY[key],
      enabled: parsed.enabled,
      threshold_value: parsed.threshold,
      updated_at: now,
    });
  }
  if (rows.length === 0) return NextResponse.json({ ok: true });

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(rows, { onConflict: "user_id,event_type" });
  if (error) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/api/notifications/__tests__/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/notifications/route.ts app/api/notifications/__tests__/route.test.ts
git commit -m "feat(alerts): GET/PUT /api/notifications prefs route"
```

---

## Task 4: Email template — `emails/score-alert.tsx`

One React Email digest template, sections rendered only when crossings exist. Resilience framing; "Not financial advice"; manage + unsubscribe links. Matches `emails/welcome-paid.tsx` markup.

**Files:**
- Create: `emails/score-alert.tsx`
- Test: `emails/__tests__/score-alert.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// emails/__tests__/score-alert.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { ScoreAlertEmail } from "../score-alert";

describe("ScoreAlertEmail", () => {
  it("renders Quality and Risk sections, the disclaimer, and both links", async () => {
    const html = await render(
      <ScoreAlertEmail
        qualityCrossings={[{ ticker: "VOD.L", from: 35, to: 22 }]}
        riskCrossings={[{ ticker: "MSFT", from: 70, to: 81 }]}
        manageUrl="https://dividendmapper.com/app/account/notifications"
        unsubscribeUrl="https://dividendmapper.com/api/notifications/unsubscribe?token=abc"
      />,
    );
    expect(html).toContain("VOD.L");
    expect(html).toContain("MSFT");
    expect(html).toContain("Not financial advice");
    expect(html).toContain("https://dividendmapper.com/app/account/notifications");
    expect(html).toContain("token=abc");
    // Never advice language.
    expect(html).not.toMatch(/\bbuy\b|\bsell\b|recommend/i);
  });

  it("omits a section that has no crossings", async () => {
    const html = await render(
      <ScoreAlertEmail
        qualityCrossings={[]}
        riskCrossings={[{ ticker: "MSFT", from: 70, to: 81 }]}
        manageUrl="https://x/manage"
        unsubscribeUrl="https://x/unsub"
      />,
    );
    expect(html).toContain("MSFT");
    expect(html).not.toContain("Quality");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run emails/__tests__/score-alert.test.tsx`
Expected: FAIL — `Cannot find module '../score-alert'`.

- [ ] **Step 3: Write the implementation**

Draft copy carefully (no em dashes, no AI filler). Final copy is humaniser-gated in Task 9.

```tsx
// emails/score-alert.tsx
import { Text, Link } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Daily resilience digest. Scores are a resilience check, never advice. Sent by
// /api/internal/send-score-alerts; idempotent via send_key=`${userId}:digest:${date}`.

export interface AlertRow {
  ticker: string;
  from: number;
  to: number;
}

interface ScoreAlertProps {
  qualityCrossings: AlertRow[];
  riskCrossings: AlertRow[];
  manageUrl: string;
  unsubscribeUrl: string;
}

function Line({ children }: { children: React.ReactNode }) {
  return <Text style={{ ...EMAIL_STYLES.text, margin: "0 0 8px 0" }}>{children}</Text>;
}

export function ScoreAlertEmail({
  qualityCrossings = [],
  riskCrossings = [],
  manageUrl = "https://dividendmapper.com/app/account/notifications",
  unsubscribeUrl = "https://dividendmapper.com/api/notifications/unsubscribe?token=",
}: Partial<ScoreAlertProps> = {}) {
  return (
    <EmailLayout preview="A resilience update on your holdings.">
      <Text style={EMAIL_STYLES.heading}>Your holdings update</Text>
      <Text style={EMAIL_STYLES.text}>
        A resilience score on one or more of your holdings moved past a level you
        set. This is a prompt to look, not advice.
      </Text>

      {qualityCrossings.length > 0 && (
        <>
          <Text style={{ ...EMAIL_STYLES.text, fontWeight: 700, margin: "24px 0 8px 0" }}>
            Resilience fell below your floor
          </Text>
          {qualityCrossings.map((c) => (
            <Line key={`q-${c.ticker}`}>
              {c.ticker}: now {c.to}, was {c.from}.
            </Line>
          ))}
        </>
      )}

      {riskCrossings.length > 0 && (
        <>
          <Text style={{ ...EMAIL_STYLES.text, fontWeight: 700, margin: "24px 0 8px 0" }}>
            Risk indicator rose into the elevated band
          </Text>
          {riskCrossings.map((c) => (
            <Line key={`r-${c.ticker}`}>
              {c.ticker}: now {c.to}, was {c.from}.
            </Line>
          ))}
        </>
      )}

      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0 8px 0" }}>
        <Link href={manageUrl} style={{ color: "#0d9488", fontWeight: 600 }}>
          See the full breakdown and manage these alerts
        </Link>
      </Text>

      <Text style={EMAIL_STYLES.textMuted}>
        These scores measure how well a holding has held up, not whether to trade
        it. Not financial advice.
      </Text>
      <Text style={EMAIL_STYLES.textMuted}>
        <Link href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          Turn off all alert emails
        </Link>
      </Text>
    </EmailLayout>
  );
}

export default ScoreAlertEmail;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run emails/__tests__/score-alert.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add emails/score-alert.tsx emails/__tests__/score-alert.test.tsx
git commit -m "feat(alerts): score-alert digest email template"
```

---

## Task 5: Unsubscribe route — `GET/POST /api/notifications/unsubscribe`

Verifies the HMAC token (no login), sets all of the user's `notification_preferences.enabled = false` via the service-role client (RLS would otherwise block an unauthenticated caller), and returns a small HTML confirmation. POST supports RFC 8058 one-click.

**Files:**
- Create: `app/api/notifications/unsubscribe/route.ts`
- Test: `app/api/notifications/unsubscribe/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/notifications/unsubscribe/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { signUnsubToken } from "@/lib/alerts/unsub-token";

const update = vi.fn().mockReturnValue({ eq: () => ({ error: null }) });
const fromMock = vi.fn(() => ({ update }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: fromMock })),
}));

const ORIGINAL = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  process.env = {
    ...ORIGINAL,
    CRON_SECRET: "s3cr3t",
    SUPABASE_SERVICE_ROLE_KEY: "svc",
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  };
});

import { GET } from "../route";

function req(token: string) {
  return new Request(`http://x/api/notifications/unsubscribe?token=${encodeURIComponent(token)}`);
}

describe("GET /api/notifications/unsubscribe", () => {
  it("400 on a bad token", async () => {
    const res = await GET(req("garbage"));
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("disables all prefs for a valid token", async () => {
    const token = signUnsubToken("user-7", "s3cr3t");
    const res = await GET(req(token));
    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("notification_preferences");
    expect(update).toHaveBeenCalledWith({ enabled: false });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/api/notifications/unsubscribe/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Write the implementation**

```ts
// app/api/notifications/unsubscribe/route.ts
import { createClient } from "@supabase/supabase-js";
import { verifyUnsubToken } from "@/lib/alerts/unsub-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(message: string): Response {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alert emails</title><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:64px auto;padding:0 24px;color:#111827"><h1 style="font-size:20px;color:#0d9488">DividendMapper</h1><p style="font-size:16px;line-height:24px">${message}</p><p style="font-size:14px;color:#6b7280">You can re-enable alerts any time from your account settings.</p></body>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !key) {
    return new Response("Server not configured.", { status: 500 });
  }

  const token = new URL(req.url).searchParams.get("token") ?? "";
  const userId = verifyUnsubToken(token, secret);
  if (!userId) {
    return new Response("This unsubscribe link is invalid or has expired.", { status: 400 });
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await supabase.from("notification_preferences").update({ enabled: false }).eq("user_id", userId);

  return page("Done. You will no longer receive alert emails about your holdings.");
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/api/notifications/unsubscribe/__tests__/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/notifications/unsubscribe/route.ts app/api/notifications/unsubscribe/__tests__/route.test.ts
git commit -m "feat(alerts): one-click unsubscribe route (HMAC token, service client)"
```

---

## Task 6: Send cron — `/api/internal/send-score-alerts` + `vercel.json`

Bearer-guarded service-role route. Loads enabled prefs ∩ Pro users ∩ holdings, reads each ticker's last two `equity_score_history` rows + current `equity_scores.data_quality`, runs `buildDigest`, sends one idempotent digest per user, updates `last_sent_at`. Adds the 07:00 cron.

**Files:**
- Create: `app/api/internal/send-score-alerts/route.ts`
- Modify: `vercel.json`
- Test: `app/api/internal/send-score-alerts/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/internal/send-score-alerts/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendIdempotent = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendIdempotent: (...a: unknown[]) => sendIdempotent(...a) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

// One Pro user (u1) holding MSFT, whose risk crossed 75 -> 81 between the two
// most-recent history rows. data_quality 'full'.
function makeSupabase() {
  // route calls .update(...).eq("user_id", uid).in("event_type", [...])
  const update = vi.fn().mockReturnValue({ eq: () => ({ in: () => ({ error: null }) }) });
  const from = vi.fn((table: string) => {
    if (table === "notification_preferences") {
      return {
        select: () => ({
          eq: () => ({
            or: () =>
              Promise.resolve({
                data: [
                  { user_id: "u1", event_type: "risk_threshold_crossed", enabled: true, threshold_value: 75 },
                  { user_id: "u1", event_type: "buy_threshold_crossed", enabled: true, threshold_value: 30 },
                ],
                error: null,
              }),
          }),
        }),
        update,
      };
    }
    if (table === "profiles") {
      return { select: () => ({ in: () => Promise.resolve({ data: [{ id: "u1", tier: "pro", email: "a@b.com" }], error: null }) }) };
    }
    if (table === "holdings") {
      return { select: () => ({ eq: () => Promise.resolve({ data: [{ ticker: "MSFT" }], error: null }) }) };
    }
    if (table === "equity_scores") {
      return { select: () => ({ in: () => Promise.resolve({ data: [{ ticker: "MSFT", data_quality: "full" }], error: null }) }) };
    }
    if (table === "equity_score_history") {
      return {
        select: () => ({
          in: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  { ticker: "MSFT", observed_at: "2026-06-02", risk_score: 81, buy_score: 60 },
                  { ticker: "MSFT", observed_at: "2026-06-01", risk_score: 70, buy_score: 60 },
                ],
                error: null,
              }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { from, update };
}

let supa: ReturnType<typeof makeSupabase>;
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => supa) }));

const ORIGINAL = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  supa = makeSupabase();
  sendIdempotent.mockResolvedValue({ ok: true, emailId: "e1" });
  process.env = {
    ...ORIGINAL,
    CRON_SECRET: "s3cr3t",
    SUPABASE_SERVICE_ROLE_KEY: "svc",
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SITE_URL: "https://dividendmapper.com",
  };
});

import { GET } from "../route";

function req(auth?: string) {
  return new Request("http://x/api/internal/send-score-alerts", {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("send-score-alerts cron", () => {
  it("401 without the cron bearer", async () => {
    expect((await GET(req())).status).toBe(401);
    expect(sendIdempotent).not.toHaveBeenCalled();
  });

  it("sends one digest with a per-user-per-day send key", async () => {
    const res = await GET(req("Bearer s3cr3t"));
    expect(res.status).toBe(200);
    expect(sendIdempotent).toHaveBeenCalledTimes(1);
    const opts = sendIdempotent.mock.calls[0][0] as { sendKey: string; to: string };
    expect(opts.to).toBe("a@b.com");
    expect(opts.sendKey).toMatch(/^u1:digest:\d{4}-\d{2}-\d{2}$/);
  });

  it("does not throw when sendIdempotent reports already_sent", async () => {
    sendIdempotent.mockResolvedValue({ ok: false, reason: "already_sent" });
    expect((await GET(req("Bearer s3cr3t"))).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/api/internal/send-score-alerts/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Write the implementation**

```ts
// app/api/internal/send-score-alerts/route.ts
// Daily 07:00 UTC digest cron. Read-only over persisted scores (engine frozen).
// For each Pro user with an enabled alert pref, compare each holding's two most
// recent equity_score_history rows, run buildDigest, and send ONE idempotent
// digest. Auth: Authorization: Bearer ${CRON_SECRET}.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { buildDigest, type HoldingObservation } from "@/lib/alerts/build-digest";
import { signUnsubToken } from "@/lib/alerts/unsub-token";
import { sendIdempotent } from "@/lib/email/send";
import { ScoreAlertEmail } from "@/emails/score-alert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_RISK = 75;
const DEFAULT_QUALITY = 30;

interface PrefRow {
  user_id: string;
  event_type: string;
  enabled: boolean;
  threshold_value: number | null;
}
interface HistRow {
  ticker: string;
  observed_at: string;
  risk_score: number | null;
  buy_score: number | null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
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

  const nowIso = new Date().toISOString();

  // 1. Enabled prefs for our two v1 event types, not currently paused.
  const { data: prefData, error: prefErr } = await supabase
    .from("notification_preferences")
    .select("user_id, event_type, enabled, threshold_value")
    .eq("enabled", true)
    .or(`paused_until.is.null,paused_until.lt.${nowIso}`);
  if (prefErr) {
    Sentry.captureException(prefErr);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const prefs = ((prefData ?? []) as PrefRow[]).filter(
    (p) => p.event_type === "risk_threshold_crossed" || p.event_type === "buy_threshold_crossed",
  );
  if (prefs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // 2. Restrict to Pro users (tier != free) and grab their email.
  const userIds = Array.from(new Set(prefs.map((p) => p.user_id)));
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, tier, email")
    .in("id", userIds);
  const proById = new Map<string, { email: string }>();
  for (const p of (profileData ?? []) as { id: string; tier: string; email: string | null }[]) {
    if (p.tier && p.tier !== "free" && p.email) proById.set(p.id, { email: p.email });
  }

  let sent = 0;
  for (const uid of userIds) {
    const profile = proById.get(uid);
    if (!profile) continue;

    const userPrefs = prefs.filter((p) => p.user_id === uid);
    const riskPref = userPrefs.find((p) => p.event_type === "risk_threshold_crossed");
    const qualityPref = userPrefs.find((p) => p.event_type === "buy_threshold_crossed");

    try {
      // 3. This user's distinct holding tickers.
      const { data: holdingRows } = await supabase.from("holdings").select("ticker").eq("user_id", uid);
      const tickers = Array.from(new Set(((holdingRows ?? []) as { ticker: string }[]).map((r) => r.ticker)));
      if (tickers.length === 0) continue;

      // 4. data_quality (current) + last two history rows per ticker.
      const { data: scoreRows } = await supabase
        .from("equity_scores")
        .select("ticker, data_quality")
        .in("ticker", tickers);
      const dqByTicker = new Map<string, HoldingObservation["dataQuality"]>();
      for (const r of (scoreRows ?? []) as { ticker: string; data_quality: HoldingObservation["dataQuality"] }[]) {
        dqByTicker.set(r.ticker, r.data_quality);
      }

      const { data: histData } = await supabase
        .from("equity_score_history")
        .select("ticker, observed_at, risk_score, buy_score")
        .in("ticker", tickers)
        .order("observed_at", { ascending: false });
      const histByTicker = new Map<string, HistRow[]>();
      for (const h of (histData ?? []) as HistRow[]) {
        const list = histByTicker.get(h.ticker) ?? [];
        if (list.length < 2) list.push(h); // already desc; first two are curr, prev
        histByTicker.set(h.ticker, list);
      }

      const observations: HoldingObservation[] = tickers.map((ticker) => {
        const rows = histByTicker.get(ticker) ?? [];
        const curr = rows[0] ?? null;
        const prev = rows[1] ?? null;
        return {
          ticker,
          currRisk: curr?.risk_score ?? null,
          prevRisk: prev?.risk_score ?? null,
          currQuality: curr?.buy_score ?? null,
          prevQuality: prev?.buy_score ?? null,
          dataQuality: dqByTicker.get(ticker) ?? "full",
        };
      });

      const digest = buildDigest(
        {
          riskEnabled: !!riskPref?.enabled,
          riskThreshold: riskPref?.threshold_value ?? DEFAULT_RISK,
          qualityEnabled: !!qualityPref?.enabled,
          qualityThreshold: qualityPref?.threshold_value ?? DEFAULT_QUALITY,
        },
        observations,
      );
      if (!digest) continue;

      const unsubscribeUrl = `${site}/api/notifications/unsubscribe?token=${signUnsubToken(uid, secret)}`;
      const manageUrl = `${site}/app/account/notifications`;

      const result = await sendIdempotent({
        to: profile.email,
        subject: "A resilience update on your holdings",
        template: "score-alert",
        sendKey: `${uid}:digest:${today()}`,
        userId: uid,
        body: ScoreAlertEmail({
          qualityCrossings: digest.qualityCrossings,
          riskCrossings: digest.riskCrossings,
          manageUrl,
          unsubscribeUrl,
        }),
        supabase,
      });

      if (result.ok) {
        sent++;
        await supabase
          .from("notification_preferences")
          .update({ last_sent_at: nowIso })
          .eq("user_id", uid)
          .in("event_type", ["risk_threshold_crossed", "buy_threshold_crossed"]);
      }
    } catch (err) {
      Sentry.captureException(err, { extra: { uid } });
    }
  }

  return NextResponse.json({ ok: true, sent });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
```

> **Note on the test mock vs. the route:** the supabase mock must mirror the exact call chains the route uses (`.select().eq().or()` for prefs; `.update().eq().in()` for `last_sent_at`; `.select().in().order()` for history). If a chain-shape mismatch fails a test, fix the mock to mirror the route — do not change the route to suit the mock.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/api/internal/send-score-alerts/__tests__/route.test.ts`
Expected: PASS (3 tests). If a mock-chain mismatch appears, align the mock to the route's actual call chain (`.update(...).eq("user_id", uid).in("event_type", [...])`).

- [ ] **Step 5: Add the cron to `vercel.json`**

Replace the file with:

```json
{
  "crons": [
    {
      "path": "/api/internal/refresh-equity-scores",
      "schedule": "30 22 * * *"
    },
    {
      "path": "/api/internal/send-score-alerts",
      "schedule": "0 7 * * *"
    }
  ]
}
```

- [ ] **Step 6: Confirm the Vercel plan allows a second cron**

Vercel Hobby allows only daily crons and a small count; Pro allows more. This project is on a paid plan (Stripe, Sentry in use). Before deploy, confirm via the Vercel dashboard or MCP that a second cron is permitted. Note this as a deploy-gate checklist item; no code change.

- [ ] **Step 7: Commit**

```bash
git add app/api/internal/send-score-alerts/route.ts app/api/internal/send-score-alerts/__tests__/route.test.ts vercel.json
git commit -m "feat(alerts): 07:00 send-score-alerts cron + vercel cron entry"
```

---

## Task 7: Prefs page — `/app/account/notifications`

Server component: `requireUser`, read `profiles.tier`, fetch current prefs from `/api/notifications` server-side (or query directly), render a client form. Pro sees live toggles + threshold inputs; Free sees them disabled + an upgrade CTA to `/pricing`.

**Files:**
- Create: `app/app/account/notifications/page.tsx`
- Create: `app/app/account/notifications/_components/notification-prefs-form.tsx`
- Test: `app/app/account/notifications/_components/__tests__/notification-prefs-form.test.tsx`

- [ ] **Step 1: Write the failing test (client form)**

```tsx
// app/app/account/notifications/_components/__tests__/notification-prefs-form.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NotificationPrefsForm } from "../notification-prefs-form";

const initial = {
  quality: { enabled: false, threshold: 30 },
  risk: { enabled: true, threshold: 75 },
};

afterEach(() => cleanup());
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
});

describe("NotificationPrefsForm", () => {
  it("disables controls and shows an upgrade CTA for Free users", () => {
    render(<NotificationPrefsForm initial={initial} isPro={false} />);
    expect(screen.getByRole("link", { name: /upgrade/i })).toBeTruthy();
    expect((screen.getByLabelText(/risk alerts/i) as HTMLInputElement).disabled).toBe(true);
  });

  it("Pro users can toggle and save, PUTting to /api/notifications", async () => {
    render(<NotificationPrefsForm initial={initial} isPro />);
    fireEvent.click(screen.getByLabelText(/quality alerts/i));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(fetch).toHaveBeenCalledWith(
      "/api/notifications",
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/app/account/notifications/_components/__tests__/notification-prefs-form.test.tsx`
Expected: FAIL — cannot find `../notification-prefs-form`.

- [ ] **Step 3: Write the client form**

```tsx
// app/app/account/notifications/_components/notification-prefs-form.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export interface PrefState {
  enabled: boolean;
  threshold: number;
}
export interface PrefsShape {
  quality: PrefState;
  risk: PrefState;
}

export function NotificationPrefsForm({
  initial,
  isPro,
}: {
  initial: PrefsShape;
  isPro: boolean;
}) {
  const [prefs, setPrefs] = useState<PrefsShape>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function set(key: keyof PrefsShape, patch: Partial<PrefState>) {
    setPrefs((p) => ({ ...p, [key]: { ...p[key], ...patch } }));
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(prefs),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  const row = (
    key: keyof PrefsShape,
    label: string,
    help: string,
  ) => (
    <div className="flex items-start justify-between gap-4 border-b border-border py-4 last:border-0">
      <div>
        <label htmlFor={`${key}-enabled`} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <p className="mt-1 text-sm text-muted-foreground">{help}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Threshold</span>
          <input
            type="number"
            min={0}
            max={100}
            aria-label={`${label} threshold`}
            disabled={!isPro || !prefs[key].enabled}
            value={prefs[key].threshold}
            onChange={(e) => set(key, { threshold: Number(e.target.value) })}
            className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm disabled:opacity-50"
          />
        </div>
      </div>
      <input
        id={`${key}-enabled`}
        type="checkbox"
        aria-label={label}
        disabled={!isPro}
        checked={prefs[key].enabled}
        onChange={(e) => set(key, { enabled: e.target.checked })}
        className="mt-1 h-5 w-5 disabled:opacity-50"
      />
    </div>
  );

  return (
    <div>
      {!isPro && (
        <div className="mb-4 rounded-lg border border-border bg-secondary/50 p-4 text-sm">
          <p className="text-foreground">Alert emails are a Pro feature.</p>
          <Link
            href="/pricing"
            className="mt-2 inline-block font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
          >
            Upgrade to turn these on
          </Link>
        </div>
      )}

      {row("quality", "Quality alerts", "Email me when a holding's Quality score falls below this level.")}
      {row("risk", "Risk alerts", "Email me when a holding's Risk score rises to this level or above.")}

      <p className="mt-4 text-xs text-muted-foreground">
        At most one summary email per day. These scores are a resilience check, not financial advice.
      </p>

      {isPro && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={status === "saving"}
            className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {status === "saving" ? "Saving" : "Save"}
          </button>
          {status === "saved" && <span className="text-sm text-muted-foreground">Saved.</span>}
          {status === "error" && <span className="text-sm text-red-600">Could not save. Try again.</span>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/app/account/notifications/_components/__tests__/notification-prefs-form.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the page (server component)**

```tsx
// app/app/account/notifications/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  NotificationPrefsForm,
  type PrefsShape,
} from "./_components/notification-prefs-form";

export const metadata: Metadata = {
  title: "Alert emails",
  robots: { index: false, follow: false },
};

const DEFAULTS: PrefsShape = {
  quality: { enabled: false, threshold: 30 },
  risk: { enabled: false, threshold: 75 },
};

export default async function NotificationsPage() {
  const user = await requireUser("/app/account/notifications");
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
  const isPro = (profile?.tier ?? "free") !== "free";

  const { data: rows } = await supabase
    .from("notification_preferences")
    .select("event_type, enabled, threshold_value")
    .eq("user_id", user.id);

  const prefs: PrefsShape = {
    quality: { ...DEFAULTS.quality },
    risk: { ...DEFAULTS.risk },
  };
  for (const r of (rows ?? []) as { event_type: string; enabled: boolean; threshold_value: number | null }[]) {
    if (r.event_type === "buy_threshold_crossed") {
      prefs.quality = { enabled: r.enabled, threshold: r.threshold_value ?? DEFAULTS.quality.threshold };
    }
    if (r.event_type === "risk_threshold_crossed") {
      prefs.risk = { enabled: r.enabled, threshold: r.threshold_value ?? DEFAULTS.risk.threshold };
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/app/account" className="text-sm text-brand-700 hover:underline dark:text-brand-300">
        Back to account
      </Link>
      <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">Alert emails</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Get one summary email when a holding&apos;s resilience scores move past a level you set.
        Opt in below. Not financial advice.
      </p>
      <div className="mt-6 rounded-xl border border-border bg-card p-5 md:p-6">
        <NotificationPrefsForm initial={prefs} isPro={isPro} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck the new page**

Run: `npx tsc --noEmit`
Expected: clean (0 errors).

- [ ] **Step 7: Commit**

```bash
git add app/app/account/notifications
git commit -m "feat(alerts): /app/account/notifications prefs page + form"
```

---

## Task 8: Account entry link to the prefs page

Add a link to the alerts page from the existing account page, next to the "Your preferences" section.

**Files:**
- Modify: `app/app/account/page.tsx` (after the `</section>` that closes "Your preferences", around line 278)

- [ ] **Step 1: Add the link block**

Insert immediately after the "Your preferences" `</section>` (line ~278):

```tsx
      <section className="mt-6 rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="font-display text-lg font-semibold text-foreground">Alert emails</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Choose when we email you about a holding&apos;s Quality or Risk score. Pro feature.
        </p>
        <Link
          href="/app/account/notifications"
          className="mt-3 inline-block text-sm font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
        >
          Manage alert emails
        </Link>
      </section>
```

- [ ] **Step 2: Verify `Link` is imported**

`app/app/account/page.tsx` already imports `Link` from `next/link` (used elsewhere). If not, add `import Link from "next/link";`. Confirm by grepping: `grep -n "next/link" app/app/account/page.tsx`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/app/account/page.tsx
git commit -m "feat(alerts): link to alert-email prefs from the account page"
```

---

## Task 9: Humaniser pass on all alert + UI copy

Mandatory copy gate (memory: humaniser pass is mandatory; show the audit before presenting). Run the linter on every file containing user-facing strings, fix any flags, and re-run.

**Files reviewed (copy sources):**
- `emails/score-alert.tsx`
- `app/app/account/notifications/page.tsx`
- `app/app/account/notifications/_components/notification-prefs-form.tsx`
- `app/app/account/page.tsx` (the new section)
- `app/api/notifications/unsubscribe/route.ts` (the HTML page strings)

- [ ] **Step 1: Run the humaniser linter on each file**

```bash
node /c/Users/grodg/dividend_mapper_plan/scripts/lint/humaniser.js --strict emails/score-alert.tsx
node /c/Users/grodg/dividend_mapper_plan/scripts/lint/humaniser.js --strict app/app/account/notifications/page.tsx
node /c/Users/grodg/dividend_mapper_plan/scripts/lint/humaniser.js --strict app/app/account/notifications/_components/notification-prefs-form.tsx
node /c/Users/grodg/dividend_mapper_plan/scripts/lint/humaniser.js --strict app/app/account/page.tsx
```

Expected: no em dashes, no AI vocab, no filler, no copula avoidance. Fix any flag inline (rephrase, never an em dash).

- [ ] **Step 2: Read the humaniser SKILL and do the manual 24-pattern audit**

Read `dividendmapper/skills.md/humanizer/SKILL.md`. Manually check the email + page copy against all 24 patterns (the linter catches a subset). Produce the audit and keep it to show Glenn before presenting.

- [ ] **Step 3: Re-run tests after any copy change**

Run: `npx vitest run emails/__tests__/score-alert.test.tsx`
Expected: PASS (string assertions still hold; update them if copy changed).

- [ ] **Step 4: Commit any copy fixes**

```bash
git add -A
git commit -m "chore(alerts): humaniser pass on alert + prefs copy"
```

---

## Task 10: Pricing flip — alerts live

Move alerts out of "Coming soon" into the live Pro feature list, with copy that matches what shipped (Quality + Risk threshold alerts), and narrow the still-coming line to the deferred ex-div/reinvest alerts.

**Files:**
- Modify: `app/pricing/page.tsx` (PRO_FEATURES ~line 32, PRO_COMING_SOON ~line 40)

- [ ] **Step 1: Add the shipped alert line to `PRO_FEATURES`**

Append to the `PRO_FEATURES` array:

```ts
  "Email alerts when a holding's Quality or Risk score crosses your threshold",
```

- [ ] **Step 2: Rewrite the coming-soon alerts line in `PRO_COMING_SOON`**

Replace:

```ts
  "Smart alerts on dividend cuts, raises, and ex-div",
```

with:

```ts
  "Reinvest alerts when a holding goes ex-dividend",
```

- [ ] **Step 3: Run the humaniser on the changed file**

```bash
node /c/Users/grodg/dividend_mapper_plan/scripts/lint/humaniser.js --strict app/pricing/page.tsx
```
Expected: clean.

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` (clean), then:

```bash
git add app/pricing/page.tsx
git commit -m "feat(pricing): Quality/Risk alerts now live; narrow coming-soon to reinvest"
```

---

## Task 11: Full verification (pre-deploy checkpoint)

- [ ] **Step 1: Full unit suite**

Run: `npx vitest run`
Expected: all green. Target > 472 (baseline) + the new tests (~20 added): roughly 492+.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Lint (no NEW errors)**

Run: `npm run lint`
Expected: only the 3 pre-existing errors (`app/tools/*`, locale-toggle). Zero new.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: success. Confirm `ƒ /api/internal/send-score-alerts`, `ƒ /api/notifications`, `ƒ /api/notifications/unsubscribe`, `○ or ƒ /app/account/notifications` appear in the route table.

- [ ] **Step 5: Manual cron smoke (local, against prod data is NOT done here — do at deploy time)**

Document the smoke recipe for the deploy step (Task 12): trigger the route with the cron bearer against a test user who has an enabled pref and a holding whose two most-recent history rows cross a threshold; confirm exactly one email, idempotent on a second call, correct copy, working unsubscribe link; then tear down the test rows.

---

## Task 12: Deploy (CONFIRM WITH GLENN FIRST)

A push to `main` is a PRODUCTION deploy. Do not push without Glenn's explicit go.

- [ ] **Step 1: Confirm the Vercel plan allows the second cron** (Task 6 Step 6). If not, the cron entry must be removed and the send route triggered another way — raise with Glenn before deploying.

- [ ] **Step 2: Confirm migrations** — none expected (schema 0004 covers everything). Verify no new file under `supabase/migrations/`.

- [ ] **Step 3: FF `main` to the worktree branch and push** (clean fast-forward, not force), per the deploy model in the spec. Then verify via Vercel MCP: `get_deployment` shows READY + `dividendmapper.com` in `alias` (projectId `prj_BLaQ11IfxVGzFy3wRtRXV8pilf9J`, teamId `team_BzpvDy7iiVyx0Ufq2TEsOYQX`).

- [ ] **Step 4: Post-deploy smoke** — run the cron smoke recipe (Task 11 Step 5) against prod with a throwaway test user; confirm one email, idempotency, unsubscribe; tear down test rows. NEVER publish analyst/backtest commits.

---

## Self-review notes (filled by plan author)

- **Spec coverage:** decision module (Task 1), unsubscribe token (Task 2), prefs API (Task 3), email template (Task 4), unsubscribe route (Task 5), send cron + vercel.json (Task 6), prefs page + free CTA (Task 7), account entry (Task 8), humaniser gate (Task 9), pricing flip (Task 10), verification (Task 11), deploy (Task 12). All spec sections map to a task.
- **Quiet hours:** intentionally unused in v1 (decision D); the cron only filters `paused_until`. No quiet-hours code.
- **Reinvest:** deferred; not built. `reinvest_opportunity` stays parked.
- **Type consistency:** `HoldingObservation`, `AlertPrefs`, `Digest`, `AlertRow`, `PrefsShape`, `PrefState` are defined once and reused; `buildDigest(prefs, holdings)` signature is identical across Tasks 1 and 6; event_type strings `buy_threshold_crossed` / `risk_threshold_crossed` are consistent across Tasks 3, 6, 7.
- **Known risk:** the cron route test (Task 6) is mock-chain sensitive. The plan flags aligning the mock to the route's real call chain rather than bending the route. This is the one task likely to need a mock tweak during execution.
