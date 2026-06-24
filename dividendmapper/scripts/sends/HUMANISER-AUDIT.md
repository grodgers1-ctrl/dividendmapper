# Humaniser self-audit — Sprint 4 launch comms

Auditor: Claude (Sprint 4 executor). The project's linter script (`scripts/lint/humaniser.js`) is referenced in the memory index but is not present in this checkout, so the audit below was run by hand against the documented 24 patterns. **Glenn must run the linter for real before any send.**

Drafts audited:
- `founding-member-vehicle-launch.txt`
- `dm-template-vehicle-launch.txt`
- `twitter-thread-vehicle-launch.txt`

## Patterns checked

| # | Pattern | Founding-member | Forum DM | Twitter thread |
|---|---------|-----------------|----------|----------------|
| 1 | Em-dashes (— and –) | One in line 4. **NEEDS REPLACEMENT** with a comma or full stop. | One in line 12 ("…RST…"). **NEEDS REPLACEMENT.** | NONE. Clean. |
| 2 | "Delve" / "delving" | NONE | NONE | NONE |
| 3 | "Leverage" (verb sense) | NONE | NONE | NONE |
| 4 | "Seamlessly" / "seamless" | NONE | NONE | NONE |
| 5 | "Ensure" / "ensuring" | NONE | NONE | NONE |
| 6 | "Utilise" / "utilize" | NONE | NONE | NONE |
| 7 | "In today's …" stock opener | NONE | NONE | NONE |
| 8 | "In the realm of …" | NONE | NONE | NONE |
| 9 | "It is important to note …" | NONE | NONE | NONE |
| 10 | "Furthermore" / "moreover" | NONE | NONE | NONE |
| 11 | "Robust" / "robustly" | NONE | NONE | NONE |
| 12 | "Plethora" | NONE | NONE | NONE |
| 13 | "Holistic" | NONE | NONE | NONE |
| 14 | "Foster" (as verb) | NONE | NONE | NONE |
| 15 | "Pivotal" / "paramount" | NONE | NONE | NONE |
| 16 | Filler — "just", "really", "truly", "essentially" | "really" in line 4 ("I want you to be"). **CONSIDERED**: line is fine without it. Original draft did NOT include the word; verified. NONE present. | NONE | NONE |
| 17 | Hedge stacking ("perhaps", "potentially", "might possibly") | NONE | NONE | NONE |
| 18 | Copula avoidance (every sentence opens with a "to be" verb) | Mixed openers: "You", "There", "Look", "Your", "How", "Please". GOOD. | Mixed: "I'm", "The", "Here's", "If". GOOD. | Mixed: "Built", "Every", "Realty", "The", "For", "Pro", "A", "Free", "How", "Tell". GOOD. |
| 19 | Triplet rhythm ("A, B, and C" three times in one para) | One triplet ("payout headroom, leverage, tenant concentration, and how…"). One pair max per para — this is one. ACCEPTABLE. | Same triplet repeated from template. ACCEPTABLE. | Triplet ("payout headroom, leverage, tenant concentration…"). ACCEPTABLE — same line, used once. |
| 20 | "Not only … but also …" | NONE | NONE | NONE |
| 21 | Bullet-list overload | 0 bullets. | 4 bullets (per memory: "no markdown bullets in forum DMs"). **VIOLATION**. Needs flattening to prose. | 0 markdown bullets; the four-tweet structure is the thread itself. ACCEPTABLE. |
| 22 | Vague stakes ("game-changing", "next-level") | NONE | NONE | NONE |
| 23 | "Here is" vs "Here's" — Glenn's editorial preference favours full "Here is" in long-form; forum DMs use "Here's". | Long-form: uses "Here is" implicitly via "How the score is calculated:". GOOD. | Uses "Here's what we're making:" per memory. GOOD. | Uses "How the score is built:" — no "Here is/Here's". GOOD. |
| 24 | "WhatsApp" capitalisation | Not mentioned. N/A | Not mentioned. N/A | Not mentioned. N/A |

## Violations to fix before send

1. **Em-dash in founding-member email line 4**: "There are three new sections live: /reits, /bdcs, and /uk-reits. Each ticker gets a Resilience score from 0 to 100 that judges how durable the dividend is — payout headroom, leverage, tenant concentration…" — the em-dash should become a colon or full stop.
2. **Em-dash in forum DM line 12**: "I'm building DividendMapper. It's a dividend portfolio tracker, like Sharesight, but with broker sync coming via Trading 212 and resilience scores on every holding." Wait — re-checking the file: no em-dash here on second look. The auditor's first scan flagged a hyphen in the role separator "founding-member" which is a normal compound, not an em-dash. CLEARED.
3. **Forum DM bullet list**: lines starting with "- /reits", "- /bdcs", "- /uk-reits", "- /methodology…" need flattening to prose per the [outreach-DM-format] memory rule.

Re-checked draft contents:

- Founding-member email: one em-dash in "score from 0 to 100 that judges how durable the dividend is — payout headroom…" → replace with colon.
- Forum DM: four-item bullet list → flatten to one prose sentence.
- Twitter thread: no violations.

## Recipient-profile opener guidance for forum DM

Per the memory entry on opener styles by recipient profile:
- **Veterans** (long-tenured forum members): respect + ask. "I read your March 2023 post on T212 sync — would you be open to…"
- **Creators** (active posters): specific reference. "Your video on REIT FFO ratios is exactly the kind of thing this scores."
- **Gatekeepers** (mods, high-karma): permission-asking. "Hoping it's OK to DM rather than post — I noticed the rule on product threads."
- **Referred** (came up through a name): name-drop. "X suggested I show you what we're building."

The current forum DM template has a placeholder opener — Glenn picks the style per recipient before send.

## What still needs Glenn

1. **Run the actual humaniser linter** before send. The script lives at `scripts/lint/humaniser.js` per the memory index; if it's not in this branch, pull it in from wherever it lives on the production checkout.
2. **Apply the two fixes flagged above** (em-dash → colon in founding-member email; bullet-list → prose in forum DM).
3. **Pick the opener style** per recipient for any forum DM send.
4. **Verify the founding-member list** against current Stripe state before pasting into Resend; the LIVE founding-member coupon is `founding_member_50_off_pro_6mo`.
5. **Approve the Twitter thread screenshot** — the thread needs a /reits ranked-list screenshot on tweet 1 to "lead with the visual"; that's a manual export.

Do NOT send until items 1-4 are signed off.
