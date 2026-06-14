# Weekly Resilience Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an opt-in, Pro-gated weekly email (Sunday 17:00 UTC) summarising each holding/watchlist ticker's 7-day resilience + risk + price-swing movement, in scannable tables, sending even on a quiet week.

**Architecture:** A new weekly cron route reuses the existing `sendIdempotent` / Pro-gate / `paused_until` / unsubscribe stack and the `watchedNotHeld` selector. Pure modules do the date math (`iso-week.ts`), baseline selection + mover filtering (`weekly-digest.ts`); a new email template renders two tables. The notifications UI/API gain a fourth toggle. All read-only over the frozen scoring engine — no migration (the `weekly_digest` enum value and `equity_score_history.current_price` already exist).

**Tech Stack:** Next.js 16 (App Router, route handlers), React Email (`@react-email/components`), Supabase (`@supabase/supabase-js` service-role client in the cron), Vitest, Resend.

**Spec:** `docs/superpowers/specs/2026-06-14-weekly-resilience-digest-design.md`

**Working directory:** all `npx vitest` / `npx eslint` / `npm run build` commands run from `dividendmapper/`. All `git` commands run from the repo root (`dividend_mapper_plan/`) with `dividendmapper/...` paths. Branch is already `feat/weekly-digest`.

---

### Task 1: ISO-week key helper (pure)

The weekly send key needs a stable `YYYY-Www` string so a retry within the same ISO week never double-sends. ISO 8601: the week belongs to the year of its Thursday.

**Files:**
- Create: `dividendmapper/lib/alerts/iso-week.ts`
- Test: `dividendmapper/lib/alerts/__tests__/iso-week.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// dividendmapper/lib/alerts/__tests__/iso-week.test.ts
import { describe, it, expect } from "vitest";
import { isoWeekKey } from "../iso-week";

describe("isoWeekKey", () => {
  it("formats as YYYY-Www with a zero-padded two-digit week", () => {
    expect(isoWeekKey(new Date("2021-01-04T00:00:00Z"))).toBe("2021-W01");
  });

  it("assigns the same key to every day Mon..Sun of one ISO week", () => {
    // 2021-01-04 is a Monday; 2021-01-10 the following Sunday.
    expect(isoWeekKey(new Date("2021-01-04T00:00:00Z"))).toBe("2021-W01");
    expect(isoWeekKey(new Date("2021-01-10T23:59:59Z"))).toBe("2021-W01");
  });

  it("rolls a year-boundary week into the year of its Thursday", () => {
    // 2020-12-31 is a Thursday -> belongs to 2020, week 53.
    expect(isoWeekKey(new Date("2020-12-31T00:00:00Z"))).toBe("2020-W53");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `dividendmapper/`): `npx vitest run lib/alerts/__tests__/iso-week.test.ts`
Expected: FAIL — `Failed to resolve import "../iso-week"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// dividendmapper/lib/alerts/iso-week.ts
// Pure ISO-8601 week key, e.g. "2026-W24". The week belongs to the year of its
// Thursday. UTC throughout so the value never shifts with server timezone.

export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // move to this week's Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `dividendmapper/`): `npx vitest run lib/alerts/__tests__/iso-week.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/lib/alerts/iso-week.ts dividendmapper/lib/alerts/__tests__/iso-week.test.ts
git commit -m "feat(weekly-digest): pure ISO-week key helper for the weekly send key"
```

---

### Task 2: Baseline selection + mover filtering (pure)

The core decision logic: pick current + ~7-day-ago snapshots, then decide which tickers "moved" (resilience Δ≠0 OR risk Δ≠0 OR |price swing %| ≥ 5), computing each metric's delta/direction. Mirrors `lib/alerts/build-digest.ts`.

**Files:**
- Create: `dividendmapper/lib/alerts/weekly-digest.ts`
- Test: `dividendmapper/lib/alerts/__tests__/weekly-digest.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// dividendmapper/lib/alerts/__tests__/weekly-digest.test.ts
import { describe, it, expect } from "vitest";
import {
  pickCurrentAndBaseline,
  selectWeeklyMovers,
  PRICE_SWING_THRESHOLD,
  type HistoryRow,
  type WeeklyObservation,
} from "../weekly-digest";

function row(over: Partial<HistoryRow>): HistoryRow {
  return { observed_at: "2026-06-14", buy_score: 50, risk_score: 50, current_price: 100, ...over };
}

function obs(over: Partial<WeeklyObservation>): WeeklyObservation {
  return {
    ticker: "TST",
    currResilience: 50, baseResilience: 50,
    currRisk: 50, baseRisk: 50,
    currPrice: 100, basePrice: 100,
    dataQuality: "full",
    ...over,
  };
}

describe("pickCurrentAndBaseline", () => {
  it("takes the latest row as current and the closest row on/before the cutoff as baseline", () => {
    const rowsDesc = [
      row({ observed_at: "2026-06-14", current_price: 110 }),
      row({ observed_at: "2026-06-09", current_price: 104 }),
      row({ observed_at: "2026-06-06", current_price: 100 }), // on/before cutoff 2026-06-07
      row({ observed_at: "2026-06-01", current_price: 95 }),
    ];
    const { current, baseline } = pickCurrentAndBaseline(rowsDesc, "2026-06-07");
    expect(current!.current_price).toBe(110);
    expect(baseline!.current_price).toBe(100);
  });

  it("returns a null baseline when no row is on/before the cutoff", () => {
    const rowsDesc = [row({ observed_at: "2026-06-14" })];
    const { current, baseline } = pickCurrentAndBaseline(rowsDesc, "2026-06-07");
    expect(current).not.toBeNull();
    expect(baseline).toBeNull();
  });

  it("returns nulls for an empty history", () => {
    expect(pickCurrentAndBaseline([], "2026-06-07")).toEqual({ current: null, baseline: null });
  });
});

describe("selectWeeklyMovers", () => {
  it("includes a ticker whose resilience changed and reports the delta + direction", () => {
    const movers = selectWeeklyMovers([obs({ currResilience: 55, baseResilience: 50 })]);
    expect(movers).toHaveLength(1);
    expect(movers[0].resilience).toEqual({ curr: 55, delta: 5, direction: "up" });
    expect(movers[0].risk).toEqual({ curr: 50, delta: 0, direction: "flat" });
  });

  it("includes a ticker whose price swing is at least the threshold, scores flat", () => {
    const movers = selectWeeklyMovers([obs({ currPrice: 94, basePrice: 100 })]);
    expect(movers).toHaveLength(1);
    expect(movers[0].price).toEqual({ swingPct: -6, direction: "down" });
    expect(movers[0].resilience).toEqual({ curr: 50, delta: 0, direction: "flat" });
  });

  it("excludes a ticker with flat scores and a sub-threshold price drift", () => {
    expect(selectWeeklyMovers([obs({ currPrice: 100.3, basePrice: 100 })])).toEqual([]);
  });

  it("excludes a ticker with no baseline (cannot compute any delta)", () => {
    const movers = selectWeeklyMovers([
      obs({ baseResilience: null, baseRisk: null, basePrice: null }),
    ]);
    expect(movers).toEqual([]);
  });

  it("never includes a degraded_uk ticker even if a metric moved", () => {
    const movers = selectWeeklyMovers([
      obs({ dataQuality: "degraded_uk", currRisk: 80, baseRisk: 50, currPrice: 80, basePrice: 100 }),
    ]);
    expect(movers).toEqual([]);
  });

  it("rounds the price swing to one decimal place", () => {
    const movers = selectWeeklyMovers([obs({ currPrice: 106.25, basePrice: 100 })]);
    expect(movers[0].price!.swingPct).toBe(6.3);
  });

  it("exposes the threshold constant as 5", () => {
    expect(PRICE_SWING_THRESHOLD).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `dividendmapper/`): `npx vitest run lib/alerts/__tests__/weekly-digest.test.ts`
Expected: FAIL — `Failed to resolve import "../weekly-digest"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// dividendmapper/lib/alerts/weekly-digest.ts
// Pure weekly-digest logic. No I/O.
//
// Two responsibilities:
//   1. pickCurrentAndBaseline — from a ticker's history (newest-first), choose the
//      current snapshot and the closest snapshot on/before a cutoff date (~7d ago).
//   2. selectWeeklyMovers — decide which tickers "moved" over the window and
//      compute each metric's delta/direction for the email.
//
// Inclusion rule: resilience delta != 0 OR risk delta != 0 OR |price swing %| >= 5.
// A degraded_uk data gap can move a score artificially; never report it (mirrors
// build-digest.ts). A ticker missing a baseline cannot have a delta and is skipped.

export const PRICE_SWING_THRESHOLD = 5; // percent

export interface HistoryRow {
  observed_at: string; // YYYY-MM-DD
  buy_score: number | null;
  risk_score: number | null;
  current_price: number | null;
}

export interface CurrentBaseline {
  current: HistoryRow | null;
  baseline: HistoryRow | null;
}

export interface WeeklyObservation {
  ticker: string;
  currResilience: number | null;
  baseResilience: number | null;
  currRisk: number | null;
  baseRisk: number | null;
  currPrice: number | null;
  basePrice: number | null;
  dataQuality: "full" | "degraded_uk" | "sparse";
}

export interface MetricMove {
  curr: number;
  delta: number;
  direction: "up" | "down" | "flat";
}

export interface PriceMove {
  swingPct: number; // signed, one decimal place
  direction: "up" | "down" | "flat";
}

export interface WeeklyMover {
  ticker: string;
  resilience: MetricMove | null;
  risk: MetricMove | null;
  price: PriceMove | null;
}

export function pickCurrentAndBaseline(rowsDesc: HistoryRow[], cutoff: string): CurrentBaseline {
  const current = rowsDesc[0] ?? null;
  const baseline = rowsDesc.find((r) => r.observed_at <= cutoff) ?? null;
  return { current, baseline };
}

function dir(delta: number): "up" | "down" | "flat" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

function scoreMove(curr: number | null, base: number | null): MetricMove | null {
  if (curr === null || base === null) return null;
  const delta = curr - base;
  return { curr, delta, direction: dir(delta) };
}

function priceMove(curr: number | null, base: number | null): PriceMove | null {
  if (curr === null || base === null || base === 0) return null;
  const swingPct = Math.round(((curr - base) / base) * 1000) / 10; // 1 dp
  return { swingPct, direction: dir(swingPct) };
}

export function selectWeeklyMovers(observations: WeeklyObservation[]): WeeklyMover[] {
  const movers: WeeklyMover[] = [];
  for (const o of observations) {
    if (o.dataQuality === "degraded_uk") continue;

    const resilience = scoreMove(o.currResilience, o.baseResilience);
    const risk = scoreMove(o.currRisk, o.baseRisk);
    const price = priceMove(o.currPrice, o.basePrice);

    const qualifies =
      (resilience !== null && resilience.delta !== 0) ||
      (risk !== null && risk.delta !== 0) ||
      (price !== null && Math.abs(price.swingPct) >= PRICE_SWING_THRESHOLD);

    if (qualifies) movers.push({ ticker: o.ticker, resilience, risk, price });
  }
  return movers;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `dividendmapper/`): `npx vitest run lib/alerts/__tests__/weekly-digest.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/lib/alerts/weekly-digest.ts dividendmapper/lib/alerts/__tests__/weekly-digest.test.ts
git commit -m "feat(weekly-digest): pure baseline selection + mover filtering"
```

---

### Task 3: Weekly digest email template

Two tables (holdings, watchlist) plus a quiet-week variant. Email-safe HTML `<table>`s with inline styles, reusing `EmailLayout` + `EMAIL_STYLES`.

**Files:**
- Create: `dividendmapper/emails/weekly-digest.tsx`
- Test: `dividendmapper/emails/__tests__/weekly-digest.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// dividendmapper/emails/__tests__/weekly-digest.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import { WeeklyDigestEmail } from "../weekly-digest";

describe("WeeklyDigestEmail", () => {
  it("renders holding and watchlist rows with deltas and a price swing", async () => {
    const html = await render(
      WeeklyDigestEmail({
        holdings: [{ ticker: "SHEL", resilience: { curr: 72, delta: 3 }, risk: { curr: 41, delta: -2 }, priceSwingPct: 1.8 }],
        watchlist: [{ ticker: "DGE", resilience: { curr: 61, delta: -4 }, risk: null, priceSwingPct: -2.1 }],
        manageUrl: "https://x/manage",
        unsubscribeUrl: "https://x/unsub",
      }),
    );
    expect(html).toContain("SHEL");
    expect(html).toContain("+3");
    expect(html).toContain("-2");
    expect(html).toContain("+1.8%");
    expect(html).toContain("DGE");
    expect(html).toContain("On your watchlist");
  });

  it("renders the quiet-week variant when there are no movers", async () => {
    const html = await render(
      WeeklyDigestEmail({ holdings: [], watchlist: [], manageUrl: "https://x/manage", unsubscribeUrl: "https://x/unsub" }),
    );
    expect(html.toLowerCase()).toContain("steady");
    expect(html).not.toContain("Your holdings");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `dividendmapper/`): `npx vitest run emails/__tests__/weekly-digest.test.tsx`
Expected: FAIL — `Failed to resolve import "../weekly-digest"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// dividendmapper/emails/weekly-digest.tsx
import { Text, Link } from "@react-email/components";
import { EmailLayout, EMAIL_STYLES } from "./_layout";

// Weekly resilience digest. Scores are a resilience check, never advice. Sent by
// /api/internal/send-weekly-digest; idempotent via send_key=`${userId}:weekly:${isoWeek}`.

export interface WeeklyRow {
  ticker: string;
  resilience: { curr: number; delta: number } | null;
  risk: { curr: number; delta: number } | null;
  priceSwingPct: number | null;
}

interface WeeklyDigestProps {
  holdings: WeeklyRow[];
  watchlist: WeeklyRow[];
  manageUrl: string;
  unsubscribeUrl: string;
}

const TH: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  color: "#6b7280",
  padding: "0 12px 6px 0",
  borderBottom: "1px solid #e5e7eb",
};
const TD: React.CSSProperties = {
  fontSize: 14,
  color: "#111827",
  padding: "8px 12px 8px 0",
  borderBottom: "1px solid #f3f4f6",
};

function scoreCell(m: { curr: number; delta: number } | null) {
  if (!m) return "—"; // em-less dash for "no data"
  const tag = m.delta > 0 ? `+${m.delta}` : m.delta < 0 ? `${m.delta}` : "=";
  return `${m.curr}  ${tag}`;
}

function swingCell(p: number | null) {
  if (p === null) return "—";
  if (p === 0) return "=";
  return p > 0 ? `+${p}%` : `${p}%`;
}

function Table({ heading, rows }: { heading: string; rows: WeeklyRow[] }) {
  return (
    <>
      <Text style={{ ...EMAIL_STYLES.text, fontWeight: 700, margin: "24px 0 8px 0" }}>{heading}</Text>
      <table cellPadding={0} cellSpacing={0} role="presentation" style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={TH}>Ticker</th>
            <th style={TH}>Resilience</th>
            <th style={TH}>Risk</th>
            <th style={TH}>Price swing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ticker}>
              <td style={{ ...TD, fontWeight: 600 }}>{r.ticker}</td>
              <td style={TD}>{scoreCell(r.resilience)}</td>
              <td style={TD}>{scoreCell(r.risk)}</td>
              <td style={TD}>{swingCell(r.priceSwingPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function WeeklyDigestEmail({
  holdings = [],
  watchlist = [],
  manageUrl = "https://dividendmapper.com/app/account/notifications",
  unsubscribeUrl = "https://dividendmapper.com/api/notifications/unsubscribe?token=",
}: Partial<WeeklyDigestProps> = {}) {
  const quiet = holdings.length === 0 && watchlist.length === 0;
  return (
    <EmailLayout preview="Your weekly resilience digest.">
      <Text style={EMAIL_STYLES.heading}>Your week in resilience</Text>
      {quiet ? (
        <Text style={EMAIL_STYLES.text}>
          All steady this week. Nothing on your holdings or watchlist moved enough to flag. This is a
          prompt to look, not advice.
        </Text>
      ) : (
        <>
          <Text style={EMAIL_STYLES.text}>
            Here is how the resilience scores and prices on your holdings and watchlist moved over the
            past week. This is a prompt to look, not advice.
          </Text>
          {holdings.length > 0 && <Table heading="Your holdings" rows={holdings} />}
          {watchlist.length > 0 && <Table heading="On your watchlist" rows={watchlist} />}
        </>
      )}

      <Text style={{ ...EMAIL_STYLES.text, margin: "24px 0 8px 0" }}>
        <Link href={manageUrl} style={{ color: "#0d9488", fontWeight: 600 }}>
          See the full breakdown and manage these alerts
        </Link>
      </Text>
      <Text style={EMAIL_STYLES.textMuted}>
        These scores measure how well a holding has held up, not whether to trade it. Not financial
        advice.
      </Text>
      <Text style={EMAIL_STYLES.textMuted}>
        <Link href={unsubscribeUrl} style={{ color: "#6b7280" }}>
          Turn off all alert emails
        </Link>
      </Text>
    </EmailLayout>
  );
}

export default WeeklyDigestEmail;
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `dividendmapper/`): `npx vitest run emails/__tests__/weekly-digest.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/emails/weekly-digest.tsx dividendmapper/emails/__tests__/weekly-digest.test.tsx
git commit -m "feat(weekly-digest): weekly digest email template with quiet-week variant"
```

---

### Task 4: Weekly digest cron route

The cron itself: load opted-in, not-paused `weekly_digest` prefs, restrict to Pro users, gather holdings + watched-not-held tickers, fetch current/baseline observations, select movers, render and idempotently send (one per ISO week), stamp `last_sent_at`. Mirrors `send-score-alerts/route.ts`.

**Files:**
- Create: `dividendmapper/app/api/internal/send-weekly-digest/route.ts`
- Test: `dividendmapper/app/api/internal/send-weekly-digest/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// dividendmapper/app/api/internal/send-weekly-digest/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendIdempotent = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendIdempotent: (...a: unknown[]) => sendIdempotent(...a) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
// Capture the props rather than render, so we can assert on the rows fed in.
vi.mock("@/emails/weekly-digest", () => ({ WeeklyDigestEmail: (props: unknown) => ({ props }) }));

const createClient = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: (...a: unknown[]) => createClient(...a) }));

// Pro user u1 holds SHEL: resilience 50->55 (a mover). Watches DGE (not held),
// price 100->90 (a >=5% swing). Two history rows each, newest first.
function makeSupabase() {
  const update = vi.fn().mockReturnValue({ eq: () => ({ in: () => ({ error: null }) }) });
  const from = vi.fn((table: string) => {
    if (table === "notification_preferences") {
      return {
        select: () => ({
          eq: () => ({
            or: () =>
              Promise.resolve({
                data: [{ user_id: "u1", event_type: "weekly_digest", enabled: true, threshold_value: null }],
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
      return { select: () => ({ eq: () => Promise.resolve({ data: [{ ticker: "SHEL" }], error: null }) }) };
    }
    if (table === "tracked_tickers") {
      return { select: () => ({ eq: () => Promise.resolve({ data: [{ ticker: "DGE" }], error: null }) }) };
    }
    if (table === "equity_scores") {
      return {
        select: () => ({
          in: () => Promise.resolve({ data: [{ ticker: "SHEL", data_quality: "full" }, { ticker: "DGE", data_quality: "full" }], error: null }),
        }),
      };
    }
    if (table === "equity_score_history") {
      return {
        select: () => ({
          in: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  { ticker: "SHEL", observed_at: "2026-06-14", buy_score: 55, risk_score: 41, current_price: 100 },
                  { ticker: "SHEL", observed_at: "2026-06-06", buy_score: 50, risk_score: 41, current_price: 100 },
                  { ticker: "DGE", observed_at: "2026-06-14", buy_score: 60, risk_score: 50, current_price: 90 },
                  { ticker: "DGE", observed_at: "2026-06-06", buy_score: 60, risk_score: 50, current_price: 100 },
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

function makeReq(auth = "Bearer test-secret") {
  return new Request("https://x/api/internal/send-weekly-digest", { headers: { authorization: auth } });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supa";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  process.env.NEXT_PUBLIC_SITE_URL = "https://dividendmapper.com";
  sendIdempotent.mockResolvedValue({ ok: true, emailId: "e1" });
});

describe("send-weekly-digest route", () => {
  it("rejects a missing/bad bearer token", async () => {
    createClient.mockReturnValue(makeSupabase());
    const { GET } = await import("../route");
    const res = await GET(makeReq("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("sends one weekly digest with a holdings mover and a watchlist mover", async () => {
    const sb = makeSupabase();
    createClient.mockReturnValue(sb);
    const { GET } = await import("../route");
    const res = await GET(makeReq());
    const json = await res.json();

    expect(json).toEqual({ ok: true, sent: 1 });
    expect(sendIdempotent).toHaveBeenCalledTimes(1);
    const call = sendIdempotent.mock.calls[0][0];
    expect(call.sendKey).toMatch(/^u1:weekly:\d{4}-W\d{2}$/);
    expect(call.template).toBe("weekly-digest");
    const props = call.body.props;
    expect(props.holdings).toEqual([{ ticker: "SHEL", resilience: { curr: 55, delta: 5 }, risk: { curr: 41, delta: 0 }, priceSwingPct: 0 }]);
    expect(props.watchlist).toEqual([{ ticker: "DGE", resilience: { curr: 60, delta: 0 }, risk: { curr: 50, delta: 0 }, priceSwingPct: -10 }]);
    expect(sb.update).toHaveBeenCalled();
  });

  it("does not send when already sent this week (idempotent)", async () => {
    createClient.mockReturnValue(makeSupabase());
    sendIdempotent.mockResolvedValue({ ok: false, reason: "already_sent" });
    const { GET } = await import("../route");
    const res = await GET(makeReq());
    expect(await res.json()).toEqual({ ok: true, sent: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `dividendmapper/`): `npx vitest run app/api/internal/send-weekly-digest/__tests__/route.test.ts`
Expected: FAIL — `Failed to resolve import "../route"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// dividendmapper/app/api/internal/send-weekly-digest/route.ts
// Weekly 17:00-UTC-Sunday digest cron. Read-only over persisted scores (engine
// frozen). For each Pro user opted into weekly_digest, compute 7-day movement
// across holdings + watched-not-held tickers and send ONE idempotent digest per
// ISO week. Sends a quiet-week note if they have positions but nothing moved;
// skips users with no holdings and no watchlist. Auth: Bearer ${CRON_SECRET}.
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import {
  pickCurrentAndBaseline,
  selectWeeklyMovers,
  type HistoryRow,
  type WeeklyObservation,
  type WeeklyMover,
} from "@/lib/alerts/weekly-digest";
import { watchedNotHeld } from "@/lib/alerts/watchlist-selection";
import { isoWeekKey } from "@/lib/alerts/iso-week";
import { signUnsubToken } from "@/lib/alerts/unsub-token";
import { sendIdempotent } from "@/lib/email/send";
import { WeeklyDigestEmail, type WeeklyRow } from "@/emails/weekly-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WEEKLY_EVENT = "weekly_digest";

interface PrefRow {
  user_id: string;
  event_type: string;
  enabled: boolean;
  threshold_value: number | null;
}

async function fetchWeeklyObservations(
  supabase: SupabaseClient,
  tickers: string[],
  cutoff: string,
): Promise<WeeklyObservation[]> {
  if (tickers.length === 0) return [];

  const { data: scoreRows } = await supabase
    .from("equity_scores")
    .select("ticker, data_quality")
    .in("ticker", tickers);
  const dqByTicker = new Map<string, WeeklyObservation["dataQuality"]>();
  for (const r of (scoreRows ?? []) as { ticker: string; data_quality: WeeklyObservation["dataQuality"] }[]) {
    dqByTicker.set(r.ticker, r.data_quality);
  }

  const { data: histData } = await supabase
    .from("equity_score_history")
    .select("ticker, observed_at, buy_score, risk_score, current_price")
    .in("ticker", tickers)
    .order("observed_at", { ascending: false });
  const histByTicker = new Map<string, HistoryRow[]>();
  for (const h of (histData ?? []) as (HistoryRow & { ticker: string })[]) {
    const list = histByTicker.get(h.ticker) ?? [];
    list.push({ observed_at: h.observed_at, buy_score: h.buy_score, risk_score: h.risk_score, current_price: h.current_price });
    histByTicker.set(h.ticker, list);
  }

  return tickers.map((ticker) => {
    const { current, baseline } = pickCurrentAndBaseline(histByTicker.get(ticker) ?? [], cutoff);
    return {
      ticker,
      currResilience: current?.buy_score ?? null,
      baseResilience: baseline?.buy_score ?? null,
      currRisk: current?.risk_score ?? null,
      baseRisk: baseline?.risk_score ?? null,
      currPrice: current?.current_price ?? null,
      basePrice: baseline?.current_price ?? null,
      dataQuality: dqByTicker.get(ticker) ?? "full",
    };
  });
}

function toRow(m: WeeklyMover): WeeklyRow {
  return {
    ticker: m.ticker,
    resilience: m.resilience ? { curr: m.resilience.curr, delta: m.resilience.delta } : null,
    risk: m.risk ? { curr: m.risk.curr, delta: m.risk.delta } : null,
    priceSwingPct: m.price ? m.price.swingPct : null,
  };
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

  const now = new Date();
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const weekKey = isoWeekKey(now);

  const { data: prefData, error: prefErr } = await supabase
    .from("notification_preferences")
    .select("user_id, event_type, enabled, threshold_value")
    .eq("enabled", true)
    .or(`paused_until.is.null,paused_until.lt.${nowIso}`);
  if (prefErr) {
    Sentry.captureException(prefErr);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const prefs = ((prefData ?? []) as PrefRow[]).filter((p) => p.event_type === WEEKLY_EVENT);
  if (prefs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const userIds = Array.from(new Set(prefs.map((p) => p.user_id)));
  const { data: profileData } = await supabase.from("profiles").select("id, tier, email").in("id", userIds);
  const proById = new Map<string, { email: string }>();
  for (const p of (profileData ?? []) as { id: string; tier: string; email: string | null }[]) {
    if (p.tier && p.tier !== "free" && p.email) proById.set(p.id, { email: p.email });
  }

  let sent = 0;
  for (const uid of userIds) {
    const profile = proById.get(uid);
    if (!profile) continue;

    try {
      const { data: holdingRows } = await supabase.from("holdings").select("ticker").eq("user_id", uid);
      const held = Array.from(new Set(((holdingRows ?? []) as { ticker: string }[]).map((r) => r.ticker)));

      const { data: trackedRows } = await supabase.from("tracked_tickers").select("ticker").eq("user_id", uid);
      const watched = watchedNotHeld(((trackedRows ?? []) as { ticker: string }[]).map((r) => r.ticker), held);

      // Nothing to summarise at all -> skip the send entirely.
      if (held.length === 0 && watched.length === 0) continue;

      const holdingMovers = selectWeeklyMovers(await fetchWeeklyObservations(supabase, held, cutoff));
      const watchlistMovers = selectWeeklyMovers(await fetchWeeklyObservations(supabase, watched, cutoff));

      const unsubscribeUrl = `${site}/api/notifications/unsubscribe?token=${signUnsubToken(uid, secret)}`;
      const manageUrl = `${site}/app/account/notifications`;

      const result = await sendIdempotent({
        to: profile.email,
        subject: "Your weekly resilience digest",
        template: "weekly-digest",
        sendKey: `${uid}:weekly:${weekKey}`,
        userId: uid,
        body: WeeklyDigestEmail({
          holdings: holdingMovers.map(toRow),
          watchlist: watchlistMovers.map(toRow),
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
          .in("event_type", [WEEKLY_EVENT]);
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

- [ ] **Step 4: Run test to verify it passes**

Run (from `dividendmapper/`): `npx vitest run app/api/internal/send-weekly-digest/__tests__/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/api/internal/send-weekly-digest/
git commit -m "feat(weekly-digest): weekly cron route (Pro-gated, ISO-week idempotent)"
```

---

### Task 5: Notifications API — add the weekly_digest toggle

Persist and read the fourth toggle. Mirrors the existing `watchlist` toggle handling in `/api/notifications`.

**Files:**
- Modify: `dividendmapper/app/api/notifications/route.ts`
- Test: `dividendmapper/app/api/notifications/__tests__/route.test.ts`

- [ ] **Step 1a: Update the existing full-object GET assertion**

The existing test `GET shapes rows into { quality, risk, watchlist }` asserts the WHOLE response with `toEqual`, so it will break once the response gains `weeklyDigest`. Add the new key to its expected object. Change (lines ~66-70):

```typescript
    expect(await res.json()).toEqual({
      quality: { enabled: true, threshold: 30 },
      risk: { enabled: false, threshold: 75 },
      watchlist: { enabled: true },
    });
```

to:

```typescript
    expect(await res.json()).toEqual({
      quality: { enabled: true, threshold: 30 },
      risk: { enabled: false, threshold: 75 },
      watchlist: { enabled: true },
      weeklyDigest: { enabled: false },
    });
```

- [ ] **Step 1b: Write the failing tests**

Add these two cases inside the existing `describe("/api/notifications", ...)` block in `dividendmapper/app/api/notifications/__tests__/route.test.ts`. They reuse the file's existing `getClaims` / `selectRows` / `upsert` mocks and `req()` helper:

```typescript
  it("GET defaults weeklyDigest to disabled when no row exists", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    selectRows.mockResolvedValue({ data: [] });
    const res = await GET();
    expect((await res.json()).weeklyDigest).toEqual({ enabled: false });
  });

  it("GET reflects an enabled weekly_digest row", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    selectRows.mockResolvedValue({
      data: [{ event_type: "weekly_digest", enabled: true, threshold_value: null }],
    });
    const res = await GET();
    expect((await res.json()).weeklyDigest).toEqual({ enabled: true });
  });

  it("upserts a weekly_digest row (on/off, no threshold)", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await PUT(req({ weeklyDigest: { enabled: true } }));
    expect(res.status).toBe(200);
    const rows = upsert.mock.calls[0][0] as Record<string, unknown>[];
    const weekly = rows.find((r) => r.event_type === "weekly_digest")!;
    expect(weekly.user_id).toBe("u1");
    expect(weekly.enabled).toBe(true);
    expect(weekly.threshold_value).toBeNull();
  });

  it("400 on a malformed weeklyDigest pref", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
    const res = await PUT(req({ weeklyDigest: { enabled: "yes" } }));
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });
```

(`GET` and `PUT` are imported at the top of the existing file, so no per-test `await import` is needed.)

- [ ] **Step 2: Run test to verify it fails**

Run (from `dividendmapper/`): `npx vitest run app/api/notifications/__tests__/route.test.ts`
Expected: FAIL — the new GET cases see `weeklyDigest` undefined; the PUT case finds no `weekly_digest` row; the malformed case currently returns 200 (the route ignores unknown keys).

- [ ] **Step 3: Write minimal implementation**

In `dividendmapper/app/api/notifications/route.ts`, add the weekly event constant next to `WATCHLIST_EVENT`:

```typescript
const WEEKLY_EVENT = "weekly_digest";
```

In `GET`, extend the `out` type and default, and read the row. Change:

```typescript
  const out: Record<PrefKey, PrefInput> & { watchlist: { enabled: boolean } } = {
    quality: { enabled: false, threshold: DEFAULT_THRESHOLD.quality },
    risk: { enabled: false, threshold: DEFAULT_THRESHOLD.risk },
    watchlist: { enabled: false },
  };
```

to:

```typescript
  const out: Record<PrefKey, PrefInput> & {
    watchlist: { enabled: boolean };
    weeklyDigest: { enabled: boolean };
  } = {
    quality: { enabled: false, threshold: DEFAULT_THRESHOLD.quality },
    risk: { enabled: false, threshold: DEFAULT_THRESHOLD.risk },
    watchlist: { enabled: false },
    weeklyDigest: { enabled: false },
  };
```

and after the `watchlistRow` block add:

```typescript
  const weeklyRow = rows.find((r) => r.event_type === WEEKLY_EVENT);
  if (weeklyRow) out.weeklyDigest = { enabled: weeklyRow.enabled };
```

In `PUT`, after the existing `watchlist` block (before the `if (rows.length === 0)` guard) add:

```typescript
  const weeklyDigest = parseToggle(b.weeklyDigest);
  if (weeklyDigest === "invalid") return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (weeklyDigest !== null) {
    rows.push({
      user_id: uid,
      event_type: WEEKLY_EVENT,
      enabled: weeklyDigest,
      threshold_value: null,
      updated_at: now,
    });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `dividendmapper/`): `npx vitest run app/api/notifications/__tests__/route.test.ts`
Expected: PASS (existing + new cases).

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/api/notifications/route.ts dividendmapper/app/api/notifications/__tests__/route.test.ts
git commit -m "feat(weekly-digest): persist + read the weekly_digest notification toggle"
```

---

### Task 6: Notifications UI — add the weekly digest toggle

Add a fourth on/off toggle (no threshold) to the prefs form and thread it through the page's load + defaults. Verified by typecheck + lint + build (the form is presentational; persistence is covered by Task 5).

**Files:**
- Modify: `dividendmapper/app/app/account/notifications/_components/notification-prefs-form.tsx`
- Modify: `dividendmapper/app/app/account/notifications/page.tsx`

- [ ] **Step 1: Extend the form's shape + state**

In `notification-prefs-form.tsx`, add `weeklyDigest` to `PrefsShape`:

```typescript
export interface PrefsShape {
  quality: PrefState;
  risk: PrefState;
  watchlist: ToggleState;
  weeklyDigest: ToggleState;
}
```

Add a setter next to `setWatchlist`:

```typescript
  function setWeeklyDigest(enabled: boolean) {
    setPrefs((p) => ({ ...p, weeklyDigest: { enabled } }));
    setStatus("idle");
  }
```

- [ ] **Step 2: Render the toggle row**

Immediately after the existing watchlist toggle `<div>...</div>` (the block whose label is "Watchlist alerts"), add:

```tsx
      <div className="flex items-start justify-between gap-4 border-b border-border py-4 last:border-0">
        <div>
          <label htmlFor="weekly-enabled" className="text-sm font-medium text-foreground">
            Weekly digest
          </label>
          <p className="mt-1 text-sm text-muted-foreground">
            Email me a weekly summary of how my holdings and watchlist moved, even on a quiet week.
          </p>
        </div>
        <input
          id="weekly-enabled"
          type="checkbox"
          aria-label="Weekly digest"
          disabled={!isPro}
          checked={prefs.weeklyDigest.enabled}
          onChange={(e) => setWeeklyDigest(e.target.checked)}
          className="mt-1 h-5 w-5 disabled:opacity-50"
        />
      </div>
```

Update the footer note copy from:

```tsx
        At most one summary email per day. These scores are a resilience check, not financial advice.
```

to:

```tsx
        At most one summary email per day, plus an optional weekly recap. These scores are a resilience
        check, not financial advice.
```

- [ ] **Step 3: Thread it through the page**

In `page.tsx`, add `weeklyDigest` to `DEFAULTS`:

```typescript
const DEFAULTS: PrefsShape = {
  quality: { enabled: false, threshold: 30 },
  risk: { enabled: false, threshold: 75 },
  watchlist: { enabled: false },
  weeklyDigest: { enabled: false },
};
```

Add `weeklyDigest` to the initial `prefs` object:

```typescript
  const prefs: PrefsShape = {
    quality: { ...DEFAULTS.quality },
    risk: { ...DEFAULTS.risk },
    watchlist: { ...DEFAULTS.watchlist },
    weeklyDigest: { ...DEFAULTS.weeklyDigest },
  };
```

And in the row-mapping loop, after the `watchlist_alert` branch add:

```typescript
    if (r.event_type === "weekly_digest") {
      prefs.weeklyDigest = { enabled: r.enabled };
    }
```

- [ ] **Step 4: Verify typecheck, lint, and build pass**

Run (from `dividendmapper/`):
```
npx tsc --noEmit
npx eslint app/app/account/notifications
npm run build
```
Expected: no type errors, no lint errors, successful build.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/app/app/account/notifications/page.tsx dividendmapper/app/app/account/notifications/_components/notification-prefs-form.tsx
git commit -m "feat(weekly-digest): weekly digest toggle on the alerts page"
```

---

### Task 7: Register the cron, humaniser copy check, and full-suite verification

Wire the Sunday 17:00 UTC schedule, clear the email copy through the humaniser linter (project rule), and prove the whole suite + build are green.

**Files:**
- Modify: `dividendmapper/vercel.json`
- Create (scratch, not committed): `super_user/sends/weekly-digest-copy.txt`

- [ ] **Step 1: Add the cron entry**

In `dividendmapper/vercel.json`, add to the `crons` array (after `send-lifecycle-emails`):

```json
    {
      "path": "/api/internal/send-weekly-digest",
      "schedule": "0 17 * * 0"
    }
```

(`0 17 * * 0` = Sundays 17:00 UTC.)

- [ ] **Step 2: Humaniser-lint the email copy**

Extract every human-facing sentence from `emails/weekly-digest.tsx` (the headings, the intro line, the quiet-week line, the two muted footnotes, the link text) into `super_user/sends/weekly-digest-copy.txt`, one sentence per line. Then run (from repo root):

```bash
node scripts/lint/humaniser.js super_user/sends/weekly-digest-copy.txt
```

Expected: exit 0, no violations. If it flags anything (em dash, curly quote, AI vocab, filler, collaborative artifact), fix the wording in `emails/weekly-digest.tsx`, re-extract, and re-run until clean. Then delete the scratch file:

```bash
rm super_user/sends/weekly-digest-copy.txt
```

- [ ] **Step 3: Run the full test suite**

Run (from `dividendmapper/`): `npm test`
Expected: PASS — all existing tests plus the new iso-week, weekly-digest, email, cron-route, and notifications-route tests. Note the new total count.

- [ ] **Step 4: Typecheck + build**

Run (from `dividendmapper/`):
```
npx tsc --noEmit
npm run build
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add dividendmapper/vercel.json dividendmapper/emails/weekly-digest.tsx
git commit -m "feat(weekly-digest): register Sunday 17:00 UTC cron; humaniser-clear copy"
```

---

## Post-merge (Glenn, not part of the automated build)

These require a deployed environment and live credentials, so they are out of the automated plan but must happen before the feature is considered shipped:

1. **Deploy** `feat/weekly-digest` to prod (git auto-deploy; Root Directory `dividendmapper`).
2. **Live Pro smoke:** as a Pro account, opt into the Weekly digest toggle; trigger `POST /api/internal/send-weekly-digest` with `Authorization: Bearer $CRON_SECRET` against a synthetic ticker that has both a score change and a ≥5% price swing over 7 days of `equity_score_history`; confirm the email renders both tables; re-run and confirm `sent:0` (idempotent for the ISO week); then tear down. Reuse the `scripts/smoke/watchlist-alert-dryrun.mjs` harness pattern.
3. **Verify the cron** appears in the Vercel dashboard crons list with schedule `0 17 * * 0` after deploy.
4. Update `planning/plans/2026-06-11-phase-3.5-backlog-remaining.md`: move Track A #1 (weekly digest) to Done.

---

## Self-review notes

- **Spec coverage:** cadence + own cron (Task 4, 7); opt-in Pro toggle, no migration (Tasks 5, 6); inclusion rule resilience/risk/|swing|≥5% (Task 2); missing-baseline skip + degraded_uk skip (Task 2); quiet-week send vs zero-position skip (Task 4); two tables holdings/watchlist (Task 3); price % swing only, no currency (Tasks 2, 3); read-only over `equity_score_history` current+on/before-7d baseline (Tasks 2, 4); ISO-week idempotency (Tasks 1, 4); reuse of sendIdempotent/Pro-gate/paused_until/unsubscribe/watchedNotHeld (Task 4); humaniser pass (Task 7). All covered.
- **Type consistency:** `WeeklyObservation`, `HistoryRow`, `WeeklyMover`, `MetricMove`, `PriceMove` defined in Task 2 and consumed unchanged in Task 4; `WeeklyRow` defined in Task 3 and produced by `toRow` in Task 4; `isoWeekKey` defined Task 1, used Task 4; `PrefsShape` extended consistently across Tasks 5/6.
- **No placeholders:** every code step shows complete code, including Task 5's concrete tests (matched to the existing `getClaims`/`selectRows`/`upsert` harness) and the required edit to the existing full-object GET assertion that the new key would otherwise break.
