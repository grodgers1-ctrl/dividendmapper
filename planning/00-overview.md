# DividendMapper.com — Project Overview

**Domain:** dividendmapper.com  
**Tagline:** Track your dividend income. Know your number. Retire on your terms.  
**Status:** Pre-build planning (May 2026)

---

## What We're Building

A UK/US dividend portfolio tracker that auto-syncs with your broker, understands ISA, SIPP, 401k and IRA tax rules, and shows your projected income — all in one place, starting free.

The core insight: dividend investors are underserved. Most tools require manual entry, don't understand UK tax wrappers, or cost $400/year for features that should cost £15/month. DividendMapper fixes all three.

---

## Planning Documents

| File | Purpose |
|------|---------|
| [01-competitor-analysis.md](01-competitor-analysis.md) | Competitive landscape, gaps, and positioning |
| [02-user-targets.md](02-user-targets.md) | 12-month MAU/MRR projections with assumptions |
| [03-marketing-plan.md](03-marketing-plan.md) | Pre-launch through Month 12 marketing strategy |

Guideline source documents (in parent folder):
- `wealthflow-api-strategy.pdf` — go-to-market strategy, broker integrations, community channels
- `wealthflow-tech-stack.pdf` — full technical architecture

---

## Pricing Tiers

| Tier | Price | Key features |
|------|-------|-------------|
| Free | £0 | Calculators, public dividend data, manual portfolio (up to 10 holdings) |
| Pro | £15/mo or £144/yr | Broker auto-sync, dividend calendar, alerts, unlimited holdings |
| Premium | £45/mo or £432/yr | AI analyst, tax reports (HMRC/IRS), multi-portfolio, PDF exports |

---

## Build Phases

| Phase | Timeline | Deliverable |
|-------|----------|-------------|
| **1** | **Weeks 1–2 (2 calendar weeks — ship fast)** | US/UK locale toggle, retirement calculator, DCF calculator, waitlist page, landing page, SEO foundations. No auth, no database beyond waitlist. |
| 2 | Weeks 3–8 | Auth (Supabase), manual portfolio entry, Stripe billing |
| 3 | Weeks 9–11 | Trading 212 API integration (UK first-mover) |
| 4 | Weeks 12–16 | US brokers via SnapTrade (Schwab, Fidelity, Robinhood, Vanguard US, E*Trade) |
| 5 | Weeks 17–20 | Interactive Brokers + CSV imports (HL, AJ Bell, Freetrade) |
| 6 | Weeks 21+ | AI analyst, tax reporting, PDF exports, public portfolio pages |

**Phase 1 and marketing run concurrently.** Community seeding, waitlist building, and SEO groundwork begin in Week 0 (today) and continue throughout the build. See [04-phase1-sprint.md](04-phase1-sprint.md) for the full 10-day schedule and [03-marketing-plan.md](03-marketing-plan.md) for the overlapping marketing actions.

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Charts | Recharts + Tremor |
| Backend / DB | Supabase (Postgres + Auth + RLS) |
| Background jobs | Inngest (nightly syncs, alerts, digest emails) |
| Cache / rate limiting | Upstash Redis |
| Payments | Stripe (Checkout, webhooks, customer portal) |
| Email | Resend + React Email |
| Analytics | PostHog |
| Error monitoring | Sentry |
| Hosting | Vercel |
| UK market data | EODHD ($19/mo) |
| US market data | Polygon.io ($29/mo) |
| DCF fundamentals | Financial Modeling Prep (free tier) |
| ISIN mapping | Open FIGI (free) |
| FX rates | frankfurter.app (free) |
| US broker sync | SnapTrade (~$0.50–1.00/connected account/mo, no minimum) |

---

## Cost Model

| Phase | Months | Monthly infra cost |
|-------|--------|--------------------|
| Pre-launch + free tools | 0–2 | **~£38/mo** (Vercel Hobby free, Supabase free, EODHD + Polygon) |
| Auth + T212 integration | 3–6 | **~£74–102/mo** (upgrade to Vercel Pro + Supabase Pro) |
| US broker sync (SnapTrade) | 7–9 | **~£114–182/mo** (+SnapTrade at ~£40–80/mo for 100 connected accounts) |
| Scale | 10–12 | **~£200–400/mo** (data API upgrades as traffic grows) |

**Key decision:** SnapTrade replaces Plaid. Plaid charges a $500/mo minimum regardless of usage — requiring 35 paying Pro users just to cover it. SnapTrade charges per connected account with no minimum, making unit economics viable from the first US user.

---

## Key Milestones

| Milestone | Target Month | MRR at milestone |
|-----------|-------------|-----------------|
| Free tools + waitlist live | Pre-launch | £0 |
| First paying users | Month 2 | ~£600 |
| £1,000 MRR | Month 3 | — |
| Trading 212 integration live | Month 4 | ~£2,970 |
| £5,000 MRR | Month 6 | — |
| US broker sync (SnapTrade) live | Month 7 | ~£9,450 |
| 5,000 MAU | Month 9 | ~£16,200 |
| £20,000 MRR | Month 10 | — |
| AI analyst beta | Month 11 | ~£27,600 |
| £30,000+ MRR (ARR ~£400K) | Month 12 | — |

---

## Positioning Statement

> DividendMapper is the only UK/US dividend tracker that auto-syncs directly with your broker (Trading 212, Schwab, Fidelity, Interactive Brokers), understands ISA, SIPP, 401k and IRA tax rules, and shows your projected income — all in one place, starting free.

---

## Immediate Actions (Week 0 — Today)

These must start now. The 2-week build clock and the marketing warm-up clock run simultaneously.

**Developer setup (today):**
- [ ] Confirm dividendmapper.com is registered and DNS is configured
- [ ] Create Vercel account, link to GitHub repo
- [ ] Create Supabase project (free tier)
- [ ] Sign up for EODHD API key ($19/mo — needed for live data in calculators)
- [ ] Sign up for Polygon.io API key ($29/mo)
- [ ] Apply for SnapTrade developer access (approval takes days — start now)
- [ ] Set up PostHog project (free tier)
- [ ] Set up Sentry project (free tier)

**Marketing (today, runs in parallel with build):**
- [ ] Create Reddit accounts — r/UKInvesting, r/FIREUK, r/dividends, r/Bogleheads
- [ ] Join Trading 212 community forum, begin contributing
- [ ] Join MoneySavingExpert forums
- [ ] Begin drafting T212 SIPP guide and UK dividend tax guide (longest to rank)
- [ ] Identify 5 UK YouTube channels (5K–50K subs) for outreach
- [ ] Submit dividendmapper.com to Google Search Console the moment the waitlist page is live (Day 3 of build)
