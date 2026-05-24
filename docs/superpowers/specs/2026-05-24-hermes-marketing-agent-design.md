# Hermes Marketing Agent — Design Spec
**Date:** 2026-05-24  
**Project:** DividendMapper.com  
**Status:** Approved — ready for implementation planning

---

## Overview

Hermes (Nous Research open-source autonomous agent, locally hosted) runs DividendMapper's ongoing marketing operation autonomously across five systems. Glenn retains control over super user designation, founding-member offers, and Brand_Voice.doc edits. Everything else runs unattended.

**Monthly cost:** sub £30 (OpenAI OAuth local LLM + Grok Super Lite $10 for X access + Firecrawl free tier)

---

## Architecture — Five Systems

| System | Cadence | Output |
|---|---|---|
| Content Engine | Weekly (Mon) + reactive on news | Blog post → X thread → LinkedIn post |
| Forum Monitor + Channel Discovery | Daily | Helpful replies across dividend communities; new channels added to monitored list |
| Cold Outreach Lane | Daily (5 contacts/day cap) | X DMs + emails to scored candidates from pipeline |
| Warm Nurture Lane | Event-driven + follow-up sequences | Replies to engaged contacts; offer codes for qualifying candidates |
| Memory & Reporting | Weekly digest (Fri 17:00) | Performance summary + escalations to Glenn |

**Out of scope:** Transactional emails, Resend integration, Supabase monitoring (handled in project). Reddit launch posts, Product Hunt, Show HN, press outreach (one-shot, Glenn-run). Super user designation and WhatsApp invites (Glenn-only gate).

---

## Google Drive Memory Layer

All documents in a `DividendMapper/Hermes/` Drive folder. Glenn can edit any document to steer Hermes without touching the agent config.

| Document | Type | Purpose |
|---|---|---|
| `Brand_Voice.doc` | Google Doc | Loaded before every content/outreach task. Humaniser patterns, tone rules, product facts, competitor data, offer tiers, escalation rules, hard prohibitions. Glenn-edit only. |
| `Content_Calendar.sheet` | Google Sheet | Planned topics, publish dates, post URLs, 7-day engagement. Hermes reads on Monday, writes back after publishing. |
| `Published_Archive.sheet` | Google Sheet | One row per piece of content published. Hermes checks before drafting (no repeat topics within 60 days). Includes reply text hashes to prevent duplicate forum replies. |
| `Candidate_Pipeline.sheet` | Google Sheet | Full outreach pipeline. Replaces INBOX.md as authoritative state. Columns: handle, platform, score, status, contact method, found date, sent date, offer tier, offer code sent, follow-up dates, opener topic, notes, `superuser-approved` tag, `needs-Glenn` flag, `high-engagement` flag. |
| `Offer_Codes.sheet` | Google Sheet | Pre-generated Stripe coupon codes. Two pools: 1-month-free and 50%-for-3-months. Columns: code, pool, status (available / reserved / sent), reserved-for candidate handle, sent date. Glenn tops up pools by generating codes in Stripe and appending rows. |
| `Channel_Discovery.sheet` | Google Sheet | Communities Hermes monitors. Columns: platform, URL, audience fit, rules stance (open / strict / no-promo), status (candidate / verified / monitoring / retired), first seen, added to monitor date. |
| `Contact_Sources.sheet` | Google Sheet | Scrapeable sources feeding the cold outreach pipeline. Columns: URL, type, audience fit, last scraped, candidates extracted, Firecrawl credits used, status, notes. |
| `Topic_Ideas.doc` | Google Doc | Glenn drops ideas here (news events, feature launches, competitor moves). Hermes reads on Monday before selecting a content topic. |

---

## Section 1: Content Engine

### Content mix (rolling 4-week window)

| Weight | Type | Examples |
|---|---|---|
| 45% | DividendMapper-specific | Feature launches, Sharesight vs DividendMapper comparisons, equity score explainers, "how your retirement number is calculated", T212 sync roadmap previews |
| 30% | UK dividend education | ISA tax treatment, SIPP drawdown rules, how DRIP works, dividend allowance history |
| 25% | Financial news commentary | ISA limit announcements, Budget dividend tax changes, T212 SIPP updates, FTSE 100 dividend records, major IPOs (SpaceX etc.) with income-investor angle |

Polls: locked content type until @DividendMapper reaches 500 followers or month 4, whichever comes first. Noted in Brand_Voice.doc.

### Monday primary run

1. **Topic selection** — Opens `Content_Calendar.sheet`. Uses queued topic if present; checks `Topic_Ideas.doc` next; falls back to web search for current UK dividend/FIRE/ISA news. Writes chosen topic to calendar before drafting.
2. **Blog post** — 1,500 words, UK audience, HMRC/gov.uk verified for any tax figures. Loads `Brand_Voice.doc`. Runs 24-pattern humaniser checklist. Checks `Published_Archive.sheet` (no repeat within 60 days). No investment recommendations. Commits to dividendmapper repo → Vercel auto-deploys.
3. **X thread** — 10–12 tweets. Tweet 1 is a hook (stat or pointed claim). Tweets 2–10 cover main points one per tweet. Final tweet links to blog post and tags @DividendMapper. Posted via Grok API.
4. **LinkedIn post** — 600–800 words, professional register. Link to blog post in first comment (not body — LinkedIn penalises body links). Posted to DividendMapper company page via browser automation (Phase 1) then LinkedIn Community Management API once approved (Phase 2, ~month 2).
5. **Write-back** — Appends row to `Published_Archive.sheet` (topic, blog URL, X thread URL, LinkedIn URL, publish date). Updates `Content_Calendar.sheet` status to published.

### Reactive run (news triggers)

Hermes monitors RSS feeds daily at 07:00 (BBC Money, This is Money, FT, FCA news, Sharesight blog) for: ISA limit change, SIPP rule update, dividend tax announcement, major UK IPO, Sharesight pricing change, T212 product news.

On trigger: 800-word post + X thread only (LinkedIn skipped on reactive runs). Appended to `Published_Archive.sheet` with `reactive` flag. Does not count against Monday quota.

### Realistic 3-month output

- 12–15 blog posts indexed; 200–600 organic sessions by month 3
- ~150 X tweets across threads and reactive posts; 150–400 followers
- 12–15 LinkedIn posts; 50–150 company page followers
- Content's primary near-term value: credible URLs for cold DMs and forum replies

---

## Section 2: Forum Monitor + Channel Discovery

### Monitored platforms (seed list)

| Platform | Focus |
|---|---|
| r/UKInvesting | ISA/SIPP questions, broker comparisons, dividend income |
| r/FIREUK | Dividend FIRE numbers, income projections |
| r/dividends | General dividend discussion |
| r/T212community | T212 SIPP, dividend tracking |
| T212 community forum | Same — Glenn's account `probablypassive` aging here |
| LemonFool | HYP threads, ISA discussions |
| MoneySavingExpert | ISA, SIPP, dividend income boards |

Seed list grows via Channel Discovery (see below).

### Reply triggers

Hermes replies only when a match is found in thread titles or opening posts:
- Direct questions: "how do I track ISA dividend income", "best dividend tracker UK", "Sharesight alternative"
- Competitor mentions: Sharesight, Simply Wall St, Snowball Analytics
- Calculation questions: yield targets, retirement income numbers, SIPP projections
- T212 SIPP threads
- ISA/dividend allowance confusion

### Three reply modes

- **Education (70%)** — Answers the question thoroughly, no product mention. Links to a relevant blog post if one exists.
- **Natural mention (25%)** — Question is directly about tracking/calculating dividend income. Answers first, then: "worth checking dividendmapper.com — free, UK tax-wrapper aware, built for this."
- **Direct comparison (5%)** — Thread explicitly asks "what tool do you use" or Sharesight vs X. Can be direct; links to comparison blog post if published.

Hermes never leads with DividendMapper.

### Spam guardrails

- Max 3 replies per platform per day
- Min 2-hour gap between replies on same platform
- No repeated sentence or phrase within 30-day window (reply text hashes tracked in `Published_Archive.sheet`)
- Never reply twice to same thread
- Reddit: tracks karma level of Glenn's accounts; reduces posting frequency on low-karma accounts

### Channel Discovery (daily, post forum scan)

Checks 2–3 candidate channels per run. Discovery sources: web search for UK dividend/FIRE communities, subreddit sidebar links, comments in monitored threads mentioning external communities, X hashtag searches (#UKDividends, #ISA, #FIREUK), blog post referrer data from `Published_Archive.sheet`.

**Verification (4 checks, all must pass):**
1. Active: at least 1 new post in past 7 days
2. Relevant: 5–10 recent posts scanned — UK-leaning or dividend/ISA/SIPP/FIRE focus
3. Rules: reads pinned rules — tags `rules: strict` for no-self-promotion communities rather than rejecting them
4. Not duplicate: not already in `Channel_Discovery.sheet`

Rejected channels logged with reason. Target: seed list grows from 7 to 15–25 channels by month 3.

---

## Section 3: Cold Outreach Lane

**Daily. Hard cap: 5 contacts/day across all channels.**

### Three-layer pipeline

**Layer 1 — Contact Source Discovery (Tuesday weekly)**  
Web search for new scrapeable sources: UK finance newsletter author pages, YouTube channel directories, forum member lists, Substack indexes, blog comment sections. Verification: publicly accessible, audience matches, contact details extractable, not already in `Contact_Sources.sheet`. Adds verified sources with `ready to scrape` status. Glenn can add sources manually by appending a URL row.

**Layer 2 — Firecrawl Bulk Extraction (Wednesday weekly)**  
Runs Firecrawl against each `ready to scrape` source. Budget: 100–120 pages/week across 2–3 sources, preserving headroom within the 500 credit/month free tier. Credit usage tracked per source in `Contact_Sources.sheet`.

Good targets: YouTube "About" pages (creator emails), T212/LemonFool member directories, Reddit user profiles, Substack author pages, UK investment club websites.  
Skipped automatically: anything behind login, X profiles (no public email), LinkedIn.

Each extracted candidate is scored 1–20 and appended to `Candidate_Pipeline.sheet` as `pending`. A weekly run typically adds 30–60 new scored candidates.

**Layer 3 — Daily Outreach Run (5 contacts/day)**  
1. **Pick top 5** — sort by score descending; skip contacts sent in past 48 hours or from same community as yesterday
2. **Profile visit** — opens candidate's profile in browser; reads 2–3 recent posts or videos in full via browser + vision (genuine opener material, not snippet reconstruction)
3. **Fit check** — UK-leaning? Active in past 14 days? Not already a DividendMapper user? Fail any → mark `passed`, move to next
4. **Draft and send** — loads `Brand_Voice.doc`; writes DM with genuine opener from step 2; runs 24-pattern humaniser check; sends via X DM (Grok API), email (IMAP/SMTP from `marketing@dividendmapper.com`), or forum PM (browser automation)
5. **Log** — updates `Candidate_Pipeline.sheet`: status `dm-sent`, date, platform, opener topic, offer tier

### Offer tiers (included in initial DM for 15+ candidates; follow-up 1 for 12–14)

| Score | Offer |
|---|---|
| 15–20 / 20 | 1 month free Pro trial code + 50% off for 3 months code |
| 12–14 / 20 | 50% off for 3 months code only |
| Below 12 | Product pitch only, no code |

Codes pulled from `Offer_Codes.sheet` (next available unused row in the appropriate pool). Marked `reserved` before send, `sent` after. Glenn tops up pools by generating Stripe coupons and appending rows.

### Additional guardrails

- No more than 2 contacts from same platform community per day
- 48-hour minimum between contacting two accounts that follow each other
- Dormant accounts (no post in past 14 days) skipped
- Cold Lane never double-sends — Warm Lane owns all follow-ups

### Steady-state output (month 2+)

Pipeline holds 100–150 scored pending candidates at any time. 5 contacts/day = ~150/month. Expected reply rate 10–20% = 15–30 replies/month.

---

## Section 4: Warm Nurture Lane

**Event-driven. Runs daily at 10:30. Two scheduled exceptions: 7/14-day follow-up sequences.**

### Trigger sources

| Source | Monitoring method |
|---|---|
| Cold DM replies | `Candidate_Pipeline.sheet` + email IMAP + X DM inbox via Grok |
| @DividendMapper X mentions | Grok API — daily scan |
| LinkedIn company page comments | Browser automation — checks recent post comments |
| Email inbox | `marketing@dividendmapper.com` via IMAP |

### Response logic

**Positive reply (replied-yes or expressed interest)**  
Sends welcome email from `marketing@dividendmapper.com`. Confirms offer code already sent (or sends now if not already included). Flags row as `high-engagement` in `Candidate_Pipeline.sheet` if reply contains specific questions or portfolio detail — surfaces in Friday digest for Glenn to consider super user designation. No super user offer made autonomously.

**Negative reply**  
Logs `replied-no`, closes row. "Not right now" → sets 60-day revisit flag; on expiry Hermes re-scores the candidate against current product state and re-queues as `pending` if score is still 12+ (T212 sync will have shipped by then, raising the value proposition).

**No reply — day 7**  
Follow-up 1: shorter, different angle. If original DM led with founding-member offer, pivots to product ("shipped equity scoring this week, thought it might be relevant given your HYP focus"). Includes offer code for 12–14 score candidates if not already sent.

**No reply — day 14**  
Follow-up 2: one-sentence close ("no worries if the timing's off — happy to reconnect when T212 sync ships"). Auto-pass. No third contact.

**@DividendMapper X mention**  
Replies helpfully within same daily run. Links to relevant blog post if one exists. No codes in public replies. Bug reports and support questions → `needs-Glenn` flag, surfaces in digest.

**LinkedIn comment**  
Brief helpful reply. Links to relevant blog post or `/pricing` if they ask about features or cost.

### Escalation to Glenn (Friday digest, top section)

- Product support or bug reports
- Press, journalist, or investor contact (detected by domain/handle patterns)
- High-value partnership or integration enquiry
- Any `high-engagement` candidate Glenn should consider for super user designation
- Suggested Brand_Voice.doc updates based on performance data (Glenn accepts or ignores)

Hermes never: offers super user status, mentions the WhatsApp group, sends a founding-member code without `superuser-approved` tag on the candidate row.

---

## Section 5: Scheduling, Memory Model & LinkedIn Setup

### Cron schedule

| Time | Day | Job |
|---|---|---|
| 07:00 | Daily | News check — RSS scan for reactive content triggers |
| 08:00 | Monday | Content Engine primary run |
| 09:00 | Daily | Forum Monitor + Channel Discovery |
| 10:00 | Daily | Cold Outreach run |
| 10:30 | Daily | Warm Nurture sweep |
| 08:00 | Tuesday | Contact Source Discovery |
| 08:00 | Wednesday | Firecrawl bulk extraction |
| 17:00 | Friday | Weekly digest to `grodgers1@googlemail.com` |

Reactive content run (triggered by 07:00 news check) fires immediately and completes before 09:00 forum scan.

### Memory model

**SQLite (session memory)** — Hermes built-in. Working memory for current session. Automatically summarised between sessions. Crash recovery: Hermes reconstructs run state from this layer.

**Google Drive (operational memory)** — Source of truth for persistent state. Drive wins over SQLite on any conflict. Human-readable and editable by Glenn at any time to steer Hermes without touching agent config.

**Brand_Voice.doc (constitutional memory)** — Loaded at start of every content/outreach task. Glenn-edit only — Hermes never modifies it autonomously. Proposed updates appear in Friday digest for Glenn to accept.

### Self-improvement loop

Hermes accumulates performance data in the weekly digest and refines over time:
- Content: up-weights angles with highest X engagement after 8 weeks of data
- Outreach: tracks reply rate by opener style and platform; proposes template refinements in digest
- Channel quality: up-weights sources producing most 15+ scored candidates in Firecrawl priority queue
- Forum: adjusts education/natural-mention/direct-comparison ratio based on reply and upvote data

### LinkedIn setup path

**Phase 1 (immediate):** Glenn creates DividendMapper company page. Glenn stores LinkedIn session credentials in Hermes config. Hermes posts via browser automation. Glenn applies for LinkedIn Community Management API access (free, covers company page posting, ~2–4 weeks approval).

**Phase 2 (month 2):** Switch to LinkedIn API once approved. Retire browser automation for LinkedIn. Credential swap via `hermes setup`.

### Cost summary

| Component | Monthly |
|---|---|
| Hermes LLM (OpenAI OAuth, local) | sub £20 |
| Grok Super Lite (X access + fallback model) | $10 |
| Firecrawl (free tier, 500 credits/month) | £0 |
| **Total** | **~£28–30** |

---

## Expected Results — 3-Month Horizon

| Metric | Month 1 | Month 3 |
|---|---|---|
| Blog posts published | 4–5 | 14–18 cumulative |
| Organic blog sessions | ~50 | 200–600 |
| X followers | 30–80 | 150–400 |
| LinkedIn page followers | 10–30 | 50–150 |
| Cold contacts sent | ~100 | ~450 cumulative |
| Pipeline replies | 10–20 | 45–90 cumulative |
| Monitored channels | 10–12 | 18–25 |

SEO is slow — meaningful search traffic realistically starts in month 3 and compounds into month 6. X and forum activity are the faster near-term top-of-funnel. Cold outreach is the highest-intent channel in months 1–2 while SEO is building.

---

## What Hermes Does Not Do

- Make investment recommendations
- Offer super user status (Glenn-only)
- Mention the WhatsApp group
- Send founding-member codes without `superuser-approved` tag
- Handle product support or bug reports
- Run Reddit launch posts, Product Hunt, Show HN, or press pitches
- Manage transactional emails, Resend, or Supabase (handled in project)
- Fabricate content references in DM openers (reads content directly via browser + vision)
