# Income vehicles hub — design

**Date:** 2026-06-24
**Author:** Glenn + Claude
**Status:** Approved for plan-writing
**Supersedes:** none
**Related:** [planning/08-phase-4-income-vehicle-scoring.md](../08-phase-4-income-vehicle-scoring.md), [planning/plans/2026-06-24-phase-4-sprint-4-days-22-25.md](../plans/2026-06-24-phase-4-sprint-4-days-22-25.md)

## Problem

Phase 4 shipped `/reits`, `/bdcs`, `/uk-reits` as sibling top-level routes plus a methodology page. There is no hub. The site header nav links `/scoring` (equity resilience) but not the vehicle family pages, which means a visitor has to know the URL or follow a sitemap link to find the new product. Glenn's brief: *"a new page that holds the investment vehicle stuff … easily searchable for the user and not so hidden."*

## Goals

1. **Discoverability** — the vehicle resilience product gets a single, clearly-labelled URL surfaced in the marketing nav.
2. **Search-first UX** — primary user job is "look up a name", with browse (leaderboards) and filter (screener) as secondary affordances.
3. **Forward-compatible** — adding a fourth vehicle family later (e.g. closed-end funds) is a metadata edit, not a re-architecture.
4. **Free + crawlable + rate-limited where it matters** — the public hub is fully indexable, but click-through actions hitting `/api/vehicle-scoring/[ticker]` enforce the existing 60/hr/IP anon budget with a Pro-upsell soft wall.
5. **In-app peer** — Pro users get a richer screener at `/app/income-vehicles` integrated with their holdings + watchlist.

## Non-goals

- Sub-sector landing pages (`/income-vehicles/healthcare-reits`) — V1.1 SEO long-tail backlog item.
- Two-ticker comparison view — V1.1 backlog item, kept separate so the hub stays single-purpose.
- A merged equity+vehicle "super hub" replacing `/scoring`. Confirmed during brainstorming: keep them separate, peer surfaces, peer nav slots.
- Visual snapshot tests for the leaderboards.

## Architecture + IA

Two surfaces, same data layer, one shared component primitive.

### Public hub — `/income-vehicles`

- **Route:** `/income-vehicles` under `app/(public)/`. Server component, ISR `revalidate = 3600` (matches `/scoring`).
- **Tier-gate:** anonymous-readable. Crawlable. In the sitemap at priority `0.8` (same band as `/scoring`, `/reits`, `/bdcs`, `/uk-reits`).
- **Rate-limit behaviour:**
  - Static render is served from Vercel's CDN — zero per-visitor rate-limit relevance.
  - Client-side search and filter run in-memory against the embedded universe — zero API calls, zero rate-limit relevance.
  - Click-through to per-ticker detail still flows through `/api/vehicle-scoring/[ticker]` (already 60/hr/IP for anon, Sprint 3). Past budget → Pro-upsell soft wall: *"You've used your free lookups for the hour. Pro unlocks unlimited screening + saved filters."*
  - Pro-only actions (Save screen, Compare 3 tickers, CSV export beyond a free row cap) show a lock icon with a CTA inline.
- **Site nav:** new link `Income vehicles` in `components/site-header.tsx` `BASE_NAV` between `Resilience` and `Research`. Mobile menu picks it up from the same array.
- **OG image:** reuse the existing per-family OG generator pattern. Hub OG: headline + 3-up of family vehicle counts.

### In-app hub — `/app/income-vehicles`

- **Route:** `/app/income-vehicles` under `app/app/`. Pro-tier only — free users redirect to `/pricing` with a "Pro unlocks the screener" hint, mirroring the existing `/app/portfolio/scoring` pattern.
- **Drawer-nav placement:** new entry in `app/app/_components/shell/nav-items.ts` between `Portfolio Manager` and `Watchlist`. Icon: `ListFilter` (lucide).
- **Deltas vs the public hub:**
  - No rate limit.
  - "Show only my holdings / watchlist" toggle in the hero, joins the screener results against the user's tickers.
  - "Save this screen" — persists filter combinations to a new `saved_screens` table (columns: `id uuid pk`, `user_id uuid fk`, `name text`, `filter_state jsonb`, `created_at timestamptz`), surfaces them in a left-rail panel inside `/app/income-vehicles` (not inside the drawer-nav itself).
  - Per-row action icons: add to watchlist (star), add to portfolio (plus).
  - Compare mode (V1.1 — out of scope for this design, but the row-selection scaffold is built so V1.1 only adds a side-by-side view).

## Page composition

Order from top to bottom on both surfaces:

1. **Hero block** — H1, sub-tagline, big search input (placeholder: *"Search by ticker or name — e.g. O, MAIN, British Land"*), microstat strip (*"102 scored vehicles · 3 families · updated daily at 09:00 UTC"*).
2. **Three family leaderboards** in a 3-column grid — Top 10 US REITs / US BDCs / UK REITs by Resilience desc. Each row is `ticker · display_name` + Resilience chip. On mobile the grid stacks. Quality-gate-failed vehicles are excluded from leaderboards.
3. **Filter strip** — sticky on scroll. Family pills (All / REITs / BDCs / UK REITs), Resilience min slider (a chip with a popover), Sub-sector dropdown (sourced from `vehicle_universe.sub_sector` distinct values), Gate-passed toggle.
4. **Results table** — ticker, name, sub-sector, Resilience chip, dividend yield. Header row shows the count ("Filtered results — 23 vehicles") and the "Save screen (Pro)" pill or button depending on tier. Defaults to Resilience desc; clicking a column header sorts.
5. **Soft wall** — only renders for anon viewers who have hit the rate limit; otherwise omitted. Standard Pro CTA panel.
6. **Footer** — methodology link, disclaimer, sitemap.

In-app version replaces (5) with a left-rail saved-screens list and adds the holdings/watchlist toggle to (1).

## Data flow

### Server fetch on render

New helper:
```
loadVehicleUniverse(client: SupabaseClient): Promise<VehicleUniverseRow[]>
```
Sibling to the existing `loadVehicleScoresByTickers` in `lib/scoring/load-vehicle-score.ts`. One Supabase query joining `vehicle_scores + vehicle_universe`, returns all rows. Shape per row:

```
{
  ticker: string;
  vehicleType: "us_reit" | "us_bdc" | "uk_reit";
  displayName: string;
  subSector: string | null;
  resilienceScore: number | null;
  qualityGatePassed: boolean;
  dividendYield: number | null;       // decimal, e.g. 0.056 for 5.6%
  leverageHeadline: string;            // family-aware label e.g. "FFO payout 81%", "NII coverage 1.2×", "LTV 33%"
  computedAt: string;                  // ISO timestamp
}
```

Estimated payload: ~100 rows × ~120 bytes JSON ≈ **12 KB raw, ~3 KB gzipped**. Embedded in the page payload, not a separate API call. ISR caches the gzipped HTML at the edge — per-visitor cost is one CDN hit.

### Client-side filter + search

Pure functions in a new module `lib/portfolio/income-vehicle-screener.ts`:

- `filterVehicles(rows, criteria)` — returns the subset matching family chip + min-resilience + sub-sector + gate-passed.
- `searchVehicles(rows, query)` — case-insensitive prefix + substring on `ticker` + `displayName`. Exact ticker hit ranks first.

The hub's `useMemo` derives the displayed list from the embedded universe + current filter+search state. Zero network on keystroke.

### What still hits the API

- Per-ticker detail click → `/api/vehicle-scoring/[ticker]` (already exists, rate-limited).
- "Save screen" (Pro, in-app) → new `POST /api/screens` writes `{userId, name, filterState}` to a new `saved_screens` table. One-column migration + ~30-line route.
- "Export CSV" — client-side, generates from the embedded universe.

## Telemetry

PostHog `$pageview` is auto-captured by the existing provider. New custom events fired via the Sprint 4 `captureClientEvent` helper:

- `income_vehicle_hub_search` — `{query, resultCount}` (debounced 500ms after typing stops).
- `income_vehicle_hub_filter` — `{family, minResilience, subSector, gatePassed}` (fired on filter-strip change).
- `income_vehicle_hub_row_click` — `{ticker, vehicleType}` (fired before navigating to per-ticker page).
- `income_vehicle_hub_save_screen` — `{filterState, name}` (Pro, in-app only).

Existing `vehicle_pro_upsell_view` (Sprint 4) continues to fire when the soft-wall block mounts for an anon viewer.

## Testing

### Unit (vitest)

- `loadVehicleUniverse` — 3 tests (empty universe → empty array; row mapping; null `subSector` tolerated).
- `filterVehicles` — 5 tests (family chip; min-resilience; sub-sector; gate-passed; combined-no-matches).
- `searchVehicles` — 4 tests (exact ticker first; substring on displayName; case-insensitive; no match).
- `<LeaderboardCard>` — 1 test (renders top N rows per family in score-desc order).

### Page-level (vitest + RTL)

- Public hub — mounts with a fixture universe, asserts the three leaderboards render, types into search, asserts the table narrows.
- In-app hub — Pro fixture user; asserts the "Show only my holdings" toggle filters the table; free-tier redirect mirrors `/app/portfolio/scoring` test pattern.

### Preview MCP (after deploy)

- Public hub at desktop + mobile widths: hero, three leaderboards stack on mobile, filter strip stays usable.
- Anon row click → `/api/vehicle-scoring/[ticker]` fires; `income_vehicle_hub_row_click` lands in PostHog.
- Signed-in → `/app/income-vehicles` loads; "Show only my holdings" toggle filters the table against Glenn's seeded vehicles.
- Lighthouse on the public hub for the payload ground-truth promised during brainstorming.

### Not in scope

- Visual snapshot tests (matches Sprint 4 pattern).
- Rate-limit middleware tests on `/api/vehicle-scoring/[ticker]` (already covered by Sprint 3).
- Day-1 Save-screen flow tests — the feature ships behind a check; full coverage is the follow-up that adds `/api/screens`.

## File map

- **New**
  - `app/(public)/income-vehicles/page.tsx` — public hub server component.
  - `app/(public)/income-vehicles/_components/leaderboard-card.tsx` — family leaderboard primitive.
  - `app/(public)/income-vehicles/_components/screener.tsx` — client component holding search + filter + results table state.
  - `app/(public)/income-vehicles/_components/soft-wall.tsx` — anon-only rate-limit CTA.
  - `app/app/income-vehicles/page.tsx` — Pro-only in-app hub.
  - `app/app/income-vehicles/_components/saved-screens-rail.tsx` — left rail.
  - `lib/scoring/load-vehicle-universe.ts` — new server helper + tests.
  - `lib/portfolio/income-vehicle-screener.ts` — pure filter + search helpers + tests.
  - `app/api/screens/route.ts` — Pro save-screen endpoint.
  - `supabase/migrations/00XX_saved_screens.sql` — one-table migration. (`00XX` is a placeholder; plan-writing step assigns the next free migration number against the prod `supabase/migrations/` directory at execution time.)

- **Modified**
  - `components/site-header.tsx` — add `Income vehicles` to `BASE_NAV`.
  - `app/app/_components/shell/nav-items.ts` — add `/app/income-vehicles` entry.
  - `app/sitemap.ts` — add `/income-vehicles` at priority 0.8.

## Out of scope (V1.1 backlog)

- Sub-sector landing pages.
- Side-by-side comparison view.
- Personalised "screens you might like" suggestions.
- Closed-end funds / preferred stocks as a fourth family — metadata-only when it lands, but the universe model + tests stay 3-family for V1.

## Open questions

None at brainstorming close. Plan-writing step turns this into per-day tasks with the unit-test ordering.

## References

- Phase 4 plan: [planning/08-phase-4-income-vehicle-scoring.md](../08-phase-4-income-vehicle-scoring.md)
- Sprint 4 shipped: [PR #24](https://github.com/grodgers1-ctrl/dividendmapper/pull/24)
- Sprint 3 patterns (per-family pages, methodology, VehicleProDetail): `dividendmapper/app/(public)/_components/`
- Equity peer surface: `dividendmapper/app/(public)/scoring/page.tsx`
- `/app` drawer-nav: `dividendmapper/app/app/_components/shell/nav-items.ts`
