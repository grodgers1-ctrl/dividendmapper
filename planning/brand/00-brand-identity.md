# Brand Identity — DividendMapper.com

**Last updated:** May 2026  
**Logo draft reviewed:** `gemini_DM_logodraft.png` (Gemini/Nano, May 2026)

---

## Brand Positioning

DividendMapper sits at the intersection of two things most finance tools get wrong: it's powerful enough for a serious investor tracking a £200K ISA, and clear enough for someone who just bought their first dividend ETF.

The brand should feel like a smart, trusted friend who happens to know a lot about dividend investing — not a bank, not a spreadsheet, not a startup trying too hard to be cool.

---

## Brand Personality

| Trait | What it means in practice |
|-------|--------------------------|
| **Clear** | Every screen answers "what do I need to know right now?" — no noise, no clutter |
| **Confident** | We know our numbers are right. No hedging, no wishy-washy language. |
| **Grounded** | Real money, real investors. We don't oversell or hype. |
| **Modern without being flashy** | Clean and contemporary, not minimalist for minimalism's sake |
| **Approachable** | A first-time ISA investor and a 20-year dividend compounder both feel at home |

### We are NOT
- Corporate / stuffy (Hargreaves Lansdown vibes)
- Gamified / dopamine-driven (Robinhood vibes)
- Overwhelming / dashboard hell (Bloomberg vibes)
- Generic fintech blue (every other app vibes)

---

## Tone of Voice

### Headlines
Short, direct, specific. Always about the investor's outcome — not the product's features.

| Instead of | Write |
|-----------|-------|
| "Advanced dividend tracking" | "Know exactly what lands in your account, and when" |
| "ISA/SIPP tax support" | "Your ISA dividends don't count toward your tax bill. We know that." |
| "Automated broker sync" | "Connect your Trading 212 account in 30 seconds" |
| "Premium features" | "Your portfolio, fully understood" |

### Body copy
Conversational but precise. No jargon without explanation. Short sentences. UK English (but the product supports both UK and US users — avoid idioms that don't travel).

### Numbers
Always formatted consistently. Large numbers use comma separators. Currency symbols precede the number. Percentages use one decimal place in UI, two in detailed views.

```
£12,450          ✅
£12450           ❌
12,450 GBP       ❌ (in UK-facing UI)

4.7%             ✅ (UI)
4.73%            ✅ (detail view)
4.7 percent      ❌
```

---

## Logo Direction

### Draft review — `gemini_DM_logodraft.png`

A first draft was produced using Gemini/Nano (May 2026). The draft showed: a combined upward-arrow + map-pin icon to the left of the "DividendMapper" wordmark, with "Dividend" in dark and "Mapper" in brand green. Dark mode stacked variant also shown. Favicon "D" concept visible bottom-right.

**What to keep from this draft:**

| Element | Why |
|---------|-----|
| Colour split — dark "Dividend" / green "Mapper" | Spot on. Exactly the right brand expression. Keep in all variants. |
| Dark mode stacked layout | Clean and confident. Use as the secondary logo lockup. |
| Map pin concept in the icon | The differentiating idea. Captures "mapping" without being generic. Develop this further. |
| Standalone "D" favicon concept | Simple, scalable, readable at 16px. This is the right approach for the favicon/app icon. |

**What to change:**

| Issue | Problem | Fix |
|-------|---------|-----|
| Combined arrow + map pin icon | Too complex — collapses to an unreadable blob at 32px and below | Drop the dominant arrow; let the pin stand alone or integrate a subtle upward tick *inside* the pin |
| Upward arrow as primary mark | Generic — used by Robinhood, Monzo, Revolut, Trading 212, dozens more | The map pin is the differentiator; the arrow weakens it |
| Font | Appears to be a rounded geometric sans (Nunito / Poppins feel) — not Plus Jakarta Sans | Re-set the wordmark in Plus Jakarta Sans SemiBold before finalising |
| "Mpx" monogram concept | Doesn't read as "DM" or "Mapper" reliably | Replace with the "D" + pin-dot favicon approach |

---

### Logo System Specification

#### Primary logo — wordmark only
Use for all contexts where the full logo is shown (header, marketing, documents).

```
[pin icon]  Dividend Mapper
            ──────── ──────
            slate-900  brand-500
            (or white  (#0EA874)
             on dark)
```

- Font: **Plus Jakarta Sans SemiBold (600)**
- "Dividend": `text-slate-900` light / `text-white` dark
- "Mapper": `text-brand-500` (`#0EA874`) in both modes
- Icon: map pin mark only — no arrow — in `brand-500`
- Minimum size: 120px wide (below this, use icon mark only)

#### Secondary logo — stacked lockup
Use where width is constrained but height is available (square social cards, app store listings, some mobile headers).

```
  [pin icon]
  Dividend
  Mapper
```

- Same colour rules as primary
- "Dividend" and "Mapper" on separate lines, left-aligned under the icon
- Minimum size: 80px wide

#### Icon mark — standalone pin
Use when the wordmark is already present nearby (app sidebar top, browser tab companion, embossed/embroidered contexts).

The icon is a map pin / location marker where:
- The pin body is solid `brand-500` (`#0EA874`)
- A small upward diagonal tick or dot sits inside the pin head — not an arrow, just enough to suggest upward movement
- The pin tail points downward (standard map pin orientation)

#### Favicon / App icon
- 32×32 and below: white or brand-green "**D**" on slate-900 square with slightly rounded corners (`border-radius: 6px`)
- 512×512 (app store): full icon mark (pin) on slate-900 background, centred, with generous padding

---

### Logo Do / Don't

| Do | Don't |
|----|-------|
| Use Plus Jakarta Sans SemiBold for the wordmark | Use any other font, even temporarily |
| Keep "Dividend" dark and "Mapper" green in all contexts | Reverse the colours or make both the same colour |
| Use the icon mark alone when space is very tight | Scale the full wordmark below 120px wide |
| Use the standalone "D" favicon on dark slate at 32px and below | Use the complex pin+arrow icon at small sizes |
| Keep the icon mark to the left of the wordmark | Place the icon above the wordmark in the horizontal lockup |
| Use `brand-500` (`#0EA874`) for all green logo elements | Use any other green shade in the logo |
| Leave clear space equal to the cap-height of the "D" around the full logo | Place other elements, text, or images within the clear space zone |
| Use the dark mode variant (white "Dividend") on any background darker than `slate-600` | Use the light wordmark on dark backgrounds |

---

### What Makes the Map Pin the Right Mark

The upward arrow is the most overused icon in fintech. Robinhood, Monzo, Revolut, Trading 212, Wealthify, Nutmeg — all use some form of upward arrow or graph line as their primary mark. DividendMapper's differentiator is the *mapping* idea: your dividend income laid out geographically and temporally so you always know where you stand.

The map pin earns its place because:
1. It is genuinely distinctive in the fintech icon space
2. It directly references the product name ("Mapper")
3. It can be executed simply enough to work at 16px
4. It suggests precision and location — knowing exactly where your income is coming from

The arrow, if included at all, should be a secondary element — not the headline of the mark.

---

## Brand in Context

### Landing page hero
> **"Your dividends, mapped."**
> Track income across every account. Know your FIRE number. Connect Trading 212, Schwab, Fidelity and more — free.

### Onboarding empty state (after first login, no data yet)
> "Add your first holding and we'll start building your dividend picture."
> *(Not: "Get started by adding portfolio data to unlock insights")*

### Upgrade prompt (from free to Pro)
> "Connect your broker. Stop entering holdings by hand."
> *(Not: "Upgrade to Pro to unlock automated broker synchronisation features")*

### Error message (sync failed)
> "Your Trading 212 sync hit an issue — we're looking into it. Last successful sync: 2 hours ago."
> *(Not: "Error 503: Brokerage API connection failure. Please try again later.")*

---

## Brand Files Index

| File | Contents |
|------|---------|
| [01-colour-palette.md](01-colour-palette.md) | Full palette with hex codes, Tailwind config, CSS variables, use-case rules |
| [02-typography.md](02-typography.md) | Font choices, type scale, Next.js setup, usage rules |
| [03-ui-guidelines.md](03-ui-guidelines.md) | Component patterns, spacing, shadows, dark mode, do/don't rules |

**Logo assets:**

| File | Status | Notes |
|------|--------|-------|
| `gemini_DM_logodraft.png` | Draft — do not use in production | Good colour split and pin concept; wrong font, arrow too dominant. See Logo Direction above for full review. |
