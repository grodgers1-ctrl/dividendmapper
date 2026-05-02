# Colour Palette — DividendMapper.com

**Last updated:** May 2026  
**Stack:** Next.js 14+ / Tailwind CSS / shadcn/ui

---

## Palette Overview

The palette is built around three ideas:

1. **Emerald green** — growth, income, money. Distinctive without being generic (most fintech uses blue).
2. **Deep slate** — authority, trust, data. The dark backbone of every chart and data-dense screen.
3. **Warm amber** — dividend income highlighted as something earned and valuable. Used sparingly.

A dark mode is a first-class citizen from day one. shadcn/ui's CSS variable system makes this straightforward.

---

## Primary Colours

### Brand Green — `#0EA874`
The primary action colour. Used for CTAs, links, positive data, brand marks.

This is a custom emerald sitting between Tailwind's `emerald-500` and `emerald-600`. It reads as confident and financial — not eco/sustainability (which leans too yellow-green).

| Shade | Hex | Tailwind equivalent | Use |
|-------|-----|---------------------|-----|
| Green 50 | `#ECFDF5` | emerald-50 | Tinted backgrounds, success toasts |
| Green 100 | `#D1FAE5` | emerald-100 | Badge fills, hover states on white |
| Green 200 | `#A7F3D0` | emerald-200 | Chart fills (light mode) |
| Green 400 | `#34D399` | emerald-400 | Dark mode links, chart highlights |
| **Green 500** | **`#0EA874`** | custom | **Primary brand — CTAs, active states** |
| Green 600 | `#059669` | emerald-600 | Hover on primary button |
| Green 700 | `#047857` | emerald-700 | Pressed state, dark mode primary |
| Green 900 | `#064E3B` | emerald-900 | Dark mode tinted backgrounds |

### Brand Slate — `#0F172A`
The primary dark colour. Used for text, dark backgrounds, data-dense UI.

| Shade | Hex | Tailwind equivalent | Use |
|-------|-----|---------------------|-----|
| Slate 50 | `#F8FAFC` | slate-50 | Page background (light mode) |
| Slate 100 | `#F1F5F9` | slate-100 | Card background (light mode) |
| Slate 200 | `#E2E8F0` | slate-200 | Borders, dividers (light mode) |
| Slate 400 | `#94A3B8` | slate-400 | Placeholder text, disabled states |
| Slate 500 | `#64748B` | slate-500 | Secondary / muted text |
| Slate 700 | `#334155` | slate-700 | Body text (light mode) |
| Slate 800 | `#1E293B` | slate-800 | Dark mode surface / card |
| **Slate 900** | **`#0F172A`** | slate-900 | **Headings (light mode), dark mode background** |
| Slate 950 | `#020617` | slate-950 | Dark mode deepest background |

---

## Accent Colour

### Income Amber — `#F59E0B`
Used exclusively for dividend income highlights — amounts received, payment dates, income projections. Evokes "gold" / earned value. Never used for interactive elements to avoid confusion with warnings.

| Shade | Hex | Use |
|-------|-----|-----|
| Amber 50 | `#FFFBEB` | Income highlight background (light) |
| Amber 100 | `#FEF3C7` | Badge fills for income events |
| **Amber 500** | **`#F59E0B`** | **Dividend amount display, income chart lines** |
| Amber 600 | `#D97706` | Hover state on amber elements |
| Amber 900 | `#78350F` | Dark amber text on light amber bg (WCAG AA) |

---

## Semantic Colours

These follow market convention — investors worldwide understand red = down, green = up. Do not deviate from this convention.

| Colour | Hex | Use |
|--------|-----|-----|
| **Positive green** | `#16A34A` (green-600) | Positive price change, dividend increase, portfolio gain |
| **Negative red** | `#DC2626` (red-600) | Negative price change, dividend cut, portfolio loss |
| **Warning amber** | `#D97706` (amber-600) | Dividend at risk, approaching ISA limit, account needs attention |
| **Info blue** | `#2563EB` (blue-600) | Neutral information, ex-dividend date approaching |
| **Neutral** | `#64748B` (slate-500) | No change, n/a values, loading states |

> **Note on green overlap:** The positive semantic green (`#16A34A`) is intentionally darker and more muted than the brand green (`#0EA874`). In charts and tables, semantic greens should always be the darker shade so they read as data, not as "click me."

---

## Neutrals

Used for backgrounds, surfaces, text, and borders. Built on Tailwind slate for blue-grey warmth (better than pure grey for financial UI).

| Token | Hex | Light mode use | Dark mode use |
|-------|-----|----------------|---------------|
| `neutral-bg` | `#F8FAFC` | Page background | `#020617` |
| `neutral-surface` | `#FFFFFF` | Card / panel background | `#0F172A` |
| `neutral-surface-raised` | `#F1F5F9` | Input backgrounds, table rows | `#1E293B` |
| `neutral-border` | `#E2E8F0` | Card borders, dividers | `#334155` |
| `neutral-border-strong` | `#CBD5E1` | Input borders, table lines | `#475569` |
| `neutral-text-muted` | `#94A3B8` | Labels, captions, timestamps | `#64748B` |
| `neutral-text-secondary` | `#64748B` | Secondary body text | `#94A3B8` |
| `neutral-text-primary` | `#334155` | Body text | `#E2E8F0` |
| `neutral-text-heading` | `#0F172A` | Headings and bold labels | `#F8FAFC` |

---

## CSS Variables (shadcn/ui compatible)

Add to `globals.css`. These map directly to shadcn/ui's theming convention.

```css
@layer base {
  :root {
    --background: 210 40% 98%;           /* slate-50 */
    --foreground: 215 28% 17%;           /* slate-900 */

    --card: 0 0% 100%;
    --card-foreground: 215 28% 17%;

    --popover: 0 0% 100%;
    --popover-foreground: 215 28% 17%;

    --primary: 158 84% 37%;              /* brand green #0EA874 */
    --primary-foreground: 0 0% 100%;

    --secondary: 210 40% 96%;            /* slate-100 */
    --secondary-foreground: 215 28% 17%;

    --muted: 210 40% 96%;
    --muted-foreground: 215 20% 56%;     /* slate-400 */

    --accent: 43 96% 56%;               /* amber-500 */
    --accent-foreground: 215 28% 17%;

    --destructive: 0 84% 60%;           /* red-500 */
    --destructive-foreground: 0 0% 100%;

    --border: 214 32% 91%;              /* slate-200 */
    --input: 214 32% 91%;
    --ring: 158 84% 37%;               /* brand green */

    --radius: 0.625rem;                 /* 10px — slightly rounded */
  }

  .dark {
    --background: 222 47% 5%;           /* slate-950 */
    --foreground: 210 40% 98%;          /* slate-50 */

    --card: 215 28% 17%;               /* slate-900 */
    --card-foreground: 210 40% 98%;

    --popover: 215 28% 17%;
    --popover-foreground: 210 40% 98%;

    --primary: 158 84% 37%;
    --primary-foreground: 0 0% 100%;

    --secondary: 217 33% 17%;           /* slate-800 */
    --secondary-foreground: 210 40% 98%;

    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 56%;

    --accent: 43 96% 56%;
    --accent-foreground: 215 28% 17%;

    --destructive: 0 63% 31%;
    --destructive-foreground: 210 40% 98%;

    --border: 217 33% 25%;              /* slate-700 */
    --input: 217 33% 25%;
    --ring: 158 84% 37%;
  }
}
```

---

## Tailwind Config Extension

Add to `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          400: '#34D399',
          500: '#0EA874',  // primary
          600: '#059669',
          700: '#047857',
          900: '#064E3B',
        },
        income: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',  // amber accent
          600: '#D97706',
          900: '#78350F',
        },
        positive: '#16A34A',
        negative: '#DC2626',
      },
    },
  },
}

export default config
```

---

## Colour Use Rules

### Do
- Use `brand-500` (`#0EA874`) for all primary CTAs, active nav items, and focus rings
- Use `income-500` (`#F59E0B`) exclusively for dividend amount displays and income projections
- Use `positive` / `negative` for price changes and portfolio performance — never brand green for data
- Maintain at least 4.5:1 contrast ratio for all text (WCAG AA) — check with Coolors or WebAIM
- Use slate for all neutral UI elements — never pure grey (`#888888`) which looks washed out on modern displays

### Don't
- Mix amber (income) with warning states — amber is for income, not danger. Use `red-600` for danger.
- Use brand green for chart data lines that represent stocks (use a multi-colour data palette instead — see UI guidelines)
- Apply transparency to semantic colours — `rgba(220, 38, 38, 0.2)` red backgrounds are fine for toast backgrounds; never use semi-transparent reds on charts as they mislead
- Use more than 3 colours in a single chart — beyond 3, use a sequential palette based on brand green

---

## Data Visualisation Palette

For charts with multiple data series (e.g., portfolio breakdown by sector or holding):

```
Series 1:  #0EA874  (brand green)
Series 2:  #2563EB  (blue-600)
Series 3:  #7C3AED  (violet-600)
Series 4:  #DB2777  (pink-600)
Series 5:  #D97706  (amber-600)
Series 6:  #0891B2  (cyan-600)
Series 7:  #65A30D  (lime-600)
Series 8:  #9333EA  (purple-600)
```

These are sufficiently distinct for colour-blind users when combined with shape/label differentiation. Never rely on colour alone to distinguish data series — always add labels or patterns.

**Single-series charts** (e.g., portfolio value over time, monthly dividend income): Use brand green `#0EA874` line with a `#ECFDF5` fill beneath.

**Positive/negative bars** (e.g., monthly income vs target): Use `positive` (`#16A34A`) and `negative` (`#DC2626`).

---

## Accessibility

All text/background combinations in use must meet WCAG AA (4.5:1 for normal text, 3:1 for large text).

| Text | Background | Ratio | Pass |
|------|-----------|-------|------|
| Slate-900 `#0F172A` | White `#FFFFFF` | 17.4:1 | ✅ AAA |
| Slate-700 `#334155` | White `#FFFFFF` | 9.9:1 | ✅ AAA |
| Brand-500 `#0EA874` | White `#FFFFFF` | 3.1:1 | ✅ (large text only) |
| White `#FFFFFF` | Brand-500 `#0EA874` | 3.1:1 | ✅ (large text only — use for CTA text) |
| White `#FFFFFF` | Brand-600 `#059669` | 4.6:1 | ✅ AA |
| Amber-900 `#78350F` | Amber-100 `#FEF3C7` | 6.1:1 | ✅ AA |
| Slate-50 `#F8FAFC` | Slate-900 `#0F172A` | 17.0:1 | ✅ AAA |

> **CTA button rule:** Always use `brand-600` (`#059669`) as the button background (not `brand-500`) when white text sits on it. This ensures AA compliance for body-size button labels.
