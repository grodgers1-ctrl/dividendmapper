# Hermes Marketing Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure Hermes as DividendMapper's autonomous marketing engine: content flywheel (blog → X → LinkedIn), forum monitor with channel discovery, cold outreach pipeline with Firecrawl, warm nurture with Stripe offer codes, and a weekly digest to Glenn.

**Architecture:** Skills are markdown instruction files Hermes loads and executes on schedule. Google Drive is the operational memory layer — Hermes reads state at run start and writes results back. Brand_Voice.doc is the constitutional layer loaded before every public-facing task.

**Tech Stack:** Hermes (Nous Research, local), OpenAI API (primary LLM), Grok Super Lite (fallback + X API access), Firecrawl (free tier, 500 credits/month), Google Drive (memory), Stripe (offer codes), IMAP/SMTP (marketing@dividendmapper.com), LinkedIn browser automation

**Spec:** `docs/superpowers/specs/2026-05-24-hermes-marketing-agent-design.md`

---

> **This plan is split into four sequential phases.** Each phase produces a working, independently testable system. Complete Phase 1 before starting Phase 2.
>
> - **This document:** Phase 1 (Foundation) + Phase 2 (Content Engine)
> - **Follow-on Plan A:** Forum Monitor + Channel Discovery
> - **Follow-on Plan B:** Cold Outreach Lane (Contact Source Discovery + Firecrawl + Daily Outreach)
> - **Follow-on Plan C:** Warm Nurture Lane + Weekly Digest

---

## File Structure

```
~/hermes-dividendmapper/
  skills/
    00-brand-voice-loader.md         # Loads Brand_Voice.doc from Drive; output used by all other skills
    01-news-checker.md               # Daily 07:00: RSS scan, returns trigger flag + topic if news fires
    02-content-engine.md             # Monday 08:00 + reactive: blog → X thread → LinkedIn post
  drive-setup/
    brand-voice.md                   # Full Brand_Voice.doc text ready to paste into Drive
    spreadsheet-schemas.md           # Column definitions for all 7 Drive sheets (paste into a doc for reference)
    topic-ideas-seed.md              # 10 seed topics for Topic_Ideas.doc
  crons.md                           # All cron schedule definitions (natural language, paste into Hermes)
```

---

## Task 1: Create Project Directory and Verify Hermes Integrations

**Files:**
- Create: `~/hermes-dividendmapper/` (directory)
- Create: `~/hermes-dividendmapper/skills/` (directory)
- Create: `~/hermes-dividendmapper/drive-setup/` (directory)

- [ ] **Step 1: Create the project directory**

```bash
mkdir -p ~/hermes-dividendmapper/skills
mkdir -p ~/hermes-dividendmapper/drive-setup
```

- [ ] **Step 2: Verify Hermes is installed and running**

```bash
hermes --version
```

Expected: version string (e.g. `hermes v0.7.0`). If not found, run the Hermes installer first: `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`

- [ ] **Step 3: Verify OpenAI is configured as primary model**

```bash
hermes model
```

Expected: shows OpenAI as active model. If not: `hermes model` then follow the wizard to set OpenAI OAuth credentials.

- [ ] **Step 4: Configure Grok as fallback model for X access**

```bash
hermes model --add-fallback
```

Follow the wizard: select Grok Super Lite, enter your xAI API key (from the Grok Super Lite subscription dashboard at x.ai/api). Grok will be used as the X API access layer.

- [ ] **Step 5: Configure email gateway (marketing@dividendmapper.com)**

```bash
hermes gateway setup
```

Select Email/IMAP-SMTP. Enter:
- IMAP host: `imap.improvmx.com` (or your actual mail provider for marketing@dividendmapper.com)
- SMTP host: your outbound SMTP provider
- Username: `marketing@dividendmapper.com`
- Password: your email password or app password

Verify by sending a test message through the gateway.

- [ ] **Step 6: Configure Google Drive integration**

```bash
hermes setup --integration google-drive
```

Follow the OAuth wizard. Grant Hermes read/write access to Drive. Verify by asking Hermes: `hermes "list my Google Drive root folder"` — it should return your Drive file list.

- [ ] **Step 7: Store LinkedIn session credentials**

```bash
hermes setup --credential linkedin
```

Enter your LinkedIn email and password. Hermes stores these for browser automation against the DividendMapper company page. (You must have already created the DividendMapper LinkedIn company page and be an admin of it.)

- [ ] **Step 8: Configure Firecrawl API key**

```bash
hermes setup --env FIRECRAWL_API_KEY=<your-firecrawl-api-key>
```

Get your free-tier API key from firecrawl.dev. Free tier = 500 credits/month.

- [ ] **Step 9: Commit project structure**

```bash
cd ~/hermes-dividendmapper
git init
echo "# Hermes DividendMapper Marketing Agent" > README.md
git add README.md
git commit -m "feat: initialise hermes-dividendmapper project"
```

---

## Task 2: Create Google Drive Folder and Document Shells

**Files:**
- Create (in Drive): `DividendMapper/Hermes/Brand_Voice` (Google Doc)
- Create (in Drive): `DividendMapper/Hermes/Content_Calendar` (Google Sheet)
- Create (in Drive): `DividendMapper/Hermes/Published_Archive` (Google Sheet)
- Create (in Drive): `DividendMapper/Hermes/Candidate_Pipeline` (Google Sheet)
- Create (in Drive): `DividendMapper/Hermes/Offer_Codes` (Google Sheet)
- Create (in Drive): `DividendMapper/Hermes/Channel_Discovery` (Google Sheet)
- Create (in Drive): `DividendMapper/Hermes/Contact_Sources` (Google Sheet)
- Create (in Drive): `DividendMapper/Hermes/Topic_Ideas` (Google Doc)

- [ ] **Step 1: Create the Drive folder**

In Google Drive, create a folder at root level: `DividendMapper` → inside it, create a subfolder: `Hermes`.

- [ ] **Step 2: Create the eight documents**

Inside `DividendMapper/Hermes/`, create these files manually (right-click → New):
- Google Doc: `Brand_Voice`
- Google Doc: `Topic_Ideas`
- Google Sheet: `Content_Calendar`
- Google Sheet: `Published_Archive`
- Google Sheet: `Candidate_Pipeline`
- Google Sheet: `Offer_Codes`
- Google Sheet: `Channel_Discovery`
- Google Sheet: `Contact_Sources`

- [ ] **Step 3: Note the folder URL**

Copy the URL of the `DividendMapper/Hermes` folder from your browser. You will paste this into the brand-voice-loader skill in Task 5.

Expected format: `https://drive.google.com/drive/folders/<folder-id>`

---

## Task 3: Seed Brand_Voice.doc

**Files:**
- Create: `~/hermes-dividendmapper/drive-setup/brand-voice.md` (source of truth for Brand_Voice.doc content)
- Modify (in Drive): `DividendMapper/Hermes/Brand_Voice` (paste the content)

- [ ] **Step 1: Write the brand-voice source file**

Create `~/hermes-dividendmapper/drive-setup/brand-voice.md` with the following content:

```markdown
# DividendMapper Brand Voice — Hermes Constitutional Memory
Last updated: 2026-05-24
HERMES: Load this document in full at the start of every content or outreach task. Do not skip sections.

---

## 1. Humaniser — 24-Pattern Checklist
Run every draft through all 24 patterns before sending or publishing. Fix any match before proceeding.

1. Em dashes (—) — replace with comma or full stop
2. Rule of three in prose ("X, Y, and Z" parallel phrasing) — break to two or four items
3. AI vocabulary: additionally, delve, pivotal, intricate, vibrant, tapestry, showcase, underscore, testament, landscape, fostering, elevate, revolutionise, seamlessly
4. Copula avoidance (serves as, stands as, marks, represents, boasts) — use is/are/has
5. Negative parallelisms ("not just X, but Y", "it's not merely a tool, it's a...")
6. Promotional language (groundbreaking, breathtaking, must-have, stunning, game-changing)
7. Vague attributions ("experts say", "industry reports", "studies show")
8. Superficial -ing endings ("highlighting...", "ensuring...", "fostering...", "empowering...")
9. Sycophantic tone ("great question!", "absolutely", "certainly!", "of course!")
10. Filler phrases ("in order to", "due to the fact that", "at this point in time", "it is worth noting")
11. Excessive hedging ("could potentially possibly", "may perhaps", "might conceivably")
12. Generic positive endings ("the future looks bright", "exciting times ahead")
13. Curly quotes (" ") — replace with straight quotes (")
14. Knowledge-cutoff disclaimers ("as of [date]", "based on available information", "to my knowledge")
15. Collaborative artifacts ("I hope this helps", "let me know if you have questions", "feel free to reach out")
16. Passive constructions where active is cleaner ("it was decided" → "we decided")
17. Overlong sentences (over 30 words) — split into two
18. Hedged first sentences ("In today's fast-paced world...") — cut and start with the point
19. Excessive capitalisation of common nouns (Portfolio, Calculator, Dashboard unless proper noun)
20. Formulaic structure: problem → solution → benefit in every paragraph — vary the flow
21. "Key" as an adjective ("key takeaways", "key features", "key points")
22. "Dive into" or "deep dive"
23. Rhetorical questions used as section headers ("But what does this mean for you?")
24. Offer preconditions as states not actions — write "if you give it a go" not "if it's not right for you"

---

## 2. Tone Rules

- UK register throughout: ISA not IRA (unless US-specific content), dividend allowance not dividend deduction, "stocks and shares ISA" not "stock market ISA"
- Direct and opinionated — DividendMapper has a point of view, it is not neutral
- Never make specific investment recommendations ("buy this stock", "this is a good investment")
- No promotional superlatives (see humaniser pattern 6)
- No fabricated content references in outreach — only reference content Hermes has actually read via browser in the current session
- Polls are a locked content type until @DividendMapper reaches 500 followers or calendar month reaches September 2026, whichever comes first. Do not write or post polls before this milestone.

---

## 3. Product Facts

**Pricing:**
- Free: £0 — calculators, public dividend data, manual portfolio up to 10 holdings
- Pro: £15/month or £144/year — broker auto-sync, dividend calendar, alerts, unlimited holdings
- Premium: £45/month or £432/year — AI analyst, tax reports, multi-portfolio, PDF exports

**Current live features (as of 2026-05-24):**
- Retirement calculator (UK/US locale toggle)
- DCF calculator
- Manual portfolio entry (add/delete holdings)
- Portfolio income view (per-row income, grouped by wrapper and currency)
- Equity scoring: Buy, Trim, Risk, Reinvest Recommender (Phase 2.75)
- Magic-link sign-in (Supabase auth)
- Stripe billing (Pro monthly + annual, founding-member coupon codes)
- Resend email (welcome, OTP fallback)

**Roadmap (do not present as confirmed dates, present as "coming"):**
- Phase 3: Trading 212 broker auto-sync (UK first-mover)
- Phase 4: US brokers via SnapTrade (Schwab, Fidelity, Robinhood)
- Phase 5: CSV imports (HL, AJ Bell, Freetrade)
- Phase 6: AI analyst, tax reports, PDF exports, public portfolio pages

---

## 4. Competitor Data

| Tool | Price | Key weakness vs DividendMapper |
|---|---|---|
| Sharesight | £100+/year | No UK tax wrapper awareness; expensive |
| Simply Wall St | ~£120/year | Analysis-focused, not income/dividend-focused |
| Snowball Analytics | ~£50/year | No UK SIPP/ISA rules; US-biased |
| Stock Events | Free/paid | Calendar-only, no income projection |

When comparing, always lead with what DividendMapper does rather than attacking competitors. One specific factual difference is enough.

---

## 5. Offer Tiers (Cold Outreach)

Hermes may extend these offers autonomously based on candidate score. No other offers or statuses are available to Hermes.

| Candidate score | Offer |
|---|---|
| 15–20 / 20 | 1 month free Pro trial code + 50% off for 3 months code (both in initial DM) |
| 12–14 / 20 | 50% off for 3 months code only (in Follow-up 1, not initial DM) |
| Below 12 | Product pitch only, no code |

Codes are drawn from Offer_Codes.sheet. Pull the next available row in the correct pool. Mark it `reserved` before sending, `sent` after.

---

## 6. Escalation Rules — What Goes to Glenn

Hermes handles these autonomously: blog posts, X threads, LinkedIn posts, forum replies, cold DM sends, follow-up sequences, offer code distribution.

Hermes escalates to Glenn (flags in weekly digest, does NOT handle autonomously):
- Product support requests or bug reports
- Press, journalist, or investor contacts (identified by media domain or "journalist"/"writer"/"editor" in bio)
- Partnership or integration enquiries
- Any candidate Glenn should consider for super user designation (flag as `needs-Glenn` in Candidate_Pipeline.sheet)
- Proposed updates to this Brand_Voice.doc

---

## 7. Hard Prohibitions

Hermes NEVER:
- Offers super user status
- Mentions the WhatsApp founding members group
- Sends a founding-member code without a `superuser-approved` tag on the candidate row in Candidate_Pipeline.sheet
- Makes investment recommendations
- Fabricates content references (must read content via browser before referencing it)
- Posts polls before the milestone defined in section 2
- Contacts the same person twice within 48 hours
- Sends more than 5 cold contacts per day across all channels
- Exceeds 3 forum replies per platform per day
```

- [ ] **Step 2: Paste the content into Google Drive**

Open `DividendMapper/Hermes/Brand_Voice` in Drive. Paste the full content of `~/hermes-dividendmapper/drive-setup/brand-voice.md`. Save.

- [ ] **Step 3: Verify Hermes can read it**

```bash
hermes "Read the Google Drive document called Brand_Voice in the DividendMapper/Hermes folder and tell me how many humaniser patterns it lists"
```

Expected: Hermes responds with "24".

- [ ] **Step 4: Commit the source file**

```bash
cd ~/hermes-dividendmapper
git add drive-setup/brand-voice.md
git commit -m "feat: add Brand_Voice.doc content — constitutional memory for all hermes tasks"
```

---

## Task 4: Seed All Drive Spreadsheets

**Files:**
- Create: `~/hermes-dividendmapper/drive-setup/spreadsheet-schemas.md`
- Modify (in Drive): all 6 Google Sheets (add column headers)

- [ ] **Step 1: Write the schema reference file**

Create `~/hermes-dividendmapper/drive-setup/spreadsheet-schemas.md`:

```markdown
# Drive Spreadsheet Schemas

## Content_Calendar.sheet
Columns (Row 1 headers):
week_of | topic | content_type | status | blog_url | x_thread_url | linkedin_url | publish_date | notes

content_type values: primary | reactive
status values: planned | in-progress | published

## Published_Archive.sheet
Columns (Row 1 headers):
date | title | type | blog_url | x_thread_url | linkedin_url | reactive | reply_text_hash | engagement_notes

type values: blog | reactive-blog | forum-reply | x-standalone
reply_text_hash: MD5 or SHA1 of the reply body text (prevents duplicate phrasing in forum replies)

## Candidate_Pipeline.sheet
Columns (Row 1 headers):
handle | platform | score | status | contact_method | found_date | sent_date | followup1_date | followup2_date | offer_tier | code_sent | opener_topic | high_engagement | needs_glenn | superuser_approved | revisit_date | notes

platform values: youtube | x | t212-forum | reddit | lemon-fool | mse | email | substack | blog
status values: pending | dm-sent | followup1-sent | followup2-sent | replied-yes | replied-no | replied-not-yet | passed | revisit
offer_tier values: both | discount-only | none

## Offer_Codes.sheet
Columns (Row 1 headers):
code | pool | status | reserved_for | reserved_date | sent_date

pool values: 1-month-free | 50pct-3months
status values: available | reserved | sent

## Channel_Discovery.sheet
Columns (Row 1 headers):
platform | url | audience_fit | rules_stance | status | first_seen | added_to_monitor | notes

platform values: reddit | forum | discord | slack | substack | newsletter | blog | youtube
rules_stance values: open | strict | no-promo
status values: candidate | verified | monitoring | retired

## Contact_Sources.sheet
Columns (Row 1 headers):
url | type | audience_fit | last_scraped | candidates_extracted | firecrawl_credits_used | status | notes

type values: youtube-directory | forum-members | substack-index | blog-about | newsletter | investment-club
status values: candidate | ready-to-scrape | active | retired
```

- [ ] **Step 2: Add column headers to Content_Calendar.sheet**

Open `DividendMapper/Hermes/Content_Calendar` in Drive. In Row 1, enter these headers across columns A–I:
`week_of | topic | content_type | status | blog_url | x_thread_url | linkedin_url | publish_date | notes`

- [ ] **Step 3: Add column headers to Published_Archive.sheet**

Open `Published_Archive`. Row 1 headers across columns A–I:
`date | title | type | blog_url | x_thread_url | linkedin_url | reactive | reply_text_hash | engagement_notes`

- [ ] **Step 4: Add column headers to Candidate_Pipeline.sheet**

Open `Candidate_Pipeline`. Row 1 headers across columns A–R:
`handle | platform | score | status | contact_method | found_date | sent_date | followup1_date | followup2_date | offer_tier | code_sent | opener_topic | high_engagement | needs_glenn | superuser_approved | revisit_date | notes`

- [ ] **Step 5: Add column headers to Offer_Codes.sheet**

Open `Offer_Codes`. Row 1 headers across columns A–F:
`code | pool | status | reserved_for | reserved_date | sent_date`

- [ ] **Step 6: Add column headers to Channel_Discovery.sheet**

Open `Channel_Discovery`. Row 1 headers across columns A–H:
`platform | url | audience_fit | rules_stance | status | first_seen | added_to_monitor | notes`

- [ ] **Step 7: Add column headers to Contact_Sources.sheet**

Open `Contact_Sources`. Row 1 headers across columns A–H:
`url | type | audience_fit | last_scraped | candidates_extracted | firecrawl_credits_used | status | notes`

- [ ] **Step 8: Seed Channel_Discovery.sheet with the 7 known channels**

Add these rows (status = `monitoring` for all):

| platform | url | audience_fit | rules_stance | status | first_seen | added_to_monitor |
|---|---|---|---|---|---|---|
| reddit | https://reddit.com/r/UKInvesting | ISA/SIPP/dividend income | strict | monitoring | 2026-05-24 | 2026-05-24 |
| reddit | https://reddit.com/r/FIREUK | Dividend FIRE numbers | strict | monitoring | 2026-05-24 | 2026-05-24 |
| reddit | https://reddit.com/r/dividends | General dividend discussion | open | monitoring | 2026-05-24 | 2026-05-24 |
| reddit | https://reddit.com/r/T212community | T212 SIPP and dividend tracking | open | monitoring | 2026-05-24 | 2026-05-24 |
| forum | https://community.trading212.com | T212 users, dividend/SIPP | strict | monitoring | 2026-05-24 | 2026-05-24 |
| forum | https://www.lemonfool.co.uk | HYP threads, ISA discussions | open | monitoring | 2026-05-24 | 2026-05-24 |
| forum | https://www.moneysavingexpert.com/forum | ISA, SIPP, dividend income | strict | monitoring | 2026-05-24 | 2026-05-24 |

- [ ] **Step 9: Commit the schema file**

```bash
cd ~/hermes-dividendmapper
git add drive-setup/spreadsheet-schemas.md
git commit -m "feat: add drive spreadsheet schemas and seed channel discovery"
```

---

## Task 5: Seed Topic_Ideas.doc and Generate Stripe Offer Codes

**Files:**
- Create: `~/hermes-dividendmapper/drive-setup/topic-ideas-seed.md`
- Modify (in Drive): `DividendMapper/Hermes/Topic_Ideas`
- Modify (in Drive): `DividendMapper/Hermes/Offer_Codes` (paste generated codes)

- [ ] **Step 1: Write the topic-ideas seed file**

Create `~/hermes-dividendmapper/drive-setup/topic-ideas-seed.md`:

```markdown
# Topic_Ideas — Seed List
HERMES: When Content_Calendar.sheet has no queued topic, read this document and pick the highest-priority unused topic. Mark it as used by appending "(used: YYYY-MM-DD)" after the topic line.

## DividendMapper-Specific (Priority 1)
- Sharesight vs DividendMapper: what £100/year actually gets you (competitor comparison)
- How DividendMapper calculates your retirement income number (explainer)
- Equity scoring explained: what Buy, Trim, and Risk mean for your portfolio (Phase 2.75 feature)
- How ISA dividend income is treated differently from GIA income in DividendMapper (education + product)
- T212 SIPP: what it is, what it costs, and when DividendMapper sync arrives (roadmap preview)

## UK Dividend Education (Priority 2)
- The dividend allowance is falling: what UK investors need to know for 2026/27
- SIPP vs GIA for dividend income: which wrapper wins at different income levels
- What a High Yield Portfolio (HYP) actually means and how to track one
- How DRIP (dividend reinvestment plans) work in a UK ISA and why it matters for FIRE
- The difference between yield on cost and current yield, and why both matter

## Standing News Triggers (Priority 3 — only use when genuinely newsworthy)
- SpaceX IPO: should UK income investors care? (use when IPO is confirmed/priced)
- Budget dividend tax announcement: what it means for your ISA/GIA split
- FTSE 100 dividend yield hits X%: which sectors are paying (use when stat is current)
- ISA allowance confirmed for 2027/28: planning implications
```

- [ ] **Step 2: Paste into Drive**

Open `DividendMapper/Hermes/Topic_Ideas` in Drive. Paste the full content of the seed file. Save.

- [ ] **Step 3: Generate 1-month-free Stripe coupon codes (20 codes)**

In Stripe dashboard (test mode first, then live):
- Create a coupon: Duration = once, 100% off, Max redemptions = 1 per code
- Generate 20 unique codes with prefix `DM1MFREE-`
- Export or copy the 20 codes

Once satisfied with test mode, repeat in live mode.

- [ ] **Step 4: Generate 50%-for-3-months Stripe coupon codes (30 codes)**

- Create a coupon: Duration = 3 months, 50% off, Max redemptions = 1 per code
- Generate 30 unique codes with prefix `DM50PCT3M-`

- [ ] **Step 5: Populate Offer_Codes.sheet**

Open `Offer_Codes`. Add one row per code:
- `1-month-free` pool: 20 rows, status = `available`
- `50pct-3months` pool: 30 rows, status = `available`

- [ ] **Step 6: Commit seed file**

```bash
cd ~/hermes-dividendmapper
git add drive-setup/topic-ideas-seed.md
git commit -m "feat: add topic ideas seed list for content engine"
```

---

## Task 6: Write and Test the Brand-Voice-Loader Skill

**Files:**
- Create: `~/hermes-dividendmapper/skills/00-brand-voice-loader.md`

This skill is not scheduled directly. It is called by every other skill as its first step.

- [ ] **Step 1: Write the skill file**

Create `~/hermes-dividendmapper/skills/00-brand-voice-loader.md`:

```markdown
# Brand Voice Loader
This is a sub-skill called at the start of every content and outreach task. Do not call this skill directly on a schedule.

## What this skill does
Loads the Brand_Voice document from Google Drive into your active context. After loading, confirm you have read it by stating the number of humaniser patterns listed. Do not proceed with any content or outreach task until you have confirmed this.

## Steps

1. Open Google Drive and navigate to the folder `DividendMapper/Hermes`.
2. Open the document named `Brand_Voice`.
3. Read the entire document.
4. Confirm internally: how many humaniser patterns are listed in Section 1? The answer must be 24. If you count a different number, re-read Section 1 before proceeding.
5. Load the following into your working context for this session:
   - All 24 humaniser pattern names (you will check output against these)
   - The tone rules from Section 2
   - Current product facts and pricing from Section 3
   - Competitor data from Section 4
   - Offer tier thresholds from Section 5
   - Escalation rules from Section 6
   - Hard prohibitions from Section 7
6. Return: "Brand voice loaded. 24 humaniser patterns active. [date] [time]"

## On failure
If the Drive document cannot be opened, stop and report: "Brand voice load failed — Drive access error. Do not proceed with content or outreach tasks until this is resolved."
```

- [ ] **Step 2: Register the skill with Hermes**

```bash
hermes skill add ~/hermes-dividendmapper/skills/00-brand-voice-loader.md
```

Expected: Hermes confirms the skill is registered.

- [ ] **Step 3: Test the skill**

```bash
hermes run 00-brand-voice-loader
```

Expected output includes: `"Brand voice loaded. 24 humaniser patterns active."` and a timestamp. If Hermes cannot access Drive, check the Google Drive integration from Task 1 Step 6.

- [ ] **Step 4: Commit**

```bash
cd ~/hermes-dividendmapper
git add skills/00-brand-voice-loader.md
git commit -m "feat: add brand-voice-loader sub-skill"
```

---

## Task 7: Write and Test the News-Checker Skill

**Files:**
- Create: `~/hermes-dividendmapper/skills/01-news-checker.md`

- [ ] **Step 1: Write the skill file**

Create `~/hermes-dividendmapper/skills/01-news-checker.md`:

```markdown
# News Checker
Runs daily at 07:00 UK time. Scans RSS feeds and news sources for financial events that warrant a reactive content run. Returns a trigger decision and topic to the content engine.

## RSS Sources to Check (check all, in order)
- https://feeds.bbci.co.uk/news/business/rss.xml (BBC Business)
- https://www.thisismoney.co.uk/money/rss/index.xml (This is Money)
- https://www.ft.com/rss/home (FT — may be paywalled, scan headlines only)
- https://www.fca.org.uk/news/rss.xml (FCA news)
- https://blog.sharesight.com/feed/ (Sharesight blog — competitor moves)
- https://community.trading212.com/latest.rss (T212 forum — product announcements)

## Trigger Criteria
A reactive content run fires if ANY of the following appear in today's headlines or posts:

1. ISA allowance change announcement (keywords: "ISA limit", "ISA allowance 2027", "ISA cap")
2. UK dividend tax change (keywords: "dividend allowance", "dividend tax", "Budget dividend")
3. SIPP rule update (keywords: "SIPP", "pension drawdown", "FCA pension")
4. Major UK or US IPO confirmed or priced (keywords: "IPO", "floats", "listing" — only if market cap > £5bn)
5. Sharesight pricing or feature announcement (source: Sharesight blog)
6. T212 product announcement (source: T212 forum — only if it affects SIPP or dividend features)
7. FTSE 100 dividend yield at a notable milestone (keywords: "FTSE dividend", "FTSE yield record")

## Steps

1. Fetch each RSS feed URL using web search or browser. Read all headlines published in the past 24 hours.
2. Check each headline against the 7 trigger criteria above.
3. If no trigger fires: output `TRIGGER: none` and stop. The content engine Monday run is not affected.
4. If a trigger fires: output the following and stop:
   ```
   TRIGGER: yes
   EVENT: [one sentence describing the event]
   TOPIC: [proposed blog post angle — one sentence, must have a clear DividendMapper tie-in]
   SOURCE_URL: [URL of the original news item]
   ```
5. Do not trigger on opinion pieces, analysis, or commentary — only on factual announcements.
6. If multiple triggers fire in one day, report only the highest-priority one (use the order above as priority).

## Output format
Plain text. No markdown formatting in the output. The content engine reads this output directly.
```

- [ ] **Step 2: Register the skill**

```bash
hermes skill add ~/hermes-dividendmapper/skills/01-news-checker.md
```

- [ ] **Step 3: Test the skill (dry run)**

```bash
hermes run 01-news-checker
```

Expected: either `TRIGGER: none` (most days) or a structured trigger block. Verify the skill checked at least 3 of the 6 RSS sources by asking Hermes to show its working.

- [ ] **Step 4: Commit**

```bash
cd ~/hermes-dividendmapper
git add skills/01-news-checker.md
git commit -m "feat: add news-checker skill — daily RSS trigger for reactive content"
```

---

## Task 8: Write the Content Engine Skill

**Files:**
- Create: `~/hermes-dividendmapper/skills/02-content-engine.md`

- [ ] **Step 1: Write the skill file**

Create `~/hermes-dividendmapper/skills/02-content-engine.md`:

```markdown
# Content Engine
Runs every Monday at 08:00 UK time (primary run) and immediately after a positive news-checker trigger (reactive run). Produces one blog post, one X thread, and one LinkedIn post per run.

## Run modes
- PRIMARY: Full 1,500-word blog post + X thread + LinkedIn post. Triggered every Monday.
- REACTIVE: 800-word blog post + X thread only (no LinkedIn). Triggered by news-checker returning TRIGGER: yes.

In reactive mode, the EVENT and TOPIC from the news-checker output replace the topic selection step below.

---

## Phase 1: Topic Selection (PRIMARY mode only)

1. Run sub-skill: 00-brand-voice-loader. Do not proceed until it returns "Brand voice loaded."
2. Open `DividendMapper/Hermes/Content_Calendar.sheet` in Google Drive.
3. Find the first row where status = `planned`. If found, use that topic and set its status to `in-progress`. Go to Phase 2.
4. If no planned row exists, open `DividendMapper/Hermes/Topic_Ideas` in Google Drive.
5. Find the first topic without a "(used: ...)" marker. Choose it as this week's topic. Append "(used: [today's date])" to that line in the document.
6. Check `DividendMapper/Hermes/Published_Archive.sheet`. Search the `title` column for any post covering the same subject in the past 60 days. If found, skip this topic and try the next unused one from Topic_Ideas.
7. Write a new row to `Content_Calendar.sheet`: week_of=[Monday's date], topic=[chosen topic], content_type=primary, status=in-progress.

---

## Phase 2: Blog Post Draft

1. Web search: find 2–3 authoritative UK sources on the topic (HMRC, FCA, gov.uk, FT, This is Money). Note their URLs — you will cite these for any tax figures or regulatory facts.
2. Write the blog post. Requirements:
   - PRIMARY mode: 1,400–1,600 words
   - REACTIVE mode: 750–900 words
   - Audience: UK dividend investors (ISA/SIPP/GIA aware, dividend-focused, FIRE-curious)
   - Structure: open with the point (no "In today's world..." openers), cover the subject, include at least one concrete number or example relevant to a UK investor, close with a natural mention of DividendMapper if the topic connects to portfolio tracking or income projection
   - Verify every tax rate, ISA limit, and allowance figure against the gov.uk or HMRC source you found. Do not publish unverified figures.
   - Do NOT make investment recommendations ("buy X", "X is a good stock")
3. Run the 24-pattern humaniser checklist from Brand_Voice.doc against the full draft. Fix every match.
4. Format as markdown ready for the dividendmapper.com blog (frontmatter: title, date, description, tags).

---

## Phase 3: Publish Blog Post

1. Open a browser and navigate to the dividendmapper GitHub repository.
2. Navigate to the blog content directory (the path used by existing blog posts — check the repo structure to confirm the exact folder).
3. Create a new file named `YYYY-MM-DD-<slug>.md` where slug is a URL-friendly version of the title.
4. Paste the markdown blog post content.
5. Commit the file with message: `content: add blog post — [title]`
6. Vercel will auto-deploy. Wait 60 seconds then open the live URL to confirm the post is accessible.
7. Copy the live blog post URL.

---

## Phase 4: X Thread

1. Repurpose the blog post into an X thread of 10–12 tweets:
   - Tweet 1 (hook): One punchy sentence — a specific stat, a bold claim, or a direct question. Not a summary. Max 200 characters leaving room for a 1/N label.
   - Tweets 2–10: One main point per tweet. Each self-contained — a reader who sees only this tweet should understand it without context.
   - Final tweet: Link to the blog post URL. Tag @DividendMapper. Example: "Full breakdown at dividendmapper.com/blog/[slug] — and yes, DividendMapper tracks all of this automatically."
2. Run humaniser check on all tweets combined. Fix any match.
3. Check that no single tweet exceeds 280 characters.
4. Post the thread via Grok API to the @DividendMapper X account. Post tweet 1 first, then reply to it with tweet 2, reply to tweet 2 with tweet 3, and so on (standard thread structure).
5. Copy the URL of the first tweet in the thread.

---

## Phase 5: LinkedIn Post (PRIMARY mode only — skip in REACTIVE mode)

1. Repurpose the blog post into a LinkedIn post of 600–800 words:
   - Professional register — same content but written for someone who reads LinkedIn on their commute
   - Open with the main point or a relevant stat, not with "I'm excited to share..."
   - Body: cover the same ground as the blog, compressed
   - Close: "I wrote a longer breakdown on the DividendMapper blog — link in the first comment." (Do not put the URL in the post body — LinkedIn reduces reach for posts with external links in the body)
2. Run humaniser check. Fix any match.
3. Open a browser, navigate to the DividendMapper LinkedIn company page, log in using stored credentials.
4. Create a new post, paste the content, publish.
5. Immediately add the first comment: the blog post URL.

---

## Phase 6: Write-back to Drive

1. Open `DividendMapper/Hermes/Published_Archive.sheet`.
2. Append a new row:
   - date: today's date
   - title: blog post title
   - type: `blog` (or `reactive-blog` if REACTIVE mode)
   - blog_url: live blog post URL
   - x_thread_url: first tweet URL
   - linkedin_url: LinkedIn post URL (empty if REACTIVE mode)
   - reactive: FALSE (or TRUE if REACTIVE mode)
   - reply_text_hash: leave blank (used by forum monitor, not content engine)
   - engagement_notes: leave blank (filled in by weekly digest skill after 7 days)
3. Update `Content_Calendar.sheet` row to status = `published`, blog_url = [URL], publish_date = today.

---

## Error handling

- If blog publish to GitHub fails: save the draft markdown to `~/hermes-dividendmapper/drafts/[date]-[slug].md` and report the failure in the weekly digest. Do not post X thread or LinkedIn without the blog being live.
- If X post fails: report in weekly digest. Do not retry automatically — flag for Glenn.
- If LinkedIn login fails: report in weekly digest. Blog and X posts still publish if they succeeded.
- If Drive write-back fails: report in weekly digest. Content is still published.
```

- [ ] **Step 2: Register the skill**

```bash
hermes skill add ~/hermes-dividendmapper/skills/02-content-engine.md
```

- [ ] **Step 3: Commit**

```bash
cd ~/hermes-dividendmapper
git add skills/02-content-engine.md
git commit -m "feat: add content-engine skill — blog, X thread, LinkedIn pipeline"
```

---

## Task 9: Register Content Cron Schedules

**Files:**
- Create: `~/hermes-dividendmapper/crons.md`

- [ ] **Step 1: Write the crons reference file**

Create `~/hermes-dividendmapper/crons.md`:

```markdown
# Hermes DividendMapper — Cron Schedule Definitions
Register each schedule using: hermes schedule "<natural language expression>" "<skill name>"

## Phase 1 + 2 (Foundation + Content Engine)
hermes schedule "every day at 7am UK time" "01-news-checker"
hermes schedule "every Monday at 8am UK time" "02-content-engine in PRIMARY mode"

## Phase 3 (Forum Monitor — register after Phase 3 tasks complete)
hermes schedule "every day at 9am UK time" "03-forum-monitor"
hermes schedule "every day at 9am UK time" "04-channel-discovery"

## Phase 4 (Cold Outreach — register after Phase 4 tasks complete)
hermes schedule "every Tuesday at 8am UK time" "05-contact-source-discovery"
hermes schedule "every Wednesday at 8am UK time" "06-firecrawl-extraction"
hermes schedule "every day at 10am UK time" "07-cold-outreach"

## Phase 5 (Warm Nurture + Digest — register after Phase 5 tasks complete)
hermes schedule "every day at 10:30am UK time" "08-warm-nurture"
hermes schedule "every Friday at 5pm UK time" "09-weekly-digest"
```

- [ ] **Step 2: Register the news-checker cron**

```bash
hermes schedule "every day at 7am UK time" "01-news-checker"
```

Expected: Hermes confirms the schedule is registered and shows the next run time.

- [ ] **Step 3: Register the content engine cron**

```bash
hermes schedule "every Monday at 8am UK time" "02-content-engine in PRIMARY mode"
```

Expected: Hermes confirms the schedule. Next run should be the coming Monday.

- [ ] **Step 4: Verify the schedule list**

```bash
hermes schedule list
```

Expected: shows two active schedules — news-checker (daily 07:00) and content-engine (weekly Monday 08:00).

- [ ] **Step 5: Commit**

```bash
cd ~/hermes-dividendmapper
git add crons.md
git commit -m "feat: add cron schedule definitions — content engine phase live"
```

---

## Task 10: Supervised First Content Run

**Files:** None created. This task is a live supervised test.

- [ ] **Step 1: Trigger a manual news-checker run**

```bash
hermes run 01-news-checker
```

Read the output. Confirm it returns either `TRIGGER: none` or a valid structured trigger block.

- [ ] **Step 2: Trigger a manual content engine run in PRIMARY mode**

```bash
hermes run "02-content-engine in PRIMARY mode"
```

Watch the run. Hermes should:
1. Load Brand_Voice and confirm 24 patterns
2. Open Content_Calendar.sheet — find no planned topic (first run)
3. Open Topic_Ideas.doc — select the first topic (should be "Sharesight vs DividendMapper")
4. Search Published_Archive — confirm no duplicate
5. Write the blog post draft

**Pause here before Phase 3 (publish).** Read the draft. Check:
- Does it pass the humaniser patterns? (Read against the 24-point list)
- Are all tax figures cited against HMRC/gov.uk sources?
- Is the DividendMapper mention natural, not forced?
- Is the opening sentence direct (not "In today's world...")?

If the draft is acceptable, tell Hermes to continue: `hermes continue`

- [ ] **Step 3: Verify blog post is live**

Open the live URL Hermes reports. Confirm the post is accessible on dividendmapper.com.

- [ ] **Step 4: Verify X thread**

Check @DividendMapper on X. Confirm the thread posted correctly: 10–12 tweets, threaded as replies, final tweet contains the blog URL.

- [ ] **Step 5: Verify LinkedIn post**

Check the DividendMapper LinkedIn company page. Confirm the post published with the blog URL in the first comment.

- [ ] **Step 6: Verify Drive write-back**

Open `Published_Archive.sheet`. Confirm the new row is present with all URLs populated.
Open `Content_Calendar.sheet`. Confirm the row status is `published`.
Open `Topic_Ideas.doc`. Confirm the first topic has "(used: [today's date])" appended.

- [ ] **Step 7: Note any issues for Brand_Voice.doc**

If the first run produced content that needed corrections (repeated patterns, wrong tone, factual errors), update `Brand_Voice.doc` in Drive with clarifications. The self-improvement loop will pick these up on subsequent runs.

---

## Phase 1 + 2 Complete

Content flywheel is live. @DividendMapper posts one blog + thread + LinkedIn each Monday, with reactive runs on significant news.

**Next steps (separate implementation plans):**

**Follow-on Plan A — Forum Monitor + Channel Discovery**
Tasks: write `03-forum-monitor.md` and `04-channel-discovery.md` skills; register daily 09:00 cron; supervised first forum run.

**Follow-on Plan B — Cold Outreach Lane**
Tasks: write `05-contact-source-discovery.md`, `06-firecrawl-extraction.md`, `07-cold-outreach.md` skills; verify Firecrawl free-tier credit tracking; supervised first outreach run (1 contact only).

**Follow-on Plan C — Warm Nurture + Weekly Digest**
Tasks: write `08-warm-nurture.md` and `09-weekly-digest.md` skills; register event-driven and Friday crons; verify offer code draw from Offer_Codes.sheet end-to-end.

---

## Self-Review Checklist (completed inline)

- [x] **Spec coverage:** Foundation (Drive, integrations), Content Engine (blog, X, LinkedIn, reactive), scheduling — all covered. Forum Monitor, Cold Outreach, and Warm Nurture explicitly deferred to follow-on plans.
- [x] **Placeholder scan:** No TBDs or "implement later" phrases. All skill files contain complete instruction text.
- [x] **Type consistency:** Skill filenames consistent across crons.md and task steps. Drive document names consistent across Tasks 2–6 and skill files.
- [x] **Firecrawl:** Referenced in crons.md Phase 4 note only — not registered in this plan. Credit tracking left to Follow-on Plan B.
- [x] **Brand_Voice.doc content:** Full text included in Task 3, including all 24 humaniser patterns from the spec source file (`super_user/05-outreach-execution.md`).
