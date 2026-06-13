# Kickoff prompt — CSV dividend import (Phase 3.5, Track B fast-follow)

Written 2026-06-13. Companion to the shipped CSV *holdings* importer (prod `13d1a34`). Paste the block
below into a fresh session. It is self-contained.

---

```
Build the **CSV dividend import** fast-follow for DividendMapper (Phase 3.5, Track B).

## Context
We just shipped a generic, broker-agnostic **CSV *holdings* import** (prod 13d1a34). This task adds the
deferred companion: importing **dividend history** from a CSV into `user_dividends`, so users who won't
paste a broker API key can still populate their realised income (the "Received (12m)" surface).

Repo: work inside `dividendmapper/` (a Next.js 16 + React 19 app). READ `dividendmapper/AGENTS.md`
first — this is NOT stock Next.js; check `node_modules/next/dist/docs/` before any Next-specific code.
Use **strict TDD** (write the failing test, watch it fail, then implement) — it's the house style; the
holdings importer has 35 tests you should mirror.

## FIRST: isolate your workspace (important)
This repo is sometimes worked on by a concurrent session in the SAME working tree, which has caused
branch collisions. Before doing anything, create an **isolated git worktree** off the latest
`origin/main` and work only there:
    git fetch origin
    git worktree add -b feat/csv-dividend-import ../dm-csv-dividends origin/main
Then `cd ../dm-csv-dividends/dividendmapper`, and **copy `.env.local`** from the main checkout's
`dividendmapper/.env.local` (a fresh worktree needs it to build/run locally). Do NOT switch branches in
the primary working tree.

## What already exists (reuse, don't reinvent)
- `lib/brokers/csv-import.ts` — the holdings importer: `parseCsvHoldings` (papaparse, header-aliased,
  BOM-safe, per-row line-numbered validation) + `buildCsvImportPlan` (pure). **Mirror this structure.**
- `app/api/portfolio/import/csv/route.ts` — Pro-gated, native multipart `formData()`, `dryRun` preview
  vs apply, ~1MB/2000-row caps, RLS server client.
- `app/app/portfolio/_components/import-csv-modal.tsx` + `import-csv-launcher.tsx` — upload->preview->confirm UI.
- `public/portfolio-import-template.csv` — the holdings starter template + "Download template" link.
- `lib/brokers/sync.ts` — the canonical **`UserDividendRow`** shape and `hashDividend()` (deterministic
  external_id from ticker|paidOn|amount|grossPerShare). The T212 sync builds these; copy the shape.
- `lib/brokers/run-sync.ts` (apply step) — `user_dividends` is **upserted on conflict `(user_id, external_id)`**.
- `supabase/migrations/0007_user_dividends.sql` — table schema. Columns: user_id, connection_id, ticker,
  ticker_scoring, wrapper, amount, currency(3), gross_amount_per_share, paid_on(date), type, external_id,
  `source` CHECK allows **'csv'**, UNIQUE(user_id, external_id). **No migration needed.**

## The task
1. **Pure module** (TDD first): add `parseCsvDividends(text, opts)` + `buildCsvDividendImportPlan(...)`.
   Either extend `lib/brokers/csv-import.ts` or add `lib/brokers/csv-dividends.ts` (your call — keep it pure).
   - CSV columns (header-aliased, case-insensitive): **ticker** (req), **amount** (req, >0), **paid_on**
     (req, parse to YYYY-MM-DD), **currency** (opt, GBP/USD, default GBP), **wrapper** (opt, default from
     modal), **gross_amount_per_share** (opt), **type** (opt, default "dividend", lowercased).
   - Reuse the same ticker regex/validation as holdings; per-row errors with line numbers.
   - For CSV, the user supplies OUR scoring ticker directly -> set both `ticker` and `ticker_scoring` to it,
     `connection_id: null`, `source: 'csv'`.
   - `external_id` = a deterministic hash **prefixed `csv:`** over (ticker, paid_on, amount,
     gross_per_share) — mirror `hashDividend()` so re-uploads are idempotent (upsert, no duplicates).
   - The plan returns rows ready for `user_dividends` upsert + a preview (ticker, paid_on, amount,
     currency, scored-flag) + a skipped-rows list.
2. **Route** (TDD): expose it. Recommended: add a `kind` form field to the EXISTING
   `POST /api/portfolio/import/csv` (`kind=holdings` default | `kind=dividends`) so one endpoint serves
   both, branching to the right parser/plan; Pro-gated, dryRun preview, then upsert via RLS server client.
   (If that bloats the route, a sibling `.../import/csv` route is fine — decide and note why.)
3. **UI** (TDD): let the user pick what they're importing. Recommended: a small radio/segmented control
   in `import-csv-modal` ("Holdings" / "Dividends") that swaps the column hint, template link, and preview
   columns; reuse the upload->preview->confirm flow. Add a `public/portfolio-dividends-template.csv`.
4. **Wire + verify** the preview/summary copy for dividends (e.g. "N dividends, M skipped, X value-only").

## Open decisions — make a call, state it
- Single endpoint+modal with a `kind` toggle (recommended) vs separate dividend import surface.
- Whether to also accept a combined holdings+dividends file (recommend NO for v1 — keep them separate).

## Verification
- New unit tests for parse + plan (cover: header aliases, bad date/amount, currency/wrapper defaults,
  idempotent re-import = all upserts no dupes, unknown-ticker flagged). Plus route + modal tests.
- Full suite green (`npx vitest run` from `dividendmapper/`), `npx tsc --noEmit`, `npx eslint` on new files,
  `npm run build` exit 0.
- Local Pro smoke: `npm run dev`, sign in as a **Pro** account, import a 3-row dividend CSV, confirm the
  rows land and surface in the holding's realised income / **"Received (12m)"** column; re-upload -> no
  duplicates.

## Out of scope
Holdings CSV (already shipped), weekly digest (Track A #1), bulk-remove-on-disconnect (Track C #3),
Track D engine calibration. Don't touch the frozen scoring engine.

## When done
Push `feat/csv-dividend-import` and open a PR (or ask the human before pushing to `main` — the repo
deploys from `main`). Update `planning/plans/2026-06-11-phase-3.5-backlog-remaining.md` (mark the
dividends fast-follow done) and add a memory note. Clean up the worktree when merged.
```

---

## Design notes (for whoever kicks this off)
- The `kind=holdings|dividends` toggle on the **existing** endpoint/modal is the recommended shape —
  one importer, matches the "same data shape as a sync" framing. Left as a stated decision so the session
  can override if it gets messy.
- The isolated-worktree instruction is deliberate: on 2026-06-13 a concurrent local session held the
  primary working tree on a `feat/free-user-lifecycle-emails` branch, causing a commit-on-wrong-branch
  collision. Working in a separate worktree avoids it.
- Reference for the positions importer's deliberate divergences (no-auto-archive, no migration, why it
  doesn't route through T212's `buildSyncPlan`): the memory note `state_2026-06-13_csv_import.md` and the
  Done block in `planning/plans/2026-06-11-phase-3.5-backlog-remaining.md`.
