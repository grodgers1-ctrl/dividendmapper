# Income Vehicles Hub — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILLS in order — `superpowers:executing-plans` (this plan), `superpowers:subagent-driven-development` (recommended for per-day execution), `superpowers:test-driven-development` (per-task where logic-shaped). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public `/income-vehicles` hub (search-first, leaderboards, filter strip, results table — free, crawlable, ISR) and a Pro-only `/app/income-vehicles` peer (same shell + holdings/watchlist toggle + saved screens) so the Sprint 4 vehicle resilience product has a clearly-labelled, nav-linked, indexable home.

**Architecture:** Two surfaces share one embedded universe (~3 KB gzipped, loaded server-side and embedded in the page payload). All filter + search runs in-memory client-side. Click-through to per-ticker detail continues through the existing rate-limited `/api/vehicle-scoring/[ticker]` route. Saved screens land in a new one-table migration backed by a thin Pro-gated REST endpoint.

**Tech Stack:** Next.js 16 App Router + React 19 + Tailwind v4, Supabase Postgres + Auth, Vitest + RTL, PostHog. Reuses Sprint 4 helpers (`loadVehicleScoresByTickers`, `captureClientEvent`, `VehicleSignalBreakdown`) and Sprint 3 metadata (`VEHICLE_FAMILIES`, `--color-resilience-*` ramp).

**Spec:** [planning/specs/2026-06-24-income-vehicles-hub-design.md](../specs/2026-06-24-income-vehicles-hub-design.md)

**Branch:** `feature/income-vehicles-hub` off `main`. Per-day commits inside the worktree. PR rebased onto current `main` at the end of Day 6.

---

## Pre-flight (Day 0.5 — before Day 1 kicks off)

### 1. Agentic worker — worktree setup

```bash
cd /c/Users/grodg/dividend_mapper_plan
git fetch origin
git worktree add dividendmapper/.worktrees/income-vehicles-hub -b feature/income-vehicles-hub origin/main
cd dividendmapper/.worktrees/income-vehicles-hub/dividendmapper
cmd //C "rmdir node_modules" 2>/dev/null
cmd //C "mklink /J node_modules C:\\Users\\grodg\\dividend_mapper_plan\\dividendmapper\\node_modules" 2>&1
cmd //C "mklink .env.local C:\\Users\\grodg\\dividend_mapper_plan\\dividendmapper\\.env.local" 2>&1
# Baseline: expect ≥ 1373 tests (Sprint 4 close-out figure).
npx vitest run --no-file-parallelism lib/scoring/ lib/portfolio/ 2>&1 | tail -5
```

If `node_modules` is empty in the primary checkout (parallel agent wiped it — see memory entry on concurrent worktree race), run `npm install --no-audit --no-fund --prefer-offline` from inside the worktree before the baseline.

### 2. Confirm migration number

```bash
ls dividendmapper/supabase/migrations/ | tail -5
```

Last migration at plan-writing time was `0018_vehicle_scoring.sql`. The new saved-screens migration is **`0019_saved_screens.sql`**. If newer migrations have landed between plan-writing and execution, bump the number and update every reference in Day 5 below.

### 3. Glenn — none required for Day 1–4

Day 5 (saved screens) needs the migration applied to prod via Supabase CLI. Glenn runs that command; the plan writes the migration file but does not execute it.

---

## File map (lock decomposition here)

**New files:**

- `lib/scoring/load-vehicle-universe.ts` _(~80 lines)_ — server helper returning the full universe as a flat array.
- `lib/scoring/__tests__/load-vehicle-universe.test.ts` _(3 tests)_.
- `lib/portfolio/income-vehicle-screener.ts` _(~120 lines)_ — pure `filterVehicles`, `searchVehicles`, `sortVehicles`.
- `lib/portfolio/__tests__/income-vehicle-screener.test.ts` _(~12 tests)_.
- `app/(public)/income-vehicles/page.tsx` — public hub server component.
- `app/(public)/income-vehicles/_components/leaderboard-card.tsx` — family leaderboard primitive (server component).
- `app/(public)/income-vehicles/_components/screener.tsx` — client component for search + filter + table.
- `app/(public)/income-vehicles/_components/soft-wall.tsx` — anon-only Pro CTA.
- `app/(public)/income-vehicles/_components/__tests__/screener.test.tsx` — RTL test for filter + search.
- `app/(public)/income-vehicles/__tests__/page.test.tsx` — RTL test for the hub.
- `app/app/income-vehicles/page.tsx` — Pro-only in-app hub.
- `app/app/income-vehicles/_components/saved-screens-rail.tsx` — left rail.
- `app/api/screens/route.ts` — Pro save-screen GET + POST + DELETE.
- `app/api/screens/__tests__/route.test.ts` — auth + Pro-tier guard tests.
- `supabase/migrations/0019_saved_screens.sql` — one-table migration.

**Modified files:**

- `components/site-header.tsx` — add `Income vehicles` to `BASE_NAV`.
- `app/app/_components/shell/nav-items.ts` — add `/app/income-vehicles` entry between `Portfolio Manager` and `Watchlist`.
- `app/sitemap.ts` — add `/income-vehicles` at priority `0.8`.

**Reused from Sprint 3/4 (zero changes):**

- `lib/scoring/load-vehicle-score.ts` — `VehicleType` type + `loadVehicleScoresByTickers` (won't be called by the hub, but shape compatibility).
- `lib/scoring/data/vehicle-families.ts` — `VEHICLE_FAMILIES` metadata for slug derivation.
- `lib/analytics/posthog-capture.ts` — `captureClientEvent` for custom events.
- `app/(public)/_components/vehicle-signal-breakdown.tsx` — shared Pro per-signal UI (not used directly by the hub, but the drawer-link target).
- `app/app/portfolio/_components/vehicle-chip.tsx` — chip primitive (results-table inline score chip).

---

## Day 1 — Data layer + screener helpers

**Outcome.** Two pure modules land with full test coverage. No UI yet. ~12 new tests.

### Task 1.1 — `loadVehicleUniverse` server helper

**Files:**
- Create: `dividendmapper/lib/scoring/load-vehicle-universe.ts`
- Test: `dividendmapper/lib/scoring/__tests__/load-vehicle-universe.test.ts`

- [ ] **Step 1.1.1: Write the failing test**

Create `dividendmapper/lib/scoring/__tests__/load-vehicle-universe.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { loadVehicleUniverse } from "../load-vehicle-universe";

type Row = Record<string, unknown>;

function makeStub(rows: { vehicle_scores?: Row[]; vehicle_universe?: Row[] }) {
  const fromMock = vi.fn((table: string) => {
    const builder: {
      select: () => typeof builder;
      then: (resolve: (v: { data: Row[]; error: unknown }) => void) => void;
    } = {
      select: () => builder,
      then: (resolve) => {
        const data =
          table === "vehicle_scores"
            ? (rows.vehicle_scores ?? [])
            : table === "vehicle_universe"
              ? (rows.vehicle_universe ?? [])
              : [];
        resolve({ data, error: null });
      },
    };
    return builder;
  });
  return { sb: { from: fromMock } };
}

describe("loadVehicleUniverse", () => {
  it("returns an empty array when no scores exist", async () => {
    const { sb } = makeStub({ vehicle_scores: [] });
    const result = await loadVehicleUniverse(sb);
    expect(result).toEqual([]);
  });

  it("maps vehicle_scores + vehicle_universe rows into the client shape", async () => {
    const { sb } = makeStub({
      vehicle_scores: [
        {
          ticker: "O",
          vehicle_type: "us_reit",
          resilience_score: 81,
          quality_gate_passed: true,
          computed_at: "2026-06-23T09:00:00Z",
        },
      ],
      vehicle_universe: [
        {
          ticker: "O",
          display_name: "Realty Income",
          sub_sector: "retail_net_lease",
          dividend_yield: 0.056,
          leverage_headline: "FFO payout 81%",
        },
      ],
    });
    const result = await loadVehicleUniverse(sb);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      ticker: "O",
      vehicleType: "us_reit",
      displayName: "Realty Income",
      subSector: "retail_net_lease",
      resilienceScore: 81,
      qualityGatePassed: true,
      dividendYield: 0.056,
      leverageHeadline: "FFO payout 81%",
      computedAt: "2026-06-23T09:00:00Z",
    });
  });

  it("tolerates a missing universe row by falling back to ticker as displayName", async () => {
    const { sb } = makeStub({
      vehicle_scores: [
        {
          ticker: "ORPH",
          vehicle_type: "us_reit",
          resilience_score: 50,
          quality_gate_passed: true,
          computed_at: "2026-06-23T09:00:00Z",
        },
      ],
      vehicle_universe: [],
    });
    const result = await loadVehicleUniverse(sb);
    expect(result[0].displayName).toBe("ORPH");
    expect(result[0].subSector).toBeNull();
    expect(result[0].dividendYield).toBeNull();
    expect(result[0].leverageHeadline).toBe("");
  });
});
```

- [ ] **Step 1.1.2: Run the test to verify it fails**

```bash
cd dividendmapper/.worktrees/income-vehicles-hub/dividendmapper
npx vitest run lib/scoring/__tests__/load-vehicle-universe.test.ts
```

Expected: FAIL with `Cannot find module '../load-vehicle-universe'`.

- [ ] **Step 1.1.3: Implement the helper**

Create `dividendmapper/lib/scoring/load-vehicle-universe.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VehicleType } from "./load-vehicle-score";

// Server-side loader for the /income-vehicles hub. Returns the entire scored
// universe (~100 rows) in one round-trip, joined to vehicle_universe for the
// display name + sub-sector. Embedded directly in the page payload so the
// client-side filter and search run with no network round-trips.

export interface VehicleUniverseRow {
  ticker: string;
  vehicleType: VehicleType;
  displayName: string;
  subSector: string | null;
  resilienceScore: number | null;
  qualityGatePassed: boolean;
  dividendYield: number | null;
  leverageHeadline: string;
  computedAt: string;
}

type ScoreRowDb = {
  ticker: string;
  vehicle_type: VehicleType;
  resilience_score: number | null;
  quality_gate_passed: boolean;
  computed_at: string;
};

type UniverseRowDb = {
  ticker: string;
  display_name: string;
  sub_sector: string | null;
  dividend_yield: number | null;
  leverage_headline: string | null;
};

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function loadVehicleUniverse(
  client: SupabaseClient,
): Promise<VehicleUniverseRow[]> {
  const { data: scoresRaw, error: scoresError } = await client
    .from("vehicle_scores")
    .select("ticker, vehicle_type, resilience_score, quality_gate_passed, computed_at");
  if (scoresError) throw new Error("vehicle_universe_lookup_failed");
  const scores = (scoresRaw ?? []) as ScoreRowDb[];
  if (scores.length === 0) return [];

  const { data: universeRaw } = await client
    .from("vehicle_universe")
    .select("ticker, display_name, sub_sector, dividend_yield, leverage_headline");
  const universeByTicker = new Map<string, UniverseRowDb>();
  for (const row of (universeRaw ?? []) as UniverseRowDb[]) {
    universeByTicker.set(row.ticker, row);
  }

  return scores.map((s) => {
    const u = universeByTicker.get(s.ticker);
    return {
      ticker: s.ticker,
      vehicleType: s.vehicle_type,
      displayName: u?.display_name ?? s.ticker,
      subSector: u?.sub_sector ?? null,
      resilienceScore: toNumber(s.resilience_score),
      qualityGatePassed: s.quality_gate_passed,
      dividendYield: toNumber(u?.dividend_yield ?? null),
      leverageHeadline: u?.leverage_headline ?? "",
      computedAt: s.computed_at,
    };
  });
}
```

> **Note on schema:** `vehicle_universe.dividend_yield` and `vehicle_universe.leverage_headline` must exist as columns. The Sprint 1 migration (`0018_vehicle_scoring.sql`) defines `vehicle_universe` with most of the needed fields but **not** these two — they're populated daily by the cron. If they aren't there at execution time, **add them via Step 5.0 of Day 5 (a small ALTER TABLE in the migration), and have the cron backfill them.** If they ARE there (cron already shipped between sprints), this paragraph is moot.

- [ ] **Step 1.1.4: Run the test to verify it passes**

```bash
npx vitest run lib/scoring/__tests__/load-vehicle-universe.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 1.1.5: Commit**

```bash
git add lib/scoring/load-vehicle-universe.ts lib/scoring/__tests__/load-vehicle-universe.test.ts
git commit -m "$(cat <<'EOF'
Income vehicles hub Day 1: loadVehicleUniverse server helper

Returns the full ~100-row vehicle universe in one Supabase round-trip,
joined to vehicle_universe for displayName + subSector + yield + leverage
headline. Embedded in the hub page payload so client-side filter/search
run with zero network round-trips.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 1.2 — `income-vehicle-screener` pure helpers

**Files:**
- Create: `dividendmapper/lib/portfolio/income-vehicle-screener.ts`
- Test: `dividendmapper/lib/portfolio/__tests__/income-vehicle-screener.test.ts`

- [ ] **Step 1.2.1: Write the failing test**

Create `dividendmapper/lib/portfolio/__tests__/income-vehicle-screener.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  filterVehicles,
  searchVehicles,
  sortVehicles,
  type ScreenerCriteria,
} from "../income-vehicle-screener";
import type { VehicleUniverseRow } from "@/lib/scoring/load-vehicle-universe";

function row(overrides: Partial<VehicleUniverseRow> = {}): VehicleUniverseRow {
  return {
    ticker: "O",
    vehicleType: "us_reit",
    displayName: "Realty Income",
    subSector: "retail_net_lease",
    resilienceScore: 80,
    qualityGatePassed: true,
    dividendYield: 0.056,
    leverageHeadline: "FFO payout 81%",
    computedAt: "2026-06-23T09:00:00Z",
    ...overrides,
  };
}

const UNIVERSE: VehicleUniverseRow[] = [
  row({ ticker: "O", vehicleType: "us_reit", resilienceScore: 80 }),
  row({ ticker: "PSA", vehicleType: "us_reit", displayName: "Public Storage", resilienceScore: 78 }),
  row({ ticker: "MAIN", vehicleType: "us_bdc", displayName: "Main Street Capital", subSector: "internally_managed_bdc", resilienceScore: 73 }),
  row({ ticker: "BLND.L", vehicleType: "uk_reit", displayName: "British Land", subSector: "uk_diversified", resilienceScore: 65 }),
  row({ ticker: "BAD", vehicleType: "us_reit", resilienceScore: null, qualityGatePassed: false }),
];

const EMPTY_CRITERIA: ScreenerCriteria = {
  family: "all",
  minResilience: 0,
  subSector: null,
  gatePassedOnly: false,
};

describe("filterVehicles", () => {
  it("returns the full universe when no filters are active", () => {
    expect(filterVehicles(UNIVERSE, EMPTY_CRITERIA)).toHaveLength(5);
  });

  it("filters by family chip", () => {
    const out = filterVehicles(UNIVERSE, { ...EMPTY_CRITERIA, family: "us_bdc" });
    expect(out).toHaveLength(1);
    expect(out[0].ticker).toBe("MAIN");
  });

  it("filters by min resilience (gate-failed rows have null score and are dropped)", () => {
    const out = filterVehicles(UNIVERSE, { ...EMPTY_CRITERIA, minResilience: 75 });
    expect(out.map((r) => r.ticker).sort()).toEqual(["O", "PSA"]);
  });

  it("filters by sub-sector", () => {
    const out = filterVehicles(UNIVERSE, {
      ...EMPTY_CRITERIA,
      subSector: "uk_diversified",
    });
    expect(out).toHaveLength(1);
    expect(out[0].ticker).toBe("BLND.L");
  });

  it("gate-passed-only excludes failed-gate vehicles", () => {
    const out = filterVehicles(UNIVERSE, {
      ...EMPTY_CRITERIA,
      gatePassedOnly: true,
    });
    expect(out.every((r) => r.qualityGatePassed)).toBe(true);
    expect(out.find((r) => r.ticker === "BAD")).toBeUndefined();
  });

  it("combined filters with no matches return empty", () => {
    const out = filterVehicles(UNIVERSE, {
      family: "uk_reit",
      minResilience: 90,
      subSector: null,
      gatePassedOnly: false,
    });
    expect(out).toEqual([]);
  });
});

describe("searchVehicles", () => {
  it("exact ticker hit ranks first", () => {
    const out = searchVehicles(UNIVERSE, "MAIN");
    expect(out[0].ticker).toBe("MAIN");
  });

  it("matches a substring on displayName, case-insensitive", () => {
    const out = searchVehicles(UNIVERSE, "british");
    expect(out).toHaveLength(1);
    expect(out[0].ticker).toBe("BLND.L");
  });

  it("matches a prefix on ticker", () => {
    const out = searchVehicles(UNIVERSE, "ps");
    expect(out[0].ticker).toBe("PSA");
  });

  it("no match returns empty", () => {
    expect(searchVehicles(UNIVERSE, "zzz")).toEqual([]);
  });

  it("empty query returns the full universe unchanged", () => {
    expect(searchVehicles(UNIVERSE, "")).toEqual(UNIVERSE);
    expect(searchVehicles(UNIVERSE, "   ")).toEqual(UNIVERSE);
  });
});

describe("sortVehicles", () => {
  it("sorts by resilience desc by default (gate-failed at the bottom)", () => {
    const out = sortVehicles(UNIVERSE, "resilience", "desc");
    expect(out.map((r) => r.ticker)).toEqual(["O", "PSA", "MAIN", "BLND.L", "BAD"]);
  });

  it("sorts by ticker asc", () => {
    const out = sortVehicles(UNIVERSE, "ticker", "asc");
    expect(out.map((r) => r.ticker)).toEqual([
      "BAD",
      "BLND.L",
      "MAIN",
      "O",
      "PSA",
    ]);
  });

  it("sorts by yield desc, null yields fall to the bottom", () => {
    const universeWithNullYield = [
      ...UNIVERSE.slice(0, 2),
      row({
        ticker: "NOFEED",
        vehicleType: "us_reit",
        dividendYield: null,
      }),
    ];
    const out = sortVehicles(universeWithNullYield, "yield", "desc");
    expect(out[out.length - 1].ticker).toBe("NOFEED");
  });
});
```

- [ ] **Step 1.2.2: Run the test to verify it fails**

```bash
npx vitest run lib/portfolio/__tests__/income-vehicle-screener.test.ts
```

Expected: FAIL with `Cannot find module '../income-vehicle-screener'`.

- [ ] **Step 1.2.3: Implement the helpers**

Create `dividendmapper/lib/portfolio/income-vehicle-screener.ts`:

```ts
import type { VehicleUniverseRow } from "@/lib/scoring/load-vehicle-universe";
import type { VehicleType } from "@/lib/scoring/load-vehicle-score";

// Pure filter / search / sort helpers for the /income-vehicles hub. The hub
// embeds the full scored universe (~100 rows) in the page payload; these
// functions transform that array in memory on each keystroke or filter change.
// No I/O — keeps the screener instant and the unit tests fast.

export type FamilyChoice = "all" | VehicleType;

export interface ScreenerCriteria {
  family: FamilyChoice;
  minResilience: number; // 0..100; rows below this are dropped (gate-failed scores=null are always dropped here too)
  subSector: string | null;
  gatePassedOnly: boolean;
}

export function filterVehicles(
  rows: ReadonlyArray<VehicleUniverseRow>,
  criteria: ScreenerCriteria,
): VehicleUniverseRow[] {
  return rows.filter((r) => {
    if (criteria.family !== "all" && r.vehicleType !== criteria.family) {
      return false;
    }
    if (criteria.gatePassedOnly && !r.qualityGatePassed) return false;
    if (criteria.subSector !== null && r.subSector !== criteria.subSector) {
      return false;
    }
    if (criteria.minResilience > 0) {
      if (r.resilienceScore === null) return false;
      if (r.resilienceScore < criteria.minResilience) return false;
    }
    return true;
  });
}

// Exact ticker hit ranks first, then prefix-on-ticker, then substring-on-name.
// Empty / whitespace query short-circuits and returns the universe unchanged.
export function searchVehicles(
  rows: ReadonlyArray<VehicleUniverseRow>,
  query: string,
): VehicleUniverseRow[] {
  const q = query.trim().toUpperCase();
  if (q.length === 0) return rows.slice();
  const exact: VehicleUniverseRow[] = [];
  const prefix: VehicleUniverseRow[] = [];
  const substring: VehicleUniverseRow[] = [];
  for (const r of rows) {
    const ticker = r.ticker.toUpperCase();
    const name = r.displayName.toUpperCase();
    if (ticker === q) {
      exact.push(r);
    } else if (ticker.startsWith(q)) {
      prefix.push(r);
    } else if (ticker.includes(q) || name.includes(q)) {
      substring.push(r);
    }
  }
  return [...exact, ...prefix, ...substring];
}

export type SortKey = "resilience" | "ticker" | "yield";
export type SortDir = "asc" | "desc";

export function sortVehicles(
  rows: ReadonlyArray<VehicleUniverseRow>,
  key: SortKey,
  dir: SortDir,
): VehicleUniverseRow[] {
  const out = rows.slice();
  out.sort((a, b) => {
    const cmp = compareBy(a, b, key);
    return dir === "asc" ? cmp : -cmp;
  });
  return out;
}

function compareBy(
  a: VehicleUniverseRow,
  b: VehicleUniverseRow,
  key: SortKey,
): number {
  if (key === "ticker") return a.ticker.localeCompare(b.ticker);
  if (key === "resilience") {
    // Null scores rank last in DESC order (i.e. weakest); push them to the bottom.
    if (a.resilienceScore === null && b.resilienceScore === null) return 0;
    if (a.resilienceScore === null) return 1; // a "less than" b in DESC sense → flip
    if (b.resilienceScore === null) return -1;
    return a.resilienceScore - b.resilienceScore;
  }
  // yield
  if (a.dividendYield === null && b.dividendYield === null) return 0;
  if (a.dividendYield === null) return 1;
  if (b.dividendYield === null) return -1;
  return a.dividendYield - b.dividendYield;
}
```

- [ ] **Step 1.2.4: Run the test to verify it passes**

```bash
npx vitest run lib/portfolio/__tests__/income-vehicle-screener.test.ts
```

Expected: PASS (13 tests).

- [ ] **Step 1.2.5: Commit**

```bash
git add lib/portfolio/income-vehicle-screener.ts lib/portfolio/__tests__/income-vehicle-screener.test.ts
git commit -m "$(cat <<'EOF'
Income vehicles hub Day 1: filter / search / sort helpers

Pure functions over the embedded universe — filterVehicles by family chip
+ min resilience + sub-sector + gate-passed; searchVehicles ranks exact
ticker hit first then prefix then substring; sortVehicles by resilience /
ticker / yield with null-last semantics on null scores.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Day 1 end-of-day checklist

- [ ] `loadVehicleUniverse` + 3 tests committed.
- [ ] `income-vehicle-screener` + 13 tests committed.
- [ ] `npx vitest run --no-file-parallelism lib/scoring/ lib/portfolio/` green (≥ 1389 tests, base 1373 + 16 new).

---

## Day 2 — Hub components (server + client primitives)

**Outcome.** Three reusable components land — `<LeaderboardCard>`, `<Screener>`, `<SoftWall>` — wired up to the Day 1 helpers but not yet mounted in a page. ~3 new tests.

### Task 2.1 — `<LeaderboardCard>` server component

**Files:**
- Create: `dividendmapper/app/(public)/income-vehicles/_components/leaderboard-card.tsx`
- Test: `dividendmapper/app/(public)/income-vehicles/_components/__tests__/leaderboard-card.test.tsx`

- [ ] **Step 2.1.1: Write the failing test**

Create `dividendmapper/app/(public)/income-vehicles/_components/__tests__/leaderboard-card.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LeaderboardCard } from "../leaderboard-card";
import type { VehicleUniverseRow } from "@/lib/scoring/load-vehicle-universe";

function row(overrides: Partial<VehicleUniverseRow>): VehicleUniverseRow {
  return {
    ticker: "X",
    vehicleType: "us_reit",
    displayName: "X",
    subSector: null,
    resilienceScore: 50,
    qualityGatePassed: true,
    dividendYield: null,
    leverageHeadline: "",
    computedAt: "2026-06-23T09:00:00Z",
    ...overrides,
  };
}

describe("<LeaderboardCard>", () => {
  it("renders the top N rows of the given family in resilience-desc order, excluding gate-failed", () => {
    const universe = [
      row({ ticker: "O", vehicleType: "us_reit", displayName: "Realty Income", resilienceScore: 81 }),
      row({ ticker: "PSA", vehicleType: "us_reit", displayName: "Public Storage", resilienceScore: 78 }),
      row({ ticker: "BAD", vehicleType: "us_reit", displayName: "Gate-failed", resilienceScore: null, qualityGatePassed: false }),
      row({ ticker: "MAIN", vehicleType: "us_bdc", displayName: "Main Street Capital", resilienceScore: 73 }),
    ];
    render(<LeaderboardCard vehicleType="us_reit" universe={universe} topN={3} />);
    expect(screen.getByText("Top US REITs")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    // BAD is gate-failed and excluded; MAIN is wrong family.
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("O");
    expect(links[0]).toHaveTextContent("Realty Income");
    expect(links[1]).toHaveTextContent("PSA");
  });
});
```

- [ ] **Step 2.1.2: Run the test to verify it fails**

```bash
npx vitest run "app/(public)/income-vehicles/_components/__tests__/leaderboard-card.test.tsx"
```

Expected: FAIL with `Cannot find module '../leaderboard-card'`.

- [ ] **Step 2.1.3: Implement the component**

Create `dividendmapper/app/(public)/income-vehicles/_components/leaderboard-card.tsx`:

```tsx
import Link from "next/link";
import type { VehicleType } from "@/lib/scoring/load-vehicle-score";
import type { VehicleUniverseRow } from "@/lib/scoring/load-vehicle-universe";
import { VEHICLE_FAMILIES } from "@/lib/scoring/data/vehicle-families";

const FAMILY_HEADING: Record<VehicleType, string> = {
  us_reit: "Top US REITs",
  us_bdc: "Top US BDCs",
  uk_reit: "Top UK REITs",
};

function rampColor(score: number): string {
  if (score < 25) return "var(--color-resilience-1)";
  if (score < 50) return "var(--color-resilience-2)";
  if (score < 75) return "var(--color-resilience-3)";
  if (score < 90) return "var(--color-resilience-4)";
  return "var(--color-resilience-5)";
}

export interface LeaderboardCardProps {
  vehicleType: VehicleType;
  universe: ReadonlyArray<VehicleUniverseRow>;
  topN: number;
}

export function LeaderboardCard({
  vehicleType,
  universe,
  topN,
}: LeaderboardCardProps) {
  const slug = VEHICLE_FAMILIES[vehicleType].slug;
  const rows = universe
    .filter(
      (r) =>
        r.vehicleType === vehicleType &&
        r.qualityGatePassed &&
        r.resilienceScore !== null,
    )
    .sort(
      (a, b) =>
        (b.resilienceScore as number) - (a.resilienceScore as number),
    )
    .slice(0, topN);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-display text-sm font-semibold text-foreground">
        {FAMILY_HEADING[vehicleType]}
      </h3>
      <ol className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li key={r.ticker}>
            <Link
              href={`/${slug}/${r.ticker}`}
              className="group flex items-baseline justify-between gap-2 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="font-mono font-medium text-foreground group-hover:underline">
                  {r.ticker}
                </span>
                <span className="ml-1 text-xs text-muted-foreground">
                  · {r.displayName}
                </span>
              </span>
              <span
                className="font-mono text-xs font-bold tabular-nums"
                style={{ color: rampColor(r.resilienceScore as number) }}
              >
                {r.resilienceScore}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 2.1.4: Run the test to verify it passes**

```bash
npx vitest run "app/(public)/income-vehicles/_components/__tests__/leaderboard-card.test.tsx"
```

Expected: PASS (1 test).

- [ ] **Step 2.1.5: Commit**

```bash
git add "app/(public)/income-vehicles/_components/leaderboard-card.tsx" "app/(public)/income-vehicles/_components/__tests__/leaderboard-card.test.tsx"
git commit -m "$(cat <<'EOF'
Income vehicles hub Day 2: LeaderboardCard primitive

Server component, ~70 lines. Filters universe to one family, drops
gate-failed rows, sorts by resilience desc, renders top N as ticker · name
+ Resilience chip. Reuses VEHICLE_FAMILIES slug for the per-ticker link.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 2.2 — `<Screener>` client component

**Files:**
- Create: `dividendmapper/app/(public)/income-vehicles/_components/screener.tsx`
- Test: `dividendmapper/app/(public)/income-vehicles/_components/__tests__/screener.test.tsx`

This is the biggest single component in the plan — search input + filter strip + results table all in one client island. Splitting it across multiple files for V1 would add wiring overhead without separation benefit (they all read + write the same state). The component is ~200 lines.

- [ ] **Step 2.2.1: Write the failing test**

Create `dividendmapper/app/(public)/income-vehicles/_components/__tests__/screener.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Screener } from "../screener";
import type { VehicleUniverseRow } from "@/lib/scoring/load-vehicle-universe";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function row(overrides: Partial<VehicleUniverseRow>): VehicleUniverseRow {
  return {
    ticker: "X",
    vehicleType: "us_reit",
    displayName: "X",
    subSector: null,
    resilienceScore: 50,
    qualityGatePassed: true,
    dividendYield: null,
    leverageHeadline: "",
    computedAt: "2026-06-23T09:00:00Z",
    ...overrides,
  };
}

const UNIVERSE: VehicleUniverseRow[] = [
  row({ ticker: "O", displayName: "Realty Income", resilienceScore: 81 }),
  row({ ticker: "MAIN", vehicleType: "us_bdc", displayName: "Main Street Capital", resilienceScore: 73 }),
  row({ ticker: "BLND.L", vehicleType: "uk_reit", displayName: "British Land", resilienceScore: 65 }),
];

afterEach(() => vi.restoreAllMocks());

describe("<Screener>", () => {
  it("renders one row per universe entry by default", () => {
    render(<Screener universe={UNIVERSE} />);
    expect(screen.getByText("O")).toBeInTheDocument();
    expect(screen.getByText("MAIN")).toBeInTheDocument();
    expect(screen.getByText("BLND.L")).toBeInTheDocument();
    expect(screen.getByText(/Filtered results — 3 vehicles/)).toBeInTheDocument();
  });

  it("narrows by family chip", async () => {
    const user = userEvent.setup();
    render(<Screener universe={UNIVERSE} />);
    await user.click(screen.getByRole("button", { name: "BDCs" }));
    expect(screen.getByText("MAIN")).toBeInTheDocument();
    expect(screen.queryByText("O")).not.toBeInTheDocument();
    expect(screen.queryByText("BLND.L")).not.toBeInTheDocument();
    expect(screen.getByText(/Filtered results — 1 vehicle/)).toBeInTheDocument();
  });

  it("narrows the table when typing in the search box", async () => {
    const user = userEvent.setup();
    render(<Screener universe={UNIVERSE} />);
    await user.type(
      screen.getByPlaceholderText(/Search by ticker or name/),
      "british",
    );
    expect(screen.getByText("BLND.L")).toBeInTheDocument();
    expect(screen.queryByText("O")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2.2.2: Run the test to verify it fails**

```bash
npx vitest run "app/(public)/income-vehicles/_components/__tests__/screener.test.tsx"
```

Expected: FAIL with `Cannot find module '../screener'`.

- [ ] **Step 2.2.3: Implement the component**

Create `dividendmapper/app/(public)/income-vehicles/_components/screener.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Lock } from "lucide-react";
import type { VehicleUniverseRow } from "@/lib/scoring/load-vehicle-universe";
import type { VehicleType } from "@/lib/scoring/load-vehicle-score";
import { VEHICLE_FAMILIES } from "@/lib/scoring/data/vehicle-families";
import {
  filterVehicles,
  searchVehicles,
  sortVehicles,
  type FamilyChoice,
  type ScreenerCriteria,
} from "@/lib/portfolio/income-vehicle-screener";

const FAMILY_LABELS: Record<FamilyChoice, string> = {
  all: "All families",
  us_reit: "REITs",
  us_bdc: "BDCs",
  uk_reit: "UK REITs",
};

const FAMILY_ORDER: FamilyChoice[] = ["all", "us_reit", "us_bdc", "uk_reit"];

function rampColor(score: number): string {
  if (score < 25) return "var(--color-resilience-1)";
  if (score < 50) return "var(--color-resilience-2)";
  if (score < 75) return "var(--color-resilience-3)";
  if (score < 90) return "var(--color-resilience-4)";
  return "var(--color-resilience-5)";
}

function formatYield(decimal: number | null): string {
  if (decimal === null || !Number.isFinite(decimal)) return "—";
  return `${(decimal * 100).toFixed(1)}%`;
}

function familySlug(type: VehicleType): string {
  return VEHICLE_FAMILIES[type].slug;
}

export interface ScreenerProps {
  universe: ReadonlyArray<VehicleUniverseRow>;
  /** If true, "Save screen" renders as an active button instead of a lock pill. */
  showSaveScreenAction?: boolean;
}

export function Screener({ universe, showSaveScreenAction = false }: ScreenerProps) {
  const [query, setQuery] = useState("");
  const [criteria, setCriteria] = useState<ScreenerCriteria>({
    family: "all",
    minResilience: 0,
    subSector: null,
    gatePassedOnly: false,
  });

  const subSectors = useMemo(() => {
    const set = new Set<string>();
    for (const r of universe) if (r.subSector) set.add(r.subSector);
    return [...set].sort();
  }, [universe]);

  const filtered = useMemo(() => {
    const byCriteria = filterVehicles(universe, criteria);
    const bySearch = searchVehicles(byCriteria, query);
    return sortVehicles(bySearch, "resilience", "desc");
  }, [universe, criteria, query]);

  const count = filtered.length;
  const countLabel = count === 1 ? "1 vehicle" : `${count} vehicles`;

  return (
    <div className="space-y-4">
      {/* Hero search */}
      <div className="rounded-xl border border-border bg-card p-4">
        <label htmlFor="vehicle-search" className="sr-only">
          Search by ticker or name
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3">
          <Search aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          <input
            id="vehicle-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ticker or name — e.g. O, MAIN, British Land"
            className="h-10 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Filter strip */}
      <div className="sticky top-16 z-10 rounded-xl border border-border bg-background/95 backdrop-blur-sm p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {FAMILY_ORDER.map((f) => {
            const active = criteria.family === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setCriteria((c) => ({ ...c, family: f }))}
                className={`rounded-full px-3 py-1 transition-colors ${
                  active
                    ? "bg-foreground text-background"
                    : "border border-border text-foreground hover:bg-secondary"
                }`}
              >
                {FAMILY_LABELS[f]}
              </button>
            );
          })}
          <span className="ml-2 flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
            <span className="text-muted-foreground">Resilience ≥</span>
            <input
              type="number"
              min={0}
              max={100}
              value={criteria.minResilience}
              onChange={(e) =>
                setCriteria((c) => ({
                  ...c,
                  minResilience: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                }))
              }
              className="w-12 bg-transparent text-right font-mono tabular-nums text-foreground outline-none"
            />
          </span>
          <select
            value={criteria.subSector ?? ""}
            onChange={(e) =>
              setCriteria((c) => ({
                ...c,
                subSector: e.target.value === "" ? null : e.target.value,
              }))
            }
            className="rounded-full border border-border bg-transparent px-3 py-1 text-foreground"
          >
            <option value="">All sub-sectors</option>
            {subSectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
            <input
              type="checkbox"
              checked={criteria.gatePassedOnly}
              onChange={(e) =>
                setCriteria((c) => ({ ...c, gatePassedOnly: e.target.checked }))
              }
            />
            <span>Gate passed</span>
          </label>
        </div>
      </div>

      {/* Results table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-baseline justify-between gap-3 border-b border-border p-3">
          <p className="text-sm font-medium text-foreground">
            Filtered results — {countLabel}
          </p>
          {showSaveScreenAction ? (
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary"
            >
              Save this screen
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock aria-hidden="true" className="h-3 w-3" /> Save screen (Pro)
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">Ticker</th>
                <th scope="col" className="px-3 py-2">Name</th>
                <th scope="col" className="px-3 py-2">Sub-sector</th>
                <th scope="col" className="px-3 py-2 text-right">Resilience</th>
                <th scope="col" className="px-3 py-2 text-right">Yield</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.ticker} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 font-mono font-medium">
                    <Link
                      href={`/${familySlug(r.vehicleType)}/${r.ticker}`}
                      className="hover:underline"
                    >
                      {r.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-foreground">{r.displayName}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.subSector ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {r.resilienceScore === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className="font-bold"
                        style={{ color: rampColor(r.resilienceScore) }}
                      >
                        {r.resilienceScore}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatYield(r.dividendYield)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.2.4: Run the test to verify it passes**

```bash
npx vitest run "app/(public)/income-vehicles/_components/__tests__/screener.test.tsx"
```

Expected: PASS (3 tests).

- [ ] **Step 2.2.5: Commit**

```bash
git add "app/(public)/income-vehicles/_components/screener.tsx" "app/(public)/income-vehicles/_components/__tests__/screener.test.tsx"
git commit -m "$(cat <<'EOF'
Income vehicles hub Day 2: Screener client component

Hero search + sticky filter strip + results table in one client island.
useMemo chain over the embedded universe — filter → search → sort by
resilience desc — derives the displayed rows with zero network round-trips.
Family chips, min-resilience input, sub-sector select (sourced from
distinct subSector values), gate-passed toggle. Save-screen rendered as a
locked pill by default; opt in via showSaveScreenAction for the Pro
in-app surface.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 2.3 — `<SoftWall>` component

**Files:**
- Create: `dividendmapper/app/(public)/income-vehicles/_components/soft-wall.tsx`

No dedicated test — the component is static prose + a link. The hub-page RTL test (Day 3) asserts it is **not** rendered for the default fixture (since the wall only fires when an anon viewer trips rate limit, which we don't simulate at unit-test level).

- [ ] **Step 2.3.1: Implement**

Create `dividendmapper/app/(public)/income-vehicles/_components/soft-wall.tsx`:

```tsx
import Link from "next/link";

// Rendered only when an anon viewer has hit the /api/vehicle-scoring anon
// rate-limit (60/hr/IP, Sprint 3). Detected at request time on the server,
// passed as a prop from the hub page. Otherwise the component is not
// included in the tree at all.

export function SoftWall() {
  return (
    <section
      role="region"
      aria-label="Pro upgrade prompt"
      className="rounded-xl border border-brand-500/30 bg-brand-50 p-4 dark:border-brand-400/20 dark:bg-brand-900/20"
    >
      <h3 className="font-display text-sm font-semibold text-foreground">
        You've used your free lookups for the hour
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Pro unlocks unlimited screening, saved filters, and the per-signal
        breakdown on every ticker.
      </p>
      <Link
        href="/pricing"
        className="mt-3 inline-flex items-center gap-1 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
      >
        See Pro →
      </Link>
    </section>
  );
}
```

- [ ] **Step 2.3.2: Commit**

```bash
git add "app/(public)/income-vehicles/_components/soft-wall.tsx"
git commit -m "$(cat <<'EOF'
Income vehicles hub Day 2: SoftWall component

Anon-only Pro CTA rendered when the viewer has tripped the
/api/vehicle-scoring rate limit. Server-detected at request time and
passed as a render flag; otherwise the component is not mounted.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Day 2 end-of-day checklist

- [ ] `<LeaderboardCard>` + 1 test committed.
- [ ] `<Screener>` + 3 tests committed.
- [ ] `<SoftWall>` committed (no test).
- [ ] `npx vitest run --no-file-parallelism "app/(public)/income-vehicles"` green (4 tests in this directory).

---

## Day 3 — Public hub page + nav + sitemap

**Outcome.** `/income-vehicles` is reachable from the marketing nav, indexable, renders end-to-end with the seeded vehicle universe. 1 new RTL test.

### Task 3.1 — Public hub page

**Files:**
- Create: `dividendmapper/app/(public)/income-vehicles/page.tsx`
- Test: `dividendmapper/app/(public)/income-vehicles/__tests__/page.test.tsx`

The page is a server component; it does no client work beyond rendering the components from Day 2. The page-level test mounts the **default-exported component** the same way the existing `app/(public)/scoring/` test does, mocking the Supabase server client.

- [ ] **Step 3.1.1: Write the failing test**

Create `dividendmapper/app/(public)/income-vehicles/__tests__/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const universeRows = [
  {
    ticker: "O",
    vehicleType: "us_reit",
    displayName: "Realty Income",
    subSector: "retail_net_lease",
    resilienceScore: 81,
    qualityGatePassed: true,
    dividendYield: 0.056,
    leverageHeadline: "FFO payout 81%",
    computedAt: "2026-06-23T09:00:00Z",
  },
  {
    ticker: "MAIN",
    vehicleType: "us_bdc",
    displayName: "Main Street Capital",
    subSector: "internally_managed_bdc",
    resilienceScore: 73,
    qualityGatePassed: true,
    dividendYield: 0.062,
    leverageHeadline: "NII coverage 1.05×",
    computedAt: "2026-06-23T09:00:00Z",
  },
];

vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => ({}),
}));

vi.mock("@/lib/scoring/load-vehicle-universe", () => ({
  loadVehicleUniverse: vi.fn(async () => universeRows),
}));

describe("/income-vehicles page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the H1, the three family leaderboards, and the screener table", async () => {
    const { default: Page } = await import("../page");
    const ui = await Page();
    render(ui);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Income vehicles, ranked by dividend resilience/,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Top US REITs")).toBeInTheDocument();
    expect(screen.getByText("Top US BDCs")).toBeInTheDocument();
    expect(screen.getByText("Top UK REITs")).toBeInTheDocument();

    // Screener table renders both rows.
    expect(screen.getAllByText("O").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MAIN").length).toBeGreaterThan(0);

    // Microstat strip computes "2 scored vehicles" from the fixture.
    expect(screen.getByText(/2 scored vehicles · 3 families/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3.1.2: Run the test to verify it fails**

```bash
npx vitest run "app/(public)/income-vehicles/__tests__/page.test.tsx"
```

Expected: FAIL with `Cannot find module '../page'`.

- [ ] **Step 3.1.3: Implement the page**

Create `dividendmapper/app/(public)/income-vehicles/page.tsx`:

```tsx
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { loadVehicleUniverse } from "@/lib/scoring/load-vehicle-universe";
import { LeaderboardCard } from "./_components/leaderboard-card";
import { Screener } from "./_components/screener";

// Public hub for vehicle resilience scores. ISR — the universe is rescored
// daily at 09:00 UTC and the page caches for an hour at the edge.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Income vehicle resilience scores",
  description:
    "REITs, BDCs and UK REITs ranked by dividend resilience. Quality gates, payout cover, leverage, sub-sector concentration and recent dividend behaviour, scored daily. Informational only, not financial advice.",
  alternates: { canonical: "/income-vehicles" },
  openGraph: {
    title: "Income vehicle resilience scores | DividendMapper",
    description:
      "REITs, BDCs and UK REITs ranked by dividend resilience.",
    url: `${SITE_URL}/income-vehicles`,
  },
};

export default async function IncomeVehiclesHubPage() {
  const supabase = createSupabasePublicClient();
  const universe = await loadVehicleUniverse(supabase);
  const totalCount = universe.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-12">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Income vehicles, ranked by dividend resilience
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          REITs, BDCs and UK REITs — scored daily on payout cover, leverage,
          concentration and recent dividend behaviour. Informational only, not
          financial advice.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          {totalCount} scored vehicles · 3 families · updated daily at 09:00 UTC
        </p>
      </header>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <LeaderboardCard vehicleType="us_reit" universe={universe} topN={10} />
        <LeaderboardCard vehicleType="us_bdc" universe={universe} topN={10} />
        <LeaderboardCard vehicleType="uk_reit" universe={universe} topN={10} />
      </div>

      <Screener universe={universe} />
    </div>
  );
}
```

- [ ] **Step 3.1.4: Run the test to verify it passes**

```bash
npx vitest run "app/(public)/income-vehicles/__tests__/page.test.tsx"
```

Expected: PASS (1 test).

- [ ] **Step 3.1.5: Commit**

```bash
git add "app/(public)/income-vehicles/page.tsx" "app/(public)/income-vehicles/__tests__/page.test.tsx"
git commit -m "$(cat <<'EOF'
Income vehicles hub Day 3: public /income-vehicles page

Server component. ISR revalidate=3600. Loads the full universe via
loadVehicleUniverse, embeds it in the page payload, hands it to three
LeaderboardCards (one per family) and the Screener client island.
Indexable; canonical, OpenGraph and metadata set.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 3.2 — Site nav + sitemap

**Files:**
- Modify: `dividendmapper/components/site-header.tsx`
- Modify: `dividendmapper/app/sitemap.ts`

- [ ] **Step 3.2.1: Edit `components/site-header.tsx`**

Replace the `BASE_NAV` constant:

```ts
const BASE_NAV = [
  { href: "/tools/retirement-calculator", label: "Retirement" },
  { href: "/tools/dcf-calculator", label: "DCF" },
  { href: "/scoring", label: "Resilience" },
  { href: "/income-vehicles", label: "Income vehicles" },
  { href: "/blog", label: "Research" },
];
```

- [ ] **Step 3.2.2: Edit `app/sitemap.ts`**

Find the block that pushes `/scoring`, `/reits`, `/bdcs`, `/uk-reits` family entries. Add a new entry for the hub at the same priority band:

```ts
entries.push({
  url: `${SITE_URL}/income-vehicles`,
  lastModified: new Date(),
  changeFrequency: "daily",
  priority: 0.8,
});
```

Place it immediately after the existing equity `/scoring` push (find it via `grep -n "/scoring" app/sitemap.ts`).

- [ ] **Step 3.2.3: Run the existing site-header + sitemap tests if any**

```bash
npx vitest run components/__tests__ app/__tests__ 2>&1 | tail -10
```

Expected: PASS — no regressions. (If no existing tests touch these files, no test runs; that's fine.)

- [ ] **Step 3.2.4: Commit**

```bash
git add components/site-header.tsx app/sitemap.ts
git commit -m "$(cat <<'EOF'
Income vehicles hub Day 3: nav + sitemap

Income vehicles slot in BASE_NAV between Resilience and Research; mobile
menu picks it up from the same array. Sitemap adds /income-vehicles at
priority 0.8, daily change frequency — same band as /scoring and the
existing per-family pages.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Day 3 end-of-day checklist

- [ ] `/income-vehicles/page.tsx` + RTL test committed.
- [ ] `BASE_NAV` updated; mobile menu picks up the new link automatically.
- [ ] Sitemap entry added.
- [ ] Local dev server (`npm run dev --prefix dividendmapper`) renders `http://localhost:3000/income-vehicles` end-to-end with seeded data.
- [ ] `npx vitest run --no-file-parallelism lib/scoring/ lib/portfolio/ "app/(public)/income-vehicles"` green.

---

## Day 4 — In-app hub + holdings/watchlist toggle

**Outcome.** Pro users get `/app/income-vehicles` with a drawer-nav entry. The "Show only my holdings / watchlist" toggle narrows the screener results against the signed-in user's tickers. Free users are redirected to `/pricing`.

### Task 4.1 — In-app hub page + drawer nav

**Files:**
- Create: `dividendmapper/app/app/income-vehicles/page.tsx`
- Modify: `dividendmapper/app/app/_components/shell/nav-items.ts`

- [ ] **Step 4.1.1: Add the drawer-nav entry**

Edit `dividendmapper/app/app/_components/shell/nav-items.ts`. Find the `DEFAULT_NAV_ITEMS` array. Insert a new entry between `Portfolio Manager` and `Watchlist`:

```ts
import { ListFilter } from "lucide-react";

// ... in DEFAULT_NAV_ITEMS, between Portfolio Manager and Watchlist:
  { href: "/app/income-vehicles", label: "Income vehicles", icon: ListFilter },
```

Make sure `ListFilter` is imported at the top of the file (alongside the other lucide imports).

- [ ] **Step 4.1.2: Create the page**

Create `dividendmapper/app/app/income-vehicles/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadVehicleUniverse } from "@/lib/scoring/load-vehicle-universe";
import { PageHeader } from "../_components/page-header/page-header";
import { Screener } from "@/app/(public)/income-vehicles/_components/screener";

export const metadata: Metadata = {
  title: "Income vehicles",
  robots: { index: false, follow: false },
};

// Per the app/page auth guard reference memory entry — call requireUser()
// here too because soft navs do not re-run the layout guard.
export const dynamic = "force-dynamic";

export default async function AppIncomeVehiclesHubPage() {
  const user = await requireUser("/app/income-vehicles");
  const supabase = await createSupabaseServerClient();

  // Pro-only gate. Free users go to pricing with the same pattern as the
  // existing Portfolio Manager page.
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle<{ tier: "free" | "pro" | "premium" }>();
  const tier = (profile?.tier ?? "free") as "free" | "pro" | "premium";
  if (tier === "free") redirect("/pricing?cta=screener");

  const universe = await loadVehicleUniverse(supabase);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12">
      <PageHeader
        title="Income vehicles"
        subtitle={`${universe.length} scored vehicles across REITs, BDCs and UK REITs. Filter, search, and pick names that fit your portfolio.`}
        betaPill
      />
      <Screener universe={universe} showSaveScreenAction />
    </div>
  );
}
```

> **Note:** The "Show only my holdings / watchlist" toggle is added in Task 4.2 — this page lands first as a clean Pro-gated mount of the existing Screener with the save-screen action active.

- [ ] **Step 4.1.3: Smoke-test in a browser**

```bash
npm run dev --prefix dividendmapper
```

Open `http://localhost:3000/app/income-vehicles` signed in as a Pro user. Expect the screener to render. Sign out (or use a free fixture) — expect a redirect to `/pricing?cta=screener`.

- [ ] **Step 4.1.4: Commit**

```bash
git add app/app/income-vehicles/page.tsx app/app/_components/shell/nav-items.ts
git commit -m "$(cat <<'EOF'
Income vehicles hub Day 4: /app/income-vehicles Pro-only page + drawer nav

Server component, requireUser() guard, free-tier redirect to /pricing
mirrors the Portfolio Manager pattern. Reuses Screener from the public
hub with showSaveScreenAction enabled so the save button appears
(wire-up of the actual save flow is Day 5). Drawer-nav entry slots
between Portfolio Manager and Watchlist; lucide ListFilter icon.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 4.2 — Holdings / watchlist toggle

The Screener already handles its own filter state. The toggle is a Pro-only affordance that overlays an additional ticker-set filter. The clean way to plumb it through without coupling Screener to user data: pass an optional `restrictToTickers` prop to Screener that, when set, narrows the displayed universe to those tickers BEFORE the filter/search chain runs.

**Files:**
- Modify: `dividendmapper/app/(public)/income-vehicles/_components/screener.tsx`
- Modify: `dividendmapper/app/app/income-vehicles/page.tsx`
- Modify: `dividendmapper/app/(public)/income-vehicles/_components/__tests__/screener.test.tsx`

- [ ] **Step 4.2.1: Add a test for the new toggle**

Add at the end of the `describe("<Screener>", ...)` block in `screener.test.tsx`:

```tsx
  it("when ownedTickers is set, the holdings toggle narrows the universe to those tickers", async () => {
    const user = userEvent.setup();
    render(
      <Screener
        universe={UNIVERSE}
        showSaveScreenAction
        ownedTickers={["MAIN"]}
      />,
    );
    // Toggle is off by default — full universe shows.
    expect(screen.getByText("O")).toBeInTheDocument();
    expect(screen.getByText("MAIN")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /Only my holdings/ }));
    expect(screen.getByText("MAIN")).toBeInTheDocument();
    expect(screen.queryByText("O")).not.toBeInTheDocument();
    expect(screen.queryByText("BLND.L")).not.toBeInTheDocument();
  });
```

- [ ] **Step 4.2.2: Run the test to verify it fails**

```bash
npx vitest run "app/(public)/income-vehicles/_components/__tests__/screener.test.tsx"
```

Expected: FAIL with `ownedTickers` unknown prop or missing checkbox.

- [ ] **Step 4.2.3: Extend the Screener**

Edit `dividendmapper/app/(public)/income-vehicles/_components/screener.tsx`:

1. Add to the `ScreenerProps` interface:

```ts
  /**
   * When provided, the "Only my holdings" toggle is rendered in the filter
   * strip. When the toggle is on, the universe is narrowed to these tickers
   * before filter + search + sort run. Pro-only surface (passed by /app/...).
   */
  ownedTickers?: ReadonlyArray<string>;
```

2. Add to the destructured props of `Screener`:

```ts
export function Screener({
  universe,
  showSaveScreenAction = false,
  ownedTickers,
}: ScreenerProps) {
```

3. Add a `useState` for the toggle near the top of the body:

```ts
  const [restrictToOwned, setRestrictToOwned] = useState(false);
```

4. Replace the `filtered = useMemo(...)` body to pre-restrict the universe:

```ts
  const filtered = useMemo(() => {
    const ownedSet =
      ownedTickers && restrictToOwned ? new Set(ownedTickers) : null;
    const visible = ownedSet
      ? universe.filter((r) => ownedSet.has(r.ticker))
      : universe;
    const byCriteria = filterVehicles(visible, criteria);
    const bySearch = searchVehicles(byCriteria, query);
    return sortVehicles(bySearch, "resilience", "desc");
  }, [universe, criteria, query, ownedTickers, restrictToOwned]);
```

5. Add the toggle into the filter strip JSX, immediately after the existing `Gate passed` label:

```tsx
          {ownedTickers && (
            <label className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
              <input
                type="checkbox"
                checked={restrictToOwned}
                onChange={(e) => setRestrictToOwned(e.target.checked)}
                aria-label="Only my holdings"
              />
              <span>Only my holdings</span>
            </label>
          )}
```

- [ ] **Step 4.2.4: Run the test to verify it passes**

```bash
npx vitest run "app/(public)/income-vehicles/_components/__tests__/screener.test.tsx"
```

Expected: PASS (4 tests).

- [ ] **Step 4.2.5: Wire ownedTickers in `/app/income-vehicles/page.tsx`**

Edit `dividendmapper/app/app/income-vehicles/page.tsx`:

1. Add to the imports:

```ts
import type { Tables } from "@/lib/supabase/types";
```

(If `Tables` doesn't exist, omit and use untyped queries.)

2. After the universe load, fetch the user's tickers in one round-trip:

```ts
  const [{ data: holdings }, { data: tracked }] = await Promise.all([
    supabase
      .from("portfolio_holdings")
      .select("ticker")
      .eq("user_id", user.id)
      .eq("archived", false),
    supabase.from("tracked_tickers").select("ticker").eq("user_id", user.id),
  ]);
  const ownedSet = new Set<string>();
  for (const row of (holdings ?? []) as { ticker: string }[]) ownedSet.add(row.ticker);
  for (const row of (tracked ?? []) as { ticker: string }[]) ownedSet.add(row.ticker);
  const ownedTickers = [...ownedSet];
```

3. Pass to the Screener:

```tsx
      <Screener
        universe={universe}
        showSaveScreenAction
        ownedTickers={ownedTickers}
      />
```

> **Schema note:** the table holding manual + CSV-imported holdings is `portfolio_holdings` and the watchlist table is `tracked_tickers`. Confirm at execution time by `grep -n "from(\"portfolio" lib/portfolio/load-priced-holdings.ts`. If a column name differs (e.g. `is_archived` instead of `archived`), match the existing query in `loadPricedHoldings`.

- [ ] **Step 4.2.6: Commit**

```bash
git add "app/(public)/income-vehicles/_components/screener.tsx" "app/(public)/income-vehicles/_components/__tests__/screener.test.tsx" app/app/income-vehicles/page.tsx
git commit -m "$(cat <<'EOF'
Income vehicles hub Day 4: holdings/watchlist toggle

Screener accepts an optional ownedTickers prop; when set, a fourth filter
appears in the strip ("Only my holdings"). Toggle on → universe is
restricted to owned + watched tickers before filter/search/sort.

In-app page joins holdings + watchlist in one parallel pair of queries
and passes the union to Screener.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 4.3 — Per-row action icons (in-app only)

The spec lists `Add to watchlist` (star) + `Add to portfolio` (plus) on each row of the in-app screener. The `POST /api/portfolio/tracked-tickers` and `POST /api/portfolio/holdings` endpoints already exist (Sprint 4) — this is pure UI work.

**Files:**
- Modify: `dividendmapper/app/(public)/income-vehicles/_components/screener.tsx`

- [ ] **Step 4.3.1: Add an optional callback prop**

In `ScreenerProps`:

```ts
  /**
   * Pro-only: per-row "add to watchlist" + "add to portfolio" icons appear
   * when this is true. Wired through to the existing tracked-tickers and
   * holdings POST endpoints. No-op on the public surface.
   */
  showRowActions?: boolean;
```

Add to the destructure:

```ts
export function Screener({
  universe,
  showSaveScreenAction = false,
  ownedTickers,
  showRowActions = false,
}: ScreenerProps) {
```

- [ ] **Step 4.3.2: Add an Actions column when showRowActions is true**

Add to the imports at the top:

```ts
import { Star, Plus } from "lucide-react";
```

In the `<thead>`, add a final `<th>` (conditional):

```tsx
                {showRowActions && (
                  <th scope="col" className="w-px px-3 py-2 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
```

In each `<tr>`, add a final `<td>` (conditional):

```tsx
                  {showRowActions && (
                    <td className="w-px whitespace-nowrap px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          aria-label={`Add ${r.ticker} to watchlist`}
                          onClick={async (e) => {
                            e.stopPropagation();
                            await fetch("/api/portfolio/tracked-tickers", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ ticker: r.ticker }),
                            });
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <Star className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Add ${r.ticker} to portfolio`}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Holdings add needs quantity + cost — kick the user
                            // to the existing add-holding modal on the Ledger
                            // page with the ticker prefilled.
                            window.location.href = `/app/portfolio?addTicker=${encodeURIComponent(r.ticker)}`;
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  )}
```

- [ ] **Step 4.3.3: Pass the flag from the /app page**

Edit `/app/income-vehicles/page.tsx` — extend the Screener call:

```tsx
      <Screener
        universe={universe}
        showSaveScreenAction
        ownedTickers={ownedTickers}
        showRowActions
      />
```

- [ ] **Step 4.3.4: Run the existing Screener test sweep**

```bash
npx vitest run "app/(public)/income-vehicles/_components/__tests__/screener.test.tsx"
```

Expected: PASS (still 4 — the action icons are hidden by default in the existing fixtures).

- [ ] **Step 4.3.5: Commit**

```bash
git add "app/(public)/income-vehicles/_components/screener.tsx" app/app/income-vehicles/page.tsx
git commit -m "$(cat <<'EOF'
Income vehicles hub Day 4: per-row action icons (in-app only)

Star button POSTs to /api/portfolio/tracked-tickers; plus button
navigates to /app/portfolio with ?addTicker=<TICKER> to reuse the
existing add-holding modal (which needs quantity + cost — not solvable
from one click on the screener).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Day 4 end-of-day checklist

- [ ] `/app/income-vehicles/page.tsx` renders for Pro, redirects free → /pricing.
- [ ] Drawer-nav entry visible in the /app shell.
- [ ] "Only my holdings" toggle filters against seeded vehicle holdings (O, MAIN, BLND.L, SGRO.L).
- [ ] Per-row star + plus icons render in `/app/income-vehicles` and not on the public hub.
- [ ] `npx vitest run --no-file-parallelism "app/(public)/income-vehicles" lib/scoring/ lib/portfolio/` green.

---

## Day 5 — Saved screens (migration + API + rail)

**Outcome.** Pro users can save a filter combination and recall it. One new table, one new REST endpoint, one new left-rail component.

### Task 5.0 — (Conditional) backfill `vehicle_universe.dividend_yield` + `leverage_headline`

Skip this task if those two columns already exist on `vehicle_universe`. Confirm with:

```bash
grep -nE "dividend_yield|leverage_headline" dividendmapper/supabase/migrations/00*.sql
```

If absent, add a small `ALTER TABLE` migration **before** the saved-screens one (use `0019_vehicle_universe_yield_headline.sql`, bump saved-screens to `0020_saved_screens.sql`).

The cron daily run (`scripts/scoring/score-vehicles.ts` or similar) writes these. Confirm the cron's UPSERT covers them; if not, append the two columns to the upsert payload in that script. Out of scope for code diffs here — flag as a one-line follow-up if it isn't already populating.

### Task 5.1 — Migration `0019_saved_screens.sql`

**Files:**
- Create: `dividendmapper/supabase/migrations/0019_saved_screens.sql`

- [ ] **Step 5.1.1: Write the migration**

Create `dividendmapper/supabase/migrations/0019_saved_screens.sql`:

```sql
-- Income vehicles hub Day 5: saved-screen storage.
-- Pro members save filter combinations and a name; the in-app hub renders
-- the list in a left rail. One row per saved screen. RLS keeps each user's
-- screens private to their own auth.uid().
--
-- Apply via:  cd dividendmapper && npx supabase db push --dry-run
--             cd dividendmapper && npx supabase db push --yes

create table public.saved_screens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  filter_state jsonb not null,
  created_at   timestamptz not null default now()
);

create index saved_screens_user_id_idx on public.saved_screens (user_id, created_at desc);

alter table public.saved_screens enable row level security;

create policy "saved_screens_select_own"
  on public.saved_screens for select
  using (auth.uid() = user_id);

create policy "saved_screens_insert_own"
  on public.saved_screens for insert
  with check (auth.uid() = user_id);

create policy "saved_screens_delete_own"
  on public.saved_screens for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 5.1.2: Dry-run + apply**

```bash
cd dividendmapper && npx supabase db push --dry-run
```

Expect the migration to be reported clean. If it errors, fix and re-run.

Then (with Glenn's go-ahead):

```bash
cd dividendmapper && set -a && source .env.local && set +a && npx supabase db push --yes
```

> **Memory pointer:** if `db push --yes` jams because of out-of-order migrations, apply via the Management API + `migration repair --status applied` per the supabase-out-of-order-migration-workaround memory entry.

- [ ] **Step 5.1.3: Commit**

```bash
git add supabase/migrations/0019_saved_screens.sql
git commit -m "$(cat <<'EOF'
Income vehicles hub Day 5: 0019 saved_screens table + RLS

One row per saved screen; user_id FK to auth.users with cascade delete.
filter_state jsonb captures the four ScreenerCriteria fields. Index on
(user_id, created_at desc) for the rail's fetch. RLS scoped to
auth.uid() = user_id for select / insert / delete.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 5.2 — `/api/screens` route

**Files:**
- Create: `dividendmapper/app/api/screens/route.ts`
- Test: `dividendmapper/app/api/screens/__tests__/route.test.ts`

- [ ] **Step 5.2.1: Write the failing test**

Create `dividendmapper/app/api/screens/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { POST, GET } from "../route";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function makeReq(body: unknown): Request {
  return new Request("http://x/api/screens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/screens", () => {
  it("returns 401 when there is no signed-in user", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getClaims: async () => ({ data: { claims: null }, error: null }) },
    } as any);
    const res = await POST(
      makeReq({ name: "test", filterState: { family: "all" } }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when the user is not Pro", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getClaims: async () => ({ data: { claims: { sub: "u1" } }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { tier: "free" }, error: null }),
          }),
        }),
      }),
    } as any);
    const res = await POST(
      makeReq({ name: "test", filterState: { family: "all" } }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects invalid input with 400", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        getClaims: async () => ({ data: { claims: { sub: "u1" } }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { tier: "pro" }, error: null }),
          }),
        }),
      }),
    } as any);
    const res = await POST(makeReq({ name: "" }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 5.2.2: Run the test to verify it fails**

```bash
npx vitest run app/api/screens/__tests__/route.test.ts
```

Expected: FAIL with `Cannot find module '../route'`.

- [ ] **Step 5.2.3: Implement the route**

Create `dividendmapper/app/api/screens/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScreenInput {
  name: string;
  filterState: Record<string, unknown>;
}

function validate(body: unknown):
  | { ok: true; value: ScreenInput }
  | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "invalid_input" };
  }
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name.length < 1 || name.length > 80) {
    return { ok: false, error: "invalid_name" };
  }
  if (typeof b.filterState !== "object" || b.filterState === null) {
    return { ok: false, error: "invalid_filter_state" };
  }
  return {
    ok: true,
    value: { name, filterState: b.filterState as Record<string, unknown> },
  };
}

async function requirePro(supabase: any): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string }
> {
  const { data: claimsRes } = await supabase.auth.getClaims();
  const userId = claimsRes?.claims?.sub as string | undefined;
  if (!userId) return { ok: false, status: 401, error: "unauthenticated" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .maybeSingle();
  const tier = (profile?.tier ?? "free") as "free" | "pro" | "premium";
  if (tier === "free") return { ok: false, status: 403, error: "pro_required" };
  return { ok: true, userId };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePro(supabase);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { data, error } = await supabase
    .from("saved_screens")
    .select("id, name, filter_state, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  return NextResponse.json({ screens: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePro(supabase);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const result = validate(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("saved_screens")
    .insert({
      user_id: auth.userId,
      name: result.value.name,
      filter_state: result.value.filterState,
    })
    .select("id, name, filter_state, created_at")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ screen: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const auth = await requirePro(supabase);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { error } = await supabase
    .from("saved_screens")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 5.2.4: Run the test to verify it passes**

```bash
npx vitest run app/api/screens/__tests__/route.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5.2.5: Commit**

```bash
git add app/api/screens/route.ts app/api/screens/__tests__/route.test.ts
git commit -m "$(cat <<'EOF'
Income vehicles hub Day 5: /api/screens route

GET lists, POST creates, DELETE removes — all Pro-gated via the shared
requirePro helper. 401 for anon, 403 for free, 400 for invalid input.
Insert returns the new row at 201; delete returns 204. RLS at the
saved_screens table layer is the second line of defence.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 5.3 — `<SavedScreensRail>` + wire-up

The rail is rendered alongside the screener inside `/app/income-vehicles`. V1 ships read + delete only; the SAVE action (button in the Screener) is wired up to POST + refresh the rail.

**Files:**
- Create: `dividendmapper/app/app/income-vehicles/_components/saved-screens-rail.tsx`
- Modify: `dividendmapper/app/app/income-vehicles/page.tsx`

- [ ] **Step 5.3.1: Implement the rail**

Create `dividendmapper/app/app/income-vehicles/_components/saved-screens-rail.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

type SavedScreen = {
  id: string;
  name: string;
  filter_state: Record<string, unknown>;
  created_at: string;
};

export function SavedScreensRail({
  onApply,
}: {
  onApply: (filterState: Record<string, unknown>) => void;
}) {
  const [screens, setScreens] = useState<SavedScreen[] | null>(null);

  async function refresh() {
    const res = await fetch("/api/screens");
    const json = res.ok ? await res.json() : { screens: [] };
    setScreens((json.screens ?? []) as SavedScreen[]);
  }

  useEffect(() => {
    refresh().catch(() => setScreens([]));
  }, []);

  async function handleDelete(id: string) {
    await fetch(`/api/screens?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await refresh();
  }

  if (screens === null) {
    return (
      <aside className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Loading saved screens…
      </aside>
    );
  }
  if (screens.length === 0) {
    return (
      <aside className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
        Save a screen to recall the filter combination here.
      </aside>
    );
  }
  return (
    <aside className="rounded-xl border border-border bg-card p-3">
      <h3 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Saved screens
      </h3>
      <ul className="space-y-1">
        {screens.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-secondary"
          >
            <button
              type="button"
              onClick={() => onApply(s.filter_state)}
              className="flex-1 truncate text-left text-sm text-foreground hover:underline"
            >
              {s.name}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(s.id)}
              aria-label={`Delete ${s.name}`}
              className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 5.3.2: Wire the rail + save flow into the in-app page**

The rail needs to drive Screener's state via `onApply`. Since both are client components and the page is server-side, introduce a small wrapper client component that holds the screener state and renders both. To avoid a major refactor of Screener, ship V1 with the rail and the SAVE button as separate client islands — the SAVE button inside Screener posts to `/api/screens` and triggers a window event the rail listens for.

Add to `dividendmapper/app/(public)/income-vehicles/_components/screener.tsx` in the body, inside the `<button>` that renders when `showSaveScreenAction` is true:

Replace the existing Save button with:

```tsx
            <button
              type="button"
              onClick={async () => {
                const name = window.prompt("Name this screen:");
                if (!name) return;
                const res = await fetch("/api/screens", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, filterState: criteria }),
                });
                if (res.ok) {
                  window.dispatchEvent(new Event("dm:saved-screens-changed"));
                } else {
                  window.alert("Couldn't save the screen. Try again.");
                }
              }}
              className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary"
            >
              Save this screen
            </button>
```

Add to `saved-screens-rail.tsx`, inside `useEffect`, listen for the event:

```tsx
  useEffect(() => {
    refresh().catch(() => setScreens([]));
    const handler = () => {
      void refresh();
    };
    window.addEventListener("dm:saved-screens-changed", handler);
    return () => window.removeEventListener("dm:saved-screens-changed", handler);
  }, []);
```

Now wire the rail into `/app/income-vehicles/page.tsx`. Replace the body return with:

```tsx
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12">
      <PageHeader
        title="Income vehicles"
        subtitle={`${universe.length} scored vehicles across REITs, BDCs and UK REITs. Filter, search, and pick names that fit your portfolio.`}
        betaPill
      />
      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        <SavedScreensRail onApply={() => { /* V1 read+save only; apply lands V1.1 */ }} />
        <Screener
          universe={universe}
          showSaveScreenAction
          ownedTickers={ownedTickers}
        />
      </div>
    </div>
  );
```

Add `import { SavedScreensRail } from "./_components/saved-screens-rail";` at the top.

> **V1.1 follow-up:** `onApply` is a no-op for V1 because applying a saved filter to Screener's state requires lifting that state up to the page or threading it via context. V1 ships read + delete + save (POST + list). Glenn can recall a screen by visually inspecting the rail and re-setting filters. Apply lands V1.1 as a small refactor.

- [ ] **Step 5.3.3: Smoke-test in browser**

```bash
npm run dev --prefix dividendmapper
```

Open `/app/income-vehicles`, click "Save this screen", give it a name, expect the rail to refresh and show the new entry. Click the trash → expect it to disappear.

- [ ] **Step 5.3.4: Commit**

```bash
git add "app/(public)/income-vehicles/_components/screener.tsx" app/app/income-vehicles/_components/saved-screens-rail.tsx app/app/income-vehicles/page.tsx
git commit -m "$(cat <<'EOF'
Income vehicles hub Day 5: SavedScreensRail + save flow

V1 ships read + save + delete. Screener's Save button prompts for a
name and POSTs to /api/screens, then dispatches a window event the
rail listens for to refetch. Apply-from-rail is a V1.1 follow-up that
needs a small Screener state lift.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Day 5 end-of-day checklist

- [ ] `0019_saved_screens.sql` applied to prod via supabase CLI.
- [ ] `/api/screens` GET / POST / DELETE return correct status codes for anon / free / Pro.
- [ ] In-app hub renders the rail; save flow round-trips end-to-end.
- [ ] Full sweep: `npx vitest run --no-file-parallelism` green.

---

## Day 6 — Telemetry + verify + PR

**Outcome.** PostHog custom events fire. Preview MCP confirms the surfaces work in production-shape. PR opened.

### Task 6.1 — PostHog custom events

**Files:**
- Modify: `dividendmapper/app/(public)/income-vehicles/_components/screener.tsx`

The `captureClientEvent` helper already exists (Sprint 4). Wire four events.

- [ ] **Step 6.1.1: Add the events**

In `screener.tsx`, add at the top of the file:

```ts
import { captureClientEvent } from "@/lib/analytics/posthog-capture";
```

Inside the `Screener` body, add a debounced search-event effect (after the `filtered = useMemo(...)`):

```ts
  useEffect(() => {
    if (query.trim().length === 0) return;
    const id = setTimeout(() => {
      captureClientEvent("income_vehicle_hub_search", {
        query: query.trim(),
        resultCount: filtered.length,
      });
    }, 500);
    return () => clearTimeout(id);
  }, [query, filtered.length]);
```

In the family-chip onClick handler, after `setCriteria(...)`:

```ts
                captureClientEvent("income_vehicle_hub_filter", {
                  family: f,
                  minResilience: criteria.minResilience,
                  subSector: criteria.subSector,
                  gatePassed: criteria.gatePassedOnly,
                });
```

In the results-table row `<Link>`, change to a click handler that fires the event then navigates:

Actually — keep the `<Link>` simple, but wrap the row click in an `onClick` that captures the event. Replace the `<tr>` body with a Link that has onClick:

```tsx
                <tr key={r.ticker} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 font-mono font-medium">
                    <Link
                      href={`/${familySlug(r.vehicleType)}/${r.ticker}`}
                      onClick={() => {
                        captureClientEvent("income_vehicle_hub_row_click", {
                          ticker: r.ticker,
                          vehicleType: r.vehicleType,
                        });
                      }}
                      className="hover:underline"
                    >
                      {r.ticker}
                    </Link>
                  </td>
                  {/* ... rest unchanged */}
```

In the save flow handler (the inline arrow function in the Save button onClick), after `res.ok`:

```ts
                  captureClientEvent("income_vehicle_hub_save_screen", {
                    filterState: criteria,
                    name,
                  });
```

- [ ] **Step 6.1.2: Re-run the screener test suite**

```bash
npx vitest run "app/(public)/income-vehicles/_components/__tests__/screener.test.tsx"
```

Expected: PASS (still 4). `captureClientEvent` no-ops in tests because `window` is jsdom and PostHog isn't initialised.

- [ ] **Step 6.1.3: Commit**

```bash
git add "app/(public)/income-vehicles/_components/screener.tsx"
git commit -m "$(cat <<'EOF'
Income vehicles hub Day 6: PostHog custom events

income_vehicle_hub_search (debounced 500ms), _filter (filter strip
changes), _row_click (table row link clicks), _save_screen (Pro save
flow). All wired through the Sprint 4 captureClientEvent helper.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 6.2 — Preview MCP verification

After Vercel deploys the PR preview, run the verification workflow per the preview_tools system block. This is interactive — do it in the browser, not blindly.

- [ ] **Step 6.2.1: Start the preview**

```bash
# In the worktree (or Glenn does it from the dashboard).
npm run dev --prefix dividendmapper
```

Then use `preview_start` to open the dev server in the in-chat browser.

- [ ] **Step 6.2.2: Run the checklist**

- Open `/income-vehicles` anonymously at desktop width (1440px). Hero, three leaderboards, filter strip, table.
- Resize to mobile (380px). Leaderboards stack, filter strip wraps, table allows horizontal scroll.
- Type "british" in the search → expect BLND.L to be the only row.
- Click the BDCs chip → expect only BDC rows.
- Click a row → expect navigation to the per-ticker page; `income_vehicle_hub_row_click` event lands in PostHog.
- Sign in as Glenn (Pro). Open `/app/income-vehicles`. Save a screen called "high-resilience UK REITs" with the filter set to UK REITs + Resilience ≥ 70. Expect the rail to update; `income_vehicle_hub_save_screen` event lands in PostHog.

- [ ] **Step 6.2.3: Lighthouse + payload check**

Take a Lighthouse run against the deployed preview. Note LCP, TBT, total page weight. Compare to the existing `/reits` page (deployed Sprint 3) — the hub should be within ±10% on LCP and total payload.

Paste the screenshot of the Lighthouse panel into the PR description.

### Task 6.3 — PR

- [ ] **Step 6.3.1: Rebase**

```bash
cd dividendmapper/.worktrees/income-vehicles-hub && git fetch origin && git rebase origin/main
```

- [ ] **Step 6.3.2: Push**

```bash
git push -u origin feature/income-vehicles-hub
```

- [ ] **Step 6.3.3: Open the PR**

```bash
gh pr create --base main --head feature/income-vehicles-hub --title "Income vehicles hub" --body "$(cat <<'EOF'
## Summary

- New public hub at `/income-vehicles` — search-first, three family leaderboards, filter strip (family chips, min-resilience, sub-sector, gate-passed), results table. ISR `revalidate=3600`. Crawlable; sitemap entry at 0.8. Embedded universe (~3 KB gzipped) drives instant client-side filter + search.
- New in-app peer at `/app/income-vehicles` — Pro-only, drawer-nav entry between Portfolio Manager and Watchlist. Adds the "Only my holdings" toggle (joins holdings + watchlist), per-row action icons, the "Save this screen" flow.
- New saved-screens infrastructure — `0019_saved_screens.sql` migration with RLS, `/api/screens` GET + POST + DELETE, `<SavedScreensRail>` client component.
- Telemetry — four new PostHog events (`income_vehicle_hub_search` debounced, `_filter`, `_row_click`, `_save_screen`).

## Tests

- 30+ new tests across the new helpers (filterVehicles/searchVehicles/sortVehicles), the LeaderboardCard, the Screener (filter + search + holdings-toggle), and the `/api/screens` route.
- Full sweep green: `npx vitest run --no-file-parallelism`.

## Test plan

- [ ] `/income-vehicles` desktop + mobile snapshots in the PR description.
- [ ] Clicking a leaderboard row navigates to the per-ticker page; PostHog `income_vehicle_hub_row_click` event captured.
- [ ] `/app/income-vehicles` Pro-only: Glenn's free fixture redirects to `/pricing?cta=screener`.
- [ ] "Only my holdings" toggle narrows the universe to the 4 seeded vehicle holdings.
- [ ] Save screen flow round-trips end-to-end via `/api/screens`.
- [ ] Lighthouse for the hub stays within ±10% of `/reits` on LCP + payload (screenshot in PR).

## Out of scope (V1.1 backlog)

- Apply-from-rail (clicking a saved screen restores its filter state).
- Sub-sector landing pages.
- Side-by-side comparison view.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Day 6 end-of-day checklist

- [ ] PostHog events firing in the deployed preview.
- [ ] PR opened; CI green; Vercel preview link reachable.
- [ ] Lighthouse panel screenshot pasted into the PR body.
- [ ] Glenn confirms the surfaces before merge.

---

## Sprint Verify

```bash
# Full vitest sweep — expect ≥ 1410 tests (Sprint 4 close-out 1373 + new).
cd dividendmapper && npx vitest run --no-file-parallelism 2>&1 | tail -5

# Public hub indexability check.
curl -s -o /dev/null -w "%{http_code}\n" https://dividendmapper.com/income-vehicles
# expect 200 once deployed.

# /api/screens auth probe — replace COOKIE with a real session if probing live.
curl -s -o /dev/null -w "%{http_code}\n" https://dividendmapper.com/api/screens
# expect 401 (anon).

# Sentry — last 24h, by route.
gh api repos/grodgers1-ctrl/dividendmapper/issues?labels=sentry --jq 'length'
# expect 0 (or only known/already-handled noise).
```

```sql
-- Saved-screen smoke (run as Glenn against prod after first save):
select count(*) from public.saved_screens where user_id = auth.uid();
-- expect ≥ 1 after Day 5 manual test.

-- Cron freshness — same as Sprint 4.
select 'prices' as kind, max(observed_at)::text from vehicle_prices
union all
select 'scores', max(computed_at)::text from vehicle_scores;
-- expect both within the last 24h.
```

---

## Carry-forward to V1.1

After this lands, the hub V1 ships. Pending follow-ups:

1. **Apply-from-rail** — clicking a saved screen restores the filter state. Small refactor lifting Screener's state to the page or a context. ~2 hours.
2. **Sub-sector landing pages** — `/income-vehicles/healthcare-reits`, `/income-vehicles/internally-managed-bdcs`. SEO long-tail. ~4 hours including SEO copy.
3. **Side-by-side comparison view** — pick 2-3 tickers from the table, get a full per-signal comparison. ~1 day.
4. **CSV export** — client-side generation from the filtered set. ~1 hour.
5. **Personalised "screens you might like" suggestions** — based on the user's holdings sub-sector mix. Pro power-user feature. Out of scope until V1.1 has user-research validation.

---

## References

- Spec: [planning/specs/2026-06-24-income-vehicles-hub-design.md](../specs/2026-06-24-income-vehicles-hub-design.md)
- Phase 4 plan: [planning/08-phase-4-income-vehicle-scoring.md](../08-phase-4-income-vehicle-scoring.md)
- Sprint 4 shipped: [PR #24](https://github.com/grodgers1-ctrl/dividendmapper/pull/24)
- Existing patterns to mirror:
  - Equity scoring landing: `dividendmapper/app/(public)/scoring/page.tsx`
  - Public vehicle pages (Sprint 3): `dividendmapper/app/(public)/reits/[ticker]/page.tsx`
  - Vehicle chip (Sprint 4 visual primitive): `dividendmapper/app/app/portfolio/_components/vehicle-chip.tsx`
  - Drawer-nav: `dividendmapper/app/app/_components/shell/nav-items.ts`
  - `requireUser()` + tier redirect: `dividendmapper/app/app/portfolio/scoring/page.tsx`
  - Sprint 4 PostHog wire-up: `dividendmapper/lib/analytics/posthog-capture.ts`
