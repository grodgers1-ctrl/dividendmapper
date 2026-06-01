# Analyst Dashboard

Local web app for what-if exploration of Buy / Trim / Risk / Reinvest scores
over the `.backtest-cache/` data. Independent of the production Next.js app
at `dividendmapper/` — prod stays frozen.

## Setup

From the repo root, install once:

```bash
cd scripts && npm install
```

Dependencies: `express`, `tsx`, plus dev `vitest` + typings.

## Run

From the repo root:

```bash
npm run analyst --prefix scripts
```

or, equivalently:

```bash
cd scripts && npm run analyst
```

Open <http://localhost:5000>.

Override the port with `PORT=5050 npm run analyst`.

## What you'll see

- **Scoring view (default):** sortable table of all cached tickers with Buy,
  Trim, Risk, and a composite Signal (Buy / Hold / Trim / Sell). Sidebar with
  22 weight sliders grouped by Buy categories, Buy signals, Trim categories,
  Trim signals. Move a slider → table re-scores within ~200ms.
- **Reinvest view:** enter cash → server allocates by `max(0, Buy − 50)`
  (the Phase 2.75 Day 6B "Quality first" heuristic) → donut chart + table.

## How it reads data

On startup, `cache-loader.ts` scans `.backtest-cache/<TICKER>/` for ticker
directories and loads up to 8 JSON files per ticker into an in-memory map:

| File | Used for |
| --- | --- |
| `profile.json` | sector, market cap, currency, company name |
| `dividends.json` | A1 yield series, R1 cut detection, payout-ratio Q gate |
| `historical-price-eod.json` | A1 yield series, B1 SMA200, B2 52w high, B3 RSI14 |
| `income-statement-quarter.json` | EBIT, net income, interest expense, payout ratio |
| `cash-flow-statement-quarter.json` | FCF, dividends paid (Q gate + R2 coverage) |
| `balance-sheet-quarter.json` | (reserved — R5 net-debt acceleration when wired) |
| `grades.json` | C2 net-upgrades-over-90d (events fed directly, no rollup) |
| `insider-trading.json` | C3 net insider buying, R7 net insider selling |

Missing files become empty arrays. Missing data → per-signal N/A → the prod
redistribution math collapses the gap gracefully.

**Known cache gaps in v1** (signals that always return N/A):
A2 (no ratios-quarterly for PE history), A3 (no DCF endpoint), C1 (no
priceTarget), D1 (no sector medians), D2 (no dividendsCalendar). R4/R5 use
data the cache doesn't capture (analyst estimates, key-metrics quarterly) so
they generally contribute 0 points.

## Architecture

```
scripts/analyst-dashboard/
├── server.ts              # Express, 4 routes, port 5000
├── cache-loader.ts        # reads .backtest-cache/* into a Map
├── local-assemble.ts      # derives per-signal inputs from cache shapes
├── local-orchestrator.ts  # forks compute-{buy,trim,risk}-score with weight params
├── reinvest.ts            # max(0, Buy − 50) allocator
├── config.json            # default weights (mirror prod constants)
├── public/index.html      # Alpine.js SPA
├── public/app.js          # Alpine controller + Chart.js donut
└── public/styles.css      # dark neutral theme
```

Per-signal compute functions (`a1-yield-percentile`, `b3-rsi-14`, etc.) are
imported **directly** from `dividendmapper/lib/scoring/signals/*` via tsx — no
copy, no drift, no re-implementation. Quality gates + redistribution are also
imported directly. Only the orchestrators (`compute-buy-score`,
`compute-trim-score`, `compute-risk-score`) are forked, because prod hardcodes
weights inside them.

## Adding a new scoring module

The fork pattern, illustrated for a hypothetical "Income Quality" score:

1. Author the pure per-signal compute functions in
   `dividendmapper/lib/scoring/signals/iq-*.ts` (or elsewhere in prod). Each
   takes its own typed inputs and returns `{ score: number | null, humanLabel }`.
2. In `local-orchestrator.ts`, add a new exported function
   `computeIncomeQualityScore(inputs, weights)`. Import the per-signal functions
   from prod. Aggregate using `computeCategoryAggregate` from prod's
   `redistribute-weights.ts`. Take weights as a parameter instead of hardcoding.
3. Extend the `Weights` interface with an `iq` block and add the same shape to
   `config.json`.
4. In `local-assemble.ts`, add input prep for any new cache fields the score
   reads. If the cache is missing a field, pass null/0 and the signal returns
   N/A automatically.
5. In `server.ts`, call the new score inside `scoreAll()` and add it to the
   `ScoreRow` shape.
6. In `public/index.html` + `app.js`, add a sidebar group with sliders for the
   new weights and a column in the scoring table.

No build step. No file registry. Just import → fork → wire.

## Config

`config.json` holds default weights. Reloaded on server restart. Edit values
there to change the "Reset to defaults" baseline; user changes via the UI are
in-memory only and reset on page reload.

`.env` is reserved for future live-FMP work (set `FMP_API_KEY` then); v1 has
no env requirements.

## Out of scope (v1)

Live FMP fetch, manual ticker entry, CSV upload of holdings, editable
thresholds, per-signal history charts, auth, persistence.
