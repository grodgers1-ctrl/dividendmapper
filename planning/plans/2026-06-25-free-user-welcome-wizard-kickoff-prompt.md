Free-user welcome wizard. Execute the plan at `planning/plans/2026-06-25-free-user-welcome-wizard.md` from a fresh worktree.

Working dir: `C:\Users\grodg\dividend_mapper_plan`. App lives in `dividendmapper/`.
Stack: Next.js 16.2.4, React 19.2.4, Tailwind v4, Supabase, Base UI Dialog (`@base-ui/react/dialog`), Vitest + RTL.
IMPORTANT: `dividendmapper/AGENTS.md` says read `node_modules/next/dist/docs/` BEFORE writing any Next-specific code. Next 16 + React 19 patterns may post-date your training data.

══════════════════════════════════════════════════════════════════════════════
WHAT TO DO FIRST (in order)
══════════════════════════════════════════════════════════════════════════════
1. Read your auto-memory index at `~/.claude/projects/C--Users-grodg-dividend-mapper-plan/memory/MEMORY.md`. Particularly load:
   - `feedback_humaniser_mandatory`: ALL user-facing copy must clear the 24 humaniser patterns. Zero em dashes anywhere. Run `dividendmapper/scripts/lint/humaniser.js --strict` on any new copy before showing Glenn.
   - `project_buy_renamed_to_quality`: equity-score triad is "Quality, Trim, Risk" in user-facing copy (NOT "Buy"). Engine identifiers may still say `buy_*`.
   - `reference_app_page_auth_guard`: protected /app/* pages call `requireUser()` themselves; layout guards don't re-run on soft navs.
   - `reference_app_marketing_chrome_split`: /app/* uses DrawerShell, not the marketing SiteHeader.
   - `feedback_supabase_promiselike_chain`: `next build` locally before any push that touches Supabase tables.
   - `reference_supabase_cli_workflow`: `set -a && source .env.local && set +a && npx supabase db push --dry-run` then `--yes`.
   - `reference_supabase_out_of_order_migration_workaround`: fallback if the migration number collides.
   - `feedback_concurrent_worktree_branch_race`: chain git ops atomically; parallel agents may have wiped `node_modules` in the root checkout.
   - `feedback_glenn_terminal_powershell`: hand Glenn PowerShell 5.1 syntax, not bash (no `&&`, no `set -a`, use `curl.exe`).
   - `project_vercel_webhook_flaky` + `state_2026-06-25_phase4_and_income_vehicles_hub_shipped` for current prod state.

2. Read the spec: `planning/specs/2026-06-25-free-user-welcome-wizard-design.md`. The design is locked. Do not redesign.

3. Read the plan: `planning/plans/2026-06-25-free-user-welcome-wizard.md`. Five working days plus one buffer. Each step is TDD-shaped with full code, exact paths, commit per task.

4. Invoke the `superpowers:executing-plans` skill (announce it). For Day 3 (steps 1, 2, 5) and Day 4 (steps 3, 4), consider `superpowers:subagent-driven-development`: each step component is independent of the others once the modal frame in Task 2.2 is done, so they parallelise cleanly.

══════════════════════════════════════════════════════════════════════════════
PREREQUISITE BEFORE DAY 1: MIGRATION NUMBER + APPLY
══════════════════════════════════════════════════════════════════════════════
The plan reserves `0021_welcome_wizard_dismissals.sql`. At plan write time (2026-06-25), the latest migration on `main` was `0020_saved_screens.sql`.

If the Calendar v2 work has merged and taken `0021_equity_scores_projection.sql`, BUMP this plan's migration to `0022` and update every `0021` reference in Days 1, 5, and 6 of the plan.

Confirm at the start:
```bash
ls dividendmapper/supabase/migrations/ | tail -5
```

After writing the migration file (Task 1.1.1), HAND OFF TO GLENN to apply with:
```bash
set -a && source .env.local && set +a
npx supabase db push --dry-run
npx supabase db push --yes
```
Do not apply prod migrations yourself. Confirm with Glenn that backfill row count matches `auth.users` count before moving to Day 2.

══════════════════════════════════════════════════════════════════════════════
WHAT IS NEW (beyond the spec)
══════════════════════════════════════════════════════════════════════════════
The plan adds one small bonus scope item turned up during plan-writing: `<LocaleToggle />` lands in the `/app/*` topbar (`drawer-shell.tsx` passes it into `TopBar`'s `actionsSlot`). The spec assumed step 2 could point at an existing toggle in /app/*; there wasn't one. Glenn approved the addition.

══════════════════════════════════════════════════════════════════════════════
EXECUTION DISCIPLINE
══════════════════════════════════════════════════════════════════════════════
- Strict TDD: failing test → run → impl → run → commit. One logical unit per commit.
- Component tests: RTL + jsdom (`*.test.tsx`). Run vitest from `dividendmapper/`: `cd dividendmapper && npx vitest run --no-file-parallelism <path>`.
- Bash cwd drifts inside compound commands; chain with `cd dividendmapper &&` for npm/test/tsc commands.
- All user-facing copy: zero em dashes. Use colon, comma, or period. Voice matches `dividendmapper/emails/lifecycle-welcome-free.tsx` (Glenn's direct second-person register: "takes about a minute", "nice", "heads up"). No "delve", "leverage", "synergy", "robust", "seamless", "ultimately", "in essence". No "not just X but Y". No copula avoidance.
- The placeholder data glyph `—` (single em dash inside an empty cell) is fine; em dashes in sentences are not.
- Use Edit for existing files (Read first). Write only for new files.
- Commit messages via HEREDOC. End each commit with:
  ```
  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
  ```
- Pause at the end of each day for Glenn's review before starting the next day. Do NOT batch-execute multiple days without checkpoint.

══════════════════════════════════════════════════════════════════════════════
DEPLOY MODEL
══════════════════════════════════════════════════════════════════════════════
Per `project_vercel_webhook_flaky` (FIXED 2026-06-01): git-push deploys work because Root Directory is set to `dividendmapper` on the Vercel project. Push to feature branch, open PR, merge after Glenn's review; Vercel auto-deploys main. No manual `vercel deploy` needed.

DO NOT push to main directly. DO NOT force-push. Hand the PR to Glenn for merge.

══════════════════════════════════════════════════════════════════════════════
BASELINE BEFORE WRITING CODE
══════════════════════════════════════════════════════════════════════════════
From the fresh worktree:
```bash
cd dividendmapper/.worktrees/welcome-wizard/dividendmapper
npx vitest run --no-file-parallelism lib/portfolio/ 2>&1 | tail -5
npx tsc --noEmit 2>&1 | tail -5
```
Expect: tests green, tsc clean. If `node_modules` is empty in the primary checkout (parallel agent wiped it), run `npm install --no-audit --no-fund --prefer-offline` from inside the worktree first.

══════════════════════════════════════════════════════════════════════════════
SCOPE BOUNDARIES (DO NOT EXPAND)
══════════════════════════════════════════════════════════════════════════════
- Do NOT touch `user_preferences` (that table belongs to the Pro personalisation wizard, a separate feature; see `project_buy_renamed_to_quality` for the rebrand context).
- Do NOT add notification email logic. Day 0 / Day 3 / Day 7 lifecycle emails are already in flight via `lib/email/lifecycle/sequence.ts` and skip-gate correctly when the wizard adds a holding.
- Do NOT add a "free trial" or "50% off" line anywhere in the Pro taster (step 5). The Day 60 lifecycle email handles that channel.
- Do NOT add a wizard for new Pro signups. They are filtered out at the tier check; a Pro-specific flow ships separately later.
- Do NOT replace `AddHoldingModal` or its endpoint. Step 3's inline form mirrors the modal's fields and POSTs to the same `/api/portfolio/holdings` route.

When done, pause for Glenn's review before opening the PR.

---
Provenance: spec + plan written 2026-06-25. Source-of-truth files:
- `planning/specs/2026-06-25-free-user-welcome-wizard-design.md`
- `planning/plans/2026-06-25-free-user-welcome-wizard.md`
