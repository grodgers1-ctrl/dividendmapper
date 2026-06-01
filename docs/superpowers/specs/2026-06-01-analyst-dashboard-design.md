# Analyst Dashboard — Design Spec

**Date:** 2026-06-01
**Author:** brainstormed collaboratively, codified for the build
**Status:** approved (the live `/goal` condition mirrors this spec)

## Purpose

A local web app for Glenn to explore Buy / Trim / Risk / Reinvest scores over the cached `.backtest-cache/` data, with live-editable signal weights. Independent of the production Next.js app at `dividendmapper/`. Used for analyst-style "what if I weighted A1 more heavily" exploration without altering frozen prod code.

## Why this matters

Prod scoring weights are hardcoded constants in `dividendmapper/lib/scoring/compute-buy-score.ts`, `compute-trim-score.ts`, `compute-risk-score.ts`. Changing them in prod requires a deploy and risks the live scoring stream. The dashboard sidesteps that: weights live in the dashboard's own orchestrator fork, prod stays frozen.

## Architecture

**Stack:** Node.js + Express, ES modules, TypeScript via `tsx`. Vanilla HTML + Alpine.js for reactivity. Chart.js for the reinvest donut.

**Layout:**
```
scripts/analyst-dashboard/
├── server.ts              # Express, 4 routes
├── cache-loader.ts        # reads .backtest-cache/<TICKER>/ into a PartialBundle
├── local-assemble.ts      # forks assemble-inputs.ts to work with cache shapes
├── local-orchestrator.ts  # forks compute-{buy,trim,risk}-score with weights as params
├── reinvest.ts            # applies Reinvest Recommender heuristic to cached tickers
├── config.json            # default weights (mirrors prod constants)
├── tsconfig.json
├── public/
│   ├── index.html         # sidebar + scoring table + reinvest tab
│   ├── app.js             # Alpine controllers + Chart.js setup
│   └── styles.css         # neutral theme
├── __tests__/
│   └── local-orchestrator.test.ts
└── README.md
```

Entrypoint: `npm run analyst` (added to `scripts/package.json`) starts the server on port **5000**.

## Components

1. **`cache-loader.ts`** — On server start, scan `.backtest-cache/*/` for ticker directories. For each, read up to 8 JSON files (`profile.json`, `dividends.json`, `historical-price-eod.json`, `income-statement-quarter.json`, `cash-flow-statement-quarter.json`, `balance-sheet-quarter.json`, `grades.json`, `insider-trading.json`). Missing files → empty arrays. Returns `Map<ticker, PartialFmpBundle>`.

2. **`local-assemble.ts`** — Forks `dividendmapper/lib/scoring/assemble-inputs.ts`. Differences:
   - Accepts a `PartialFmpBundle` (no `ratiosTtm`, `keyMetrics*`, `analystEstimates`, `dcf`, `sma`, `rsi`, `priceTarget`, `dividendsCalendar`).
   - Feeds `grades.json` events directly to C2 (cached shape already matches `GradeChange`, skipping the prod `FmpGradeSnapshot → GradeChange` derivation).
   - Signals whose inputs are missing pass through null/0; downstream signal compute functions return N/A; redistribution handles the gap.

3. **`local-orchestrator.ts`** — Forks `compute-buy-score.ts`, `compute-trim-score.ts`, `compute-risk-score.ts`. Same signal-by-signal calls into `dividendmapper/lib/scoring/signals/*` (imported directly, NOT modified). Difference: takes a `Weights` object as a second parameter, replacing the hardcoded `A_WEIGHTS`/`B_WEIGHTS`/`C_WEIGHTS`/`D_WEIGHTS`/`TA`/`TB`/`TC` constants and the `BUY_BASE_WEIGHTS`/`TRIM_BASE_WEIGHTS` category-level constants. Returns the same `BuyScoreResult` / `TrimScoreResult` / `RiskScoreResult` shapes.

4. **`reinvest.ts`** — Applies the Phase 2.75 Day 6B Reinvest Recommender heuristic: rank cached tickers by Quality (Buy proxy), penalise concentration. Inputs: `cash` (£), `holdings` (defaults to equal-weight 28 cached tickers). Output: `{ ticker, score, allocation }[]` summing to `cash`.

5. **`server.ts`** — Express server with these routes:
   - `GET /` — serves `public/index.html`.
   - `GET /api/tickers` — returns the list of cached tickers + cache mtime.
   - `POST /api/score` — body `{ weights }`. Returns `{ tickers: ScoreRow[] }`.
   - `GET /api/reinvest?cash=N` — returns allocations.
   - Static `/public/*` for assets.

6. **`public/index.html` + `public/app.js`** — Single page with two views:
   - **Scoring view (default):** left sidebar with 22 weight sliders grouped by category (Buy A/B/C/D, Trim A/B/C, Risk additive). Right pane: sortable table (Ticker, Buy, Trim, Risk, Signal). Row colour-coded by Signal via `chip-display.ts`'s `actionHint` mapped to row class.
   - **Reinvest view:** cash input, allocations table, Chart.js donut.

## Data flow

1. Startup: `cache-loader` builds in-memory `Map<ticker, PartialFmpBundle>` (28 entries, trivial).
2. Browser loads `/`, server returns HTML with Alpine state initialised from `config.json`.
3. Slider move → debounced 150ms → `POST /api/score { weights }`.
4. Server runs `local-assemble` then `local-orchestrator` for each ticker → returns score rows.
5. UI table re-renders.
6. Reinvest tab: `GET /api/reinvest?cash=10000` → donut + table.

## Error handling

- Missing `.backtest-cache/` → server logs `Error: cache not found. Run scripts/backtest first.` and exits with code 1.
- A signal compute throws → caught at the per-ticker boundary; that signal returns N/A in the response.
- Weights array malformed → 400 with the offending key.
- Out-of-range weight values → clamped to `[0, 1]`.

## Testing

- `__tests__/local-orchestrator.test.ts` — three smoke tests: (a) known inputs + default weights match prod-equivalent scores, (b) doubling A1 weight increases its effective contribution as expected, (c) all-zero weights returns null. Per-signal correctness is already covered by the 414-test prod suite.
- Manual smoke at the end: start server, open browser, confirm table renders and slider re-scores.

## Out of scope (v1)

- Live FMP fetch
- CSV upload (manual or holdings)
- Manual ticker entry
- Modular drop-in scoring registration (just the orchestrator-fork pattern documented in README)
- Editable per-signal thresholds (only weights)
- Signal-level history charts over time
- Authentication
- Multiple reinvest allocation strategies

## Done when

- `npm run analyst` from `scripts/` starts the server on port 5000 without errors.
- Visiting `http://localhost:5000` renders a scoring table for all 28 cached tickers.
- Moving any weight slider re-scores within 500ms.
- Reinvest view returns allocations for a non-zero cash input, donut renders.
- `scripts/analyst-dashboard/README.md` documents setup, run, and the orchestrator-fork pattern.
