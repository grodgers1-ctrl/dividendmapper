# Roadmap Synopsis — Phase 2.75 → Phase 3

**Written:** 2026-05-25 (end of Phase 2 Day 13). A digest of the next two roadmap steps after the current Phase 2 polish window.

**Sources of truth (this doc is a summary, not the spec):**
- `00-overview.md:48-54` — canonical phase roadmap
- `06-equity-scoring.md` — full Phase 2.75 spec
- `05-phase2-sprint.md:733+` — Phase 3+ backlog

**Sequencing:** after the current Phase 2 polish, the roadmap runs **2.75 (the decision layer) → 3 (broker sync)**, decoupled on purpose. 2.75 deepens insight without touching broker plumbing and can earn Pro revenue while the riskier, externally-dependent T212 work waits.

---

## Phase 2.75 — Equity Scoring + Reinvest Recommender

**Window:** 9 working days, starting after the Phase 2 polish backlog (~Day 16+). The immediate next sprint.

**The pitch:** Phase 2 shipped portfolios behind auth, but Pro's only perks were "unlimited holdings + income view" — thin. Phase 2.75 makes portfolios *actionable* and repositions Pro from *"Sharesight, cheaper"* to *"Sharesight + the decision layer they skip."* Headline Pro differentiator.

**What ships (Day 9):**
- **Three scores per equity (0–100):** **Buy** (quality-gated; valuation 35% / technical 30% / sentiment 20% / dividend-timing 15%), **Trim** (overvaluation mirror, no quality gate), **Risk** (additive deterioration R1–R7; a dividend cut dominates at 60 pts).
- **Reinvest Recommender v1** — calendar-triggered (holdings with ex-div in next 5 days), ranked by Buy Score + income contribution; suggests where dividend cash could go for better total return/diversification rather than auto-DRIP. **Deliberately calendar-based so it needs no broker sync — that's why it ships before Phase 3.**
- **Daily refresh** via Vercel Cron (22:30 UTC) over `holdings ∪ tracked_tickers`, writing `equity_scores` + `equity_score_history`.
- **UI:** score chips + breakdown drawer on the holdings table; Buy×Risk **quadrant map** at `/app/portfolio/scoring`; reinvest suggestion card on `/app/portfolio`.
- **Personalisation wizard** (6 questions) tuning per-user category weights for Pro; data-capture-only for Free.
- **Public score lookup** at `/scoring` + `/scoring/[ticker]` — indexable, SEO-ready, ISR-cached daily; free teaser (1 score + sign-up CTA, IP rate-limited) vs Pro full breakdown.
- **Threshold alert emails** (Buy / Risk / Reinvest) sent by the daily cron via Resend with anti-fatigue throttling; notification-prefs page at `/app/account/notifications`.
- **Compliance surface** — methodology page, not-financial-advice footer, 90-day score override; internal audit dashboard at `/admin/scoring/audit`.

**Cost:** +$59/mo **FMP Premium** (UK + Canada coverage, 750 calls/min). Replaces the $19.99 EODHD sub if Day-1 LSE verification holds; net ~£27/mo increase. Polygon free tier stays as US price backup.

**Tier mapping (high level):** Free = teaser/data-capture only; Pro = full scoring + reinvest + quadrant + wizard tuning + 3 alert types + watchlist (≤5); Premium = AI-explained scores + score history charts + tax-aware reinvest + watchlist-extended reinvest (these gate the Phase 6 Premium tier).

**Downstream value:** seeds the **Phase 6 Premium tier** — "AI analyst" becomes *"explain these scores in plain English,"* not a from-scratch build.

---

## Phase 3 — Trading 212 broker auto-sync (UK first-mover)

**Window:** nominally Weeks 9–11; "T212 integration live ~Month 4." Infra steps to ~£74–102/mo (Vercel Pro + Supabase Pro already in place).

**The pitch:** replace manual portfolio entry with automatic broker sync — the load-bearing claim in *"broker sync that actually syncs."* UK-first via Trading 212 (US brokers are Phase 4 via SnapTrade).

**What ships:**
- **Trading 212 API integration** — connect a T212 account, pull holdings/positions automatically.
- **Holding-level dividend ingestion** — *actual paid dividends per user*, upgrading from Phase 2's public per-ticker yield estimates. This is the data that later unblocks **HMRC/IRS tax reports (Phase 6)**.
- **CSV import** — built here because it's the natural bridge (same data shape as a broker import, manual upload vs OAuth). Standalone in Phase 2 would have been wasted work.
- **Ticker autocomplete** — Phase 2 used free-text + manual-blur validation.
- **Upstash Redis** — added for sync caching (Phase 2 stayed on the in-memory layer; user count didn't justify Redis).
- **Email alerts go live** — Phase 2's `/pricing` tags "email alerts" and "broker sync" as "coming soon."

**Explicitly NOT Phase 3:** US brokers + multi-currency Stripe pricing (Phase 4); Interactive Brokers + HL/AJ Bell/Freetrade CSV (Phase 5); AI analyst / tax reports / PDF / public portfolios (Phase 6).

**Main risk:** Trading 212 API maturity/access. Ground truth is `planning/research/t212-sipp.md` (FCA approval landed Feb 2026 per the `reference_t212_sipp_facts` memory) — confirm the API's read capabilities before committing the sprint.

---

## Scoring-engine refinements carried into Phase 3

Calibration items surfaced by Phase 2.75's first live cron runs (2026-05-29). Non-blocking; the engine ships, these sharpen accuracy:

- **Special-dividend handling in cut detection.** GATE_2 + R1 now detect cuts via trailing-12-month year-over-year decline on split-adjusted dividends (>10% drop = cut), which fixed the semi-annual interim/final and ETF-variation false positives (LGEN.L, SCHD cleared). **Residual:** a one-off *special* dividend inflates one TTM window, so the following normal year can read as a >10% "drop" and spuriously trip GATE_2 (observed on DLO, a young/irregular payer). **Solution to build in Phase 3** (when per-user broker dividend data + richer history arrive): detect and exclude non-recurring specials before the YoY comparison — e.g. flag any payment >~2× the trailing median regular payment that doesn't recur in the next cycle, or use FMP's payment `frequency`/`dividend` vs `adjDividend` divergence as a special marker. Lives in `lib/scoring/dividend-cut.ts`.
- **GATE_1 sector carve-out for financials/insurers.** FCF-coverage-of-dividends is structurally meaningless for insurers/banks (LGEN.L fails GATE_1 spuriously). The spec carved out REITs + utilities only; add a financials carve-out (skip GATE_1 or use a sector-appropriate coverage metric).
- **LSE unit consistency.** Confirm analyst-estimate EPS units vs price units for `.L` tickers (price in pence vs EPS possibly in pounds) so the A2 P/E signal isn't distorted.

## The throughline

- **2.75 deepens the *insight* layer without touching broker plumbing; Phase 3 automates the *data* layer underneath it.** Decoupled on purpose: 2.75 ships and earns Pro revenue while the externally-dependent T212 work waits.
- **Dividend data evolves across both:** 2.75 pulls *per-ticker* dividend history from FMP (for scoring); Phase 3 adds *per-user actual* dividend payments from the broker. Complementary, and together they feed a richer income view.
- **Reinvest Recommender grows with the data:** v1 (2.75) is calendar + holdings only. The deferred **per-broker tax-aware reinvest** is gated on broker sync (Phase 3+); watchlist-extended and AI-explained variants are Premium (Phase 6).
- **Shared infra introduced:** 2.75 adds the daily Vercel Cron + `tracked_tickers` (watchlist) schema; Phase 3 adds Upstash Redis. Both build toward the Phase 6 Premium gate.

---

## Full roadmap context (`00-overview.md:48-54`)

| Phase | Window | Theme |
|---|---|---|
| 1 | Wk 1–2 | Calculators, waitlist, landing, SEO — **shipped** |
| 2 | Wk 3–8 | Auth, manual portfolio, Stripe billing — **launched 2026-05-24** |
| **2.75** | **Wk 8 / ~Day 16+** | **Equity scoring + Reinvest Recommender v1 — next** |
| **3** | **Wk 9–11 (~Month 4)** | **Trading 212 broker sync + CSV import** |
| 4 | Wk 12–16 | US brokers via SnapTrade + multi-currency Stripe pricing |
| 5 | Wk 17–20 | Interactive Brokers + HL/AJ Bell/Freetrade CSV |
| 6 | Wk 21+ | AI analyst, tax reporting, PDF exports, public portfolio pages |
