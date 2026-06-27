# Portfolio View Glow-Up — Design

**Goal:** Turn `/app/portfolio` from a flat spreadsheet into a premium, scannable income ledger. Logos and per-row sparklines give each holding visual identity; a beveled row treatment + whole-row click target give the table a "button-like" feel; redundant columns are demoted; quantity/cost rounding cleans up the dense numeric grid; and a global `30D · 1Y · 5Y` range toggle adds the long-arc price context dividend investors actually use.

**Why now:** The post-shell-redesign portfolio table reads as data, not product. The Scores column is empty for ~80% of a typical Pro user's rows (it only shows the vehicle resilience chip for REIT/BDC/UK-REIT tickers). The "everything looks the same" problem worsens as portfolios grow past ~20 holdings. The Glow-Up reclaims wasted column real estate, adds the visual liveliness that makes the ledger feel like a finished surface, and slots cleanly in front of the Phase 5 broker work (so when more brokers arrive, the row already looks ready for them).

**Related files:**
- [app/app/portfolio/page.tsx](../../dividendmapper/app/app/portfolio/page.tsx) — page entry
- [app/app/portfolio/_components/holdings-table.tsx](../../dividendmapper/app/app/portfolio/_components/holdings-table.tsx) — the table this spec rewrites
- [lib/portfolio/load-priced-holdings.ts](../../dividendmapper/lib/portfolio/load-priced-holdings.ts) — data loader (extends in this work)
- [app/(public)/_components/price-nav-sparkline.tsx](../../dividendmapper/app/(public)/_components/price-nav-sparkline.tsx) — server-rendered SVG sparkline pattern we reuse

---

## Decisions locked in this brainstorm

1. **Sparkline data path:** new `ticker_price_history` table, FMP `historical-price-full` one-time backfill, existing nightly cron extended to append today's close per ticker. Server-rendered SVG, no client JS. No 1D intraday.
2. **Sparkline ranges:** `30D · 1Y · 5Y` global toggle above the table (single source of truth, all rows redraw to the same window). `localStorage` persisted. Default `30D`.
3. **Logos:** logo.dev via `https://img.logo.dev/ticker/{TICKER}?token=…&size=64&retina=true&format=webp&fallback=404`. `LOGO_DEV_PUBLISHABLE_API_KEY` is a public token in env. Attribution: a single "Logos via logo.dev" line in the table footer.
4. **Logo fallback:** deterministic `<InitialsTile>` on 404 — HSL background hashed from ticker, 1–2 uppercase letters in display font, identical dimensions so the row never reflows.
5. **Vehicle resilience chip is killed from the row.** Replaced by the per-row sparkline. Resilience scores remain on `/app/portfolio/[ticker]` and `/app/portfolio/scoring`.
6. **Whole row is the click target** → `/app/portfolio/[ticker]`. Text-selection-aware (active selection cancels the click). Edit / Delete cluster stops propagation.
7. **Edit slot reserved.** The Actions column hover-reveals `[Edit] [Delete]`. Edit renders as a disabled placeholder button in this work; the real modal lands in a follow-up.
8. **Wrapper demoted from its own column** to a third muted line under the company name (`ISA · GBP`) **plus** dynamic wrapper-filter chips above the table when the user has 2+ wrappers.
9. **Quantity and Avg cost rounded to 2 dp** in the cell. Full precision retained as the `title` attribute so `994.790201` stays diagnosable on hover.
10. **Inline "% of portfolio" bar** behind the Value cell — 2-pixel-high brand-tinted fill, % of `Σ value` for the visible (filtered) row set.
11. **Sortable column headers** replace the standalone `<SortSelect>` on desktop. Mobile keeps the `<SortSelect>` (cards have no headers).
12. **Sticky desktop table header** with inverted bevel (top shadow, bottom highlight) when it floats above scrolled rows. Mobile cards untouched.
13. **Density toggle** (`comfortable` / `compact`) above the table. Compact reduces `<tr>` vertical padding only; no typography change. `localStorage` persisted. Default `comfortable`.
14. **Inset bevel row treatment** — 1px white-alpha top edge, 1px black-alpha bottom edge, hover deepens the bevel and lifts via `shadow-md`. Same class works in light and dark via CSS variables.
15. **All glow-up surface changes ship on Free.** Sparkline, logos, range toggle, density, sortable headers, % bar, beveled rows — every Free user sees them. The existing 5-holding cap and hidden-rows banner are untouched. The old in-row Upgrade pill in the Scores column disappears with the column.

---

## 1. Anatomy of a row (desktop)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ▣ PYPL          ▁▂▃▅▆▇▆▇        39       $54.90      $1,727     $16/yr   £7  …│
│     PayPal Hold…  (30D line)                          ▓░░░░░ 12%                │
│     ISA · GBP                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Column order, left to right:

| # | Header | Content | Notes |
|---|---|---|---|
| 1 | Ticker | 32×32 logo + ticker (mono-bold) + company name (muted) + `Wrapper · Currency` (muted, smaller) | Single clickable cell visually, but whole `<tr>` is the link. |
| 2 | (no header) | ~120×40 SVG sparkline | Range driven by global toggle. Last-point dot in `--color-brand-500`. Subtle linear-gradient fill under the line. |
| 3 | Quantity | `row.quantity.toFixed(2)` | `title={fullPrecision}` for fractional shares. Right-aligned, `font-mono tabular-nums`. |
| 4 | Avg cost | `formatMoney(row.avg_cost, row.cost_currency, { dp: 2 })` | Same `title` treatment for any value with > 2 dp underlying. Right-aligned. |
| 5 | Value | `formatMoney(value, currency)` + inline % of portfolio bar | Bar is a `::after` 2px tall fill behind the figure, width = `value / Σ(visibleValues)`. Capped at 100%. Brand-500 @ 12% alpha → transparent. Hidden when only one row is visible. |
| 6 | Income | `formatIncome(amount, currency)` | Unchanged formatting. Inherits new typography scale. |
| 7 | Received (12m) | `formatMoney(actual, currency)` | Unchanged. |
| 8 | Broker | `<BrokerCell>` | Unchanged. |
| 9 | (no header) | Hover-revealed `[Edit] [Delete]` cluster | Edit is `disabled` and `aria-disabled` in this work; click no-ops with a tooltip "Coming soon". |

Wrapper column from the current table is removed. Scores column from the current table is removed.

## 2. Above-table controls

Top-of-table chrome, left → right:

- **Wrapper filter chips** (only if `presentWrappers.size >= 2`): `All · ISA · SIPP · GIA` (UK) or `All · 401(k) · Roth IRA · Brokerage` (US). Derived from `new Set(rows.map(r => r.wrapper))` and sorted by a fixed display order so chips don't jump as holdings change. Active chip stored in URL as `?wrapper=isa` so a filtered view is shareable. `All` is the default and clears the param.
- **Range toggle** `30D · 1Y · 5Y`. Segmented control. `localStorage` key `dm.holdings-sparkline-range`. Default `30D`. Emits the same `dm:holdings-range-change` custom-event pattern as the existing sort hookup so SSR + `useSyncExternalStore` stays clean.
- **Density toggle** — icon button cycling `comfortable` / `compact`. `localStorage` key `dm.holdings-density`. Default `comfortable`.
- **Sort** — the existing `<SortSelect>` is removed on desktop. Column headers become click-to-sort with up/down chevrons (Ticker, Quantity, Avg cost, Value, Income, Received). Reuses the existing `dm.holdings-sort` key. Mobile still renders the `<SortSelect>` since cards have no headers.

## 3. Sparkline subsystem

### Table

```sql
create table public.ticker_price_history (
  ticker      text          not null,
  trade_date  date          not null,
  close       numeric(20,6) not null,
  currency    text          not null,
  primary key (ticker, trade_date)
);

create index ticker_price_history_recent_idx
  on public.ticker_price_history (ticker, trade_date desc);
```

- `currency` is the *display* unit FMP returns (`USD` for US, `GBp`/`GBX` for `.L`). No FX conversion stored. Currency is only used for the screen-reader description (the sparkline is a shape, the y-axis is unlabelled).
- Retention: a daily prune job (or nightly cron step) drops anything where `trade_date < CURRENT_DATE - 1300`. Keeps storage bounded at ~1,260 rows per ticker.
- RLS: read-only public. The table holds no user data — same posture as `equity_scores`.

### Backfill

New script `scripts/sanity/backfill-ticker-price-history.mjs`:

1. Build the distinct ticker universe: `(select distinct ticker from holdings) ∪ (select distinct ticker from watchlist) ∪ (select ticker from income_vehicle_scores)`.
2. For each ticker, call FMP `historical-price-full/{ticker}?serietype=line` (cheap variant — closes only).
3. Take the most recent ~1,260 daily closes, upsert into `ticker_price_history`.
4. Rate-limit to ~10 req/s to stay well inside the 750/min Premium ceiling.
5. Log per-ticker outcome (rows inserted, FMP miss, FX-suffix oddity) so the rerun script can target only the failures.

Expected one-time cost at ~5k tickers: ~7 minutes wall clock, ~5,000 FMP calls, ~250 MB on disk after ingestion.

### Nightly cron

Extend the existing nightly job (the one already updating `priceByTicker` for the Value column) to also append today's close per ticker to `ticker_price_history`. `INSERT … ON CONFLICT (ticker, trade_date) DO NOTHING` so a rerun the same day is a no-op.

### Render path

1. `loadPricedHoldings` already returns the distinct ticker list for the visible rows.
2. New helper `loadSparklineSeriesByTicker(supabase, tickers, range)` issues one Supabase query: `select ticker, trade_date, close from ticker_price_history where ticker = any($1) and trade_date >= $2 order by ticker, trade_date asc` where `$2 = CURRENT_DATE - {30 | 365 | 1825}`. Returns `Map<ticker, { points: number[], firstClose: number, lastClose: number, currency: string }>`.
3. New server component `<RowSparkline series points firstClose lastClose currency range />` renders pure SVG. Reuses the path-generation math from `price-nav-sparkline.tsx`.
4. 5Y downsampling: server-side every-Nth-point sampling to keep the path under ~100 points (`stride = Math.ceil(points.length / 100)`). Visually identical at row size. Upgrade to LTTB later only if a real artefact appears.
5. Tint: line stroke `var(--color-brand-500)`; fill is a `<linearGradient>` from `var(--color-brand-500)` @ 18% alpha to transparent.
6. Edge cases:
   - `< 8 points` → render the "Collecting…" pill currently used for pending scores. The nightly cron will fill it in.
   - Ticker missing from `ticker_price_history` entirely (e.g., just-added holding before the nightly cron has run) → same "Collecting…" pill.
   - All-flat line (no variance in window) → render a horizontal line at the mid-y, no gradient fill.

### A11y

Each sparkline gets `role="img"` with an `aria-label` like `"PayPal Holdings 30-day price line, started at $204.10, ended at $213.05"`. Screen readers ignore the SVG internals.

## 4. Logo subsystem

### Component

```tsx
// app/app/portfolio/_components/holding-logo.tsx
"use client";
import Image from "next/image";

export function HoldingLogo({ ticker, name, size = 32 }: {
  ticker: string;
  name?: string;
  size?: number;
}) {
  const [errored, setErrored] = useState(false);
  if (errored) return <InitialsTile ticker={ticker} name={name} size={size} />;
  return (
    <Image
      src={`https://img.logo.dev/ticker/${ticker}?token=${process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_API_KEY}&size=${size * 2}&retina=true&format=webp&fallback=404`}
      width={size}
      height={size}
      alt={`${name ?? ticker} logo`}
      className="rounded-md border border-border/40 bg-card"
      onError={() => setErrored(true)}
    />
  );
}
```

`unoptimized={false}` (default) so Next.js's `<Image>` runs the URL through its optimizer + edge cache → logo.dev only sees one cold request per ticker per edge-revalidation window. Realistic monthly logo.dev usage: a few hundred requests, well under the 500k free-tier ceiling.

### Initials tile

```tsx
// app/app/portfolio/_components/initials-tile.tsx (server component)
export function InitialsTile({ ticker, size = 32 }: { ticker: string; size?: number }) {
  const letters = ticker.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase();
  const hue = hashHue(ticker);            // deterministic 0-359
  return (
    <div
      role="img"
      aria-label={`${ticker} placeholder logo`}
      style={{
        width: size, height: size,
        backgroundColor: `hsl(${hue} 35% 28%)`,
        color: `hsl(${hue} 55% 88%)`,
      }}
      className="grid place-items-center rounded-md border border-border/40 font-display text-[11px] font-semibold"
    >
      {letters}
    </div>
  );
}
```

The `hashHue` helper is a pure function over the ticker string (e.g., FNV-1a → mod 360). Same ticker always gets the same colour.

### Config

- `LOGO_DEV_PUBLISHABLE_API_KEY` lives in `.env.local` (already added) and Vercel project env, exposed as `NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_API_KEY` so it can ship in the client HTML.
- Image domain allowlist: add `img.logo.dev` to `next.config.ts` under `images.remotePatterns`.
- Attribution: render once below the table.
  ```tsx
  <p className="mt-3 text-[11px] text-muted-foreground/70">
    Logos via{" "}
    <Link href="https://www.logo.dev" className="underline-offset-2 hover:underline">logo.dev</Link>
  </p>
  ```

## 5. Row interaction model

### Whole-row link

The row navigates to `/app/portfolio/${row.ticker}` on click. Implementation: `<tr>` carries `role="link"`, `tabIndex={0}`, `onClick`, and `onKeyDown` (Enter and Space activate). `cursor: pointer`. Hover state = bevel deepens + `shadow-md` + bg tint shift.

### Text-selection guard

```tsx
function rowClick(e: MouseEvent<HTMLTableRowElement>) {
  const sel = window.getSelection();
  if (sel && sel.toString().length > 0 && rowContains(sel.anchorNode, e.currentTarget)) {
    return; // user is selecting text, swallow the nav
  }
  router.push(`/app/portfolio/${row.ticker}`);
}
```

Cells with selectable numeric content (Avg cost, Value, Income, Received) explicitly get `select-text` so the OS-level selection behaviour feels normal.

### Actions cluster

Right-most cell is `relative` and contains a `flex` group with `[Edit] [Delete]`. The whole cell uses `event.stopPropagation()` on `click` / `keydown`. On desktop, the cluster is `opacity-0 group-hover:opacity-100 focus-within:opacity-100`; on touch (`@media (hover: none)`) it's always visible. Both buttons get keyboard focus rings consistent with the rest of the shell.

`Edit` is a placeholder in this work:
```tsx
<button
  type="button"
  aria-disabled="true"
  title="Edit coming soon"
  className="… cursor-not-allowed opacity-50"
  onClick={(e) => { e.stopPropagation(); /* no-op */ }}
>
  <Pencil className="h-4 w-4" aria-hidden />
</button>
```

When the real Edit modal lands, this button gets a real `onClick` — no layout change.

### Sticky header

```css
thead { position: sticky; top: var(--app-shell-topbar-height, 0px); z-index: 5; }
```

When scrolled, the header carries the *inverted* bevel — top shadow (black-alpha) + bottom highlight (white-alpha) — so it reads as a floating panel rather than a sunken row. The shell topbar height variable is already published by `app/app/_components/shell/topbar.tsx` (used by the drawer); we read it directly.

## 6. Free vs Pro

| Capability | Free | Pro |
|---|---|---|
| Beveled row treatment | ✓ | ✓ |
| Logos + initials fallback | ✓ | ✓ |
| Per-row sparkline | ✓ | ✓ |
| `30D · 1Y · 5Y` range toggle | ✓ | ✓ |
| Density toggle | ✓ | ✓ |
| Sortable column headers | ✓ | ✓ |
| Wrapper filter chips | ✓ | ✓ |
| % of portfolio bar | ✓ | ✓ |
| Whole-row click | ✓ | ✓ |
| Edit / Delete cluster | ✓ (Edit disabled for everyone in this work) | ✓ (Edit disabled in this work) |
| 5-holding cap | ✓ (unchanged) | n/a |
| Hidden-rows banner | ✓ (unchanged) | n/a |

The old in-row Upgrade pill (currently rendered by `<UpgradePill>` in the Scores column) disappears with the Scores column. The existing in-page nudges — hidden-rows banner, Personalisation wizard, Pricing CTA in the topbar — already carry the upgrade story. No new nudge needed in this work.

## 7. Mobile

Mobile keeps the card-list view (`md:hidden` in the current file). Each card inherits the Glow Up:

- Logo (40×40 on mobile, slightly larger than desktop's 32×32) + ticker + name + `Wrapper · Currency` second line on the left.
- Sparkline (~140×42) below the dl grid, full-card width.
- `Quantity / Avg cost / Value / Income / Received / Broker` in the existing 2-col `<dl>` — quantities and costs to 2 dp; Value cell carries the % of portfolio bar.
- Whole card is the link.
- Edit / Delete cluster always visible on the right of the header row (no hover affordance on touch).
- No sticky header (cards don't have one). Above-card controls (wrapper chips, range, density, sort) collapse into a single "View" disclosure summary so they don't dominate small screens.

## 8. Component changes

| File | Change |
|---|---|
| [app/app/portfolio/_components/holdings-table.tsx](../../dividendmapper/app/app/portfolio/_components/holdings-table.tsx) | Heavy rewrite. Drops Scores + Wrapper columns; adds Logo, Sparkline, % of portfolio bar; adopts new bevel + hover-lift; whole-row link; sortable headers. Splits into `<HoldingsTable>` (orchestration) + `<HoldingRow>` (per-row, to keep the file under control). |
| `app/app/portfolio/_components/holding-logo.tsx` (new) | Client component wrapping `<Image>` + onError → `<InitialsTile>`. |
| `app/app/portfolio/_components/initials-tile.tsx` (new) | Server component. Deterministic colour + initials. |
| `app/app/portfolio/_components/row-sparkline.tsx` (new) | Server component. Renders SVG from `{ points, firstClose, lastClose, currency }`. Reuses `price-nav-sparkline.tsx`'s path-generation math. |
| `app/app/portfolio/_components/range-toggle.tsx` (new) | Client component. Segmented `30D · 1Y · 5Y`. localStorage + custom-event pattern, matches `holdings-table.tsx`'s existing sort hookup. |
| `app/app/portfolio/_components/density-toggle.tsx` (new) | Client component. Icon button cycling comfortable/compact. |
| `app/app/portfolio/_components/wrapper-filter-chips.tsx` (new) | Client component. Derives present wrappers from rows; writes `?wrapper=` to URL. |
| `app/app/portfolio/_components/portfolio-bar.tsx` (new) | Server component. Renders the `::after` % fill behind a Value cell. |
| [lib/portfolio/load-priced-holdings.ts](../../dividendmapper/lib/portfolio/load-priced-holdings.ts) | Add `loadSparklineSeriesByTicker(tickers, range)` and return it from `loadPricedHoldings`. |
| `lib/portfolio/load-sparkline-series.ts` (new) | The new helper above, isolated for testing. |
| [app/app/portfolio/page.tsx](../../dividendmapper/app/app/portfolio/page.tsx) | Read the `?wrapper=` query param, filter `visibleRows` server-side; pass `sparklineByTicker` into the table; drop `vehicleScoresByTicker` plumbing (still loaded for `/app/portfolio/scoring`). |
| `supabase/migrations/0024_ticker_price_history.sql` (new) | Schema above. Sits after `0023_scoring_lookup_audit.sql` (free-UX branch, applied to prod 2026-06-27). |
| `scripts/sanity/backfill-ticker-price-history.mjs` (new) | Backfill script. |
| Existing nightly cron (likely `app/api/cron/nightly-prices/route.ts` or equivalent — to be confirmed in the implementation plan) | Append `ticker_price_history` row per ticker per run. |
| [next.config.ts](../../dividendmapper/next.config.ts) | Add `img.logo.dev` to `images.remotePatterns`. |
| `.env.example` | Add `NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_API_KEY`. |

## 9. Testing

- **`row-sparkline.test.tsx`** — given fixture `points`, asserts the SVG path string starts with `M`, that the last-point dot is positioned at the rightmost x, and that an `< 8 points` series renders the Collecting… pill.
- **`holding-logo.test.tsx`** — render with a real ticker and a 404-ing one; asserts initials tile renders on `onError`.
- **`initials-tile.test.tsx`** — same ticker → same hue across renders; "BME.L" → `BM`; "401k" → `41`; "$$$" → empty-string fallback handled.
- **`holdings-table.test.tsx`** — extend existing tests:
  - whole-row click navigates;
  - active text selection cancels nav;
  - Edit/Delete clicks don't bubble;
  - sortable headers reorder + persist;
  - wrapper filter chips show only with 2+ wrappers, URL syncs both ways.
- **`load-sparkline-series.test.ts`** — given a fixture DB, returns sliced series for each range; missing-ticker case returns `null`; respects the 100-point downsample for 5Y.
- **`backfill-ticker-price-history.test.ts`** — pure function unit over a fixture FMP response; tests upsert idempotency, 1,260-row trimming.

## 10. Out of scope

- **1D intraday sparkline.** Deferred. Reassess after 4 weeks of usage data on the range toggle.
- **Real Edit modal.** Layout slot is reserved; the modal itself is its own future plan.
- **Vehicle resilience chip in the row.** Lives on detail pages only.
- **Live (intraday) price refresh on the portfolio page.** Still nightly cron.
- **FX-converted "common currency" view.** Each row still shows its native currency. A multi-currency portfolio total view is its own future plan.
- **Drag-to-reorder, pin favourites, watchlist merging.**
- **Server-rendered initials tile via `<img>` data-URI.** The client component pattern is good enough; pre-rendering the tile server-side is a micro-optimization we don't need.

## 11. Risks / open questions for the implementation plan

- **Next 16 `<tr>` inside `<Link>`.** Confirm whether the published Next 16 docs (`node_modules/next/dist/docs/`) allow nesting `<tr>` in `<Link>`. If not, fall back to programmatic `router.push` with `role="link"` (already speced as the fallback above).
- **Sticky `<thead>` + `position: sticky` parent.** The current table sits in a `div.overflow-hidden.rounded-xl` — the overflow style breaks sticky. Either flip to `overflow-clip` (which preserves sticky descendants) or restructure so sticky's containing block is the page scroll.
- **Existing nightly cron file path.** Implementation plan needs to find the cron route and confirm where to add the `ticker_price_history` append step.
- **`historical-price-full` response shape for `.L` tickers in `GBp`.** Confirm during backfill that the close prices are in pence (consistent with the existing `priceByTicker` plumbing) so the sparkline doesn't render a 100× discontinuity vs the Value cell.
- **Logo.dev fallback for funds.** UK investment trusts (e.g., `SMIF.L`) may 404 even with the `.L` suffix. The initials tile is the fallback — confirm visual quality on a representative sample (BME.L, TW.L, W7L.L, SMIF.L, ARCC, PYPL, ADBE) during implementation.
